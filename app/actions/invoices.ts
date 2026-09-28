"use server";

import { revalidatePath } from "next/cache";
import { authUser, clientIp } from "@/lib/auth";
import * as finance from "@/lib/repo/finance";
import * as academics from "@/lib/repo/academics";
import * as people from "@/lib/repo/people";
import { getScope, requireCurrentAcademic } from "@/lib/scope";
import { str, optStr, num, optNum, optDateStr, fail, ok, logAudit, notify, parentUserIdsForStudent, adminUserIds, type ActionResult } from "@/lib/server-utils";

// ---------------------------------------------------------------------------
// Generate invoice for a single student
// ---------------------------------------------------------------------------

export async function generateInvoiceAction(fd: FormData): Promise<ActionResult> {
  try {
    const user = await authUser(["SUPER_ADMIN", "ADMIN", "TEACHER", "PARENT"]);
    const studentId = num(fd, "studentId", { required: true });
    const sessionId = num(fd, "sessionId", { required: true });
    const termId = num(fd, "termId", { required: true });
    const dueDate = optDateStr(fd, "dueDate");
    const notes = optStr(fd, "notes", 400);

    // Scope check: teachers can only bill students in their classes; parents only their children
    const scope = await getScope(user);
    if (scope.studentIds !== null && !scope.studentIds.includes(studentId)) {
      throw new Error("You can only generate payments for students assigned to you");
    }

    const student = people.getStudentById(studentId);
    if (!student) throw new Error("Student not found");
    const session = academics.getSessionById(sessionId);
    const term = academics.getTermById(termId);
    if (!session || !term || term.sessionId !== sessionId) throw new Error("Invalid session/term");

    const assignment = academics.getStudentClassAssignment(studentId, sessionId, termId);
    const classId = assignment?.classId ?? null;
    const cls = classId ? academics.getClassById(classId) : null;

    const feeIds = fd.getAll("feeIds").map((v) => Number(v)).filter((n) => Number.isFinite(n) && n > 0);
    const otherIds = fd.getAll("otherPaymentIds").map((v) => Number(v)).filter((n) => Number.isFinite(n) && n > 0);
    if (feeIds.length === 0 && otherIds.length === 0) throw new Error("Select at least one payment item");

    const items: finance.InvoiceItemInput[] = [];
    let maxDue: Date | null = null;

    if (feeIds.length > 0) {
      if (!classId) throw new Error("The student has no class assignment for this session/term, so class fees cannot be applied");
      const available = finance.availableFeesForStudent(studentId, classId, sessionId, termId);
      const availMap = new Map(available.map((f) => [f.id, f]));
      for (const fid of feeIds) {
        const fee = availMap.get(fid);
        if (!fee) throw new Error("One of the selected fee items is no longer available (already invoiced or inactive)");
        items.push({ description: `${fee.name} — ${fee.categoryName}`, amount: fee.amount, feeId: fee.id });
        if (fee.dueDate && (!maxDue || new Date(fee.dueDate) > maxDue)) maxDue = new Date(fee.dueDate);
      }
    }

    if (otherIds.length > 0) {
      const classGroupId = cls?.classGroupId ?? null;
      const applicable = finance.applicableOtherPaymentsForStudent(studentId, classId, classGroupId, sessionId, termId);
      const appMap = new Map(applicable.map((o) => [o.id, o]));
      for (const oid of otherIds) {
        const op = appMap.get(oid);
        if (!op) throw new Error("One of the selected other payments is no longer available for this student");
        items.push({ description: `${op.name} — ${op.category}`, amount: op.amount, otherPaymentId: op.id });
        if (op.dueDate && (!maxDue || new Date(op.dueDate) > maxDue)) maxDue = new Date(op.dueDate);
      }
    }

    const effectiveDue = dueDate ? new Date(dueDate) : maxDue;
    const created = finance.createInvoice({
      studentId, sessionId, termId, sessionName: session.name,
      dueDate: effectiveDue ? effectiveDue.toISOString() : null,
      notes, generatedByUserId: user.id, generatedByName: user.name, items,
    });

    await notify([...(await parentUserIdsForStudent(studentId)), ...(await adminUserIds())], {
      title: "New invoice generated",
      message: `Invoice ${created.invoiceNumber} for ${student.firstName} ${student.lastName} — ${items.length} item(s).`,
      type: "info",
      link: `/billing/${created.id}`,
    });
    await logAudit({
      user, action: `Generated payment invoice ${created.invoiceNumber}`, entity: "Invoice", entityId: created.id,
      newValue: { student: `${student.firstName} ${student.lastName}`, items: items.length, total: items.reduce((s, i) => s + i.amount, 0) },
      ip: await clientIp(),
    });
    revalidatePath("/billing");
    revalidatePath("/dashboard");
    return ok(`Invoice ${created.invoiceNumber} generated successfully`, created.id);
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------------------
// Bulk-generate invoices for every student in a class without one
// ---------------------------------------------------------------------------

export async function bulkGenerateInvoicesAction(fd: FormData): Promise<ActionResult> {
  try {
    const user = await authUser(["SUPER_ADMIN", "ADMIN"]);
    const classId = num(fd, "classId", { required: true });
    const sessionId = num(fd, "sessionId", { required: true });
    const termId = num(fd, "termId", { required: true });

    const session = academics.getSessionById(sessionId);
    const term = academics.getTermById(termId);
    const cls = academics.getClassById(classId);
    if (!session || !term || !cls) throw new Error("Invalid class/session/term");

    const { rows: assignments } = academics.listStudentAssignments({ sessionId, termId, classId, limit: 10000 });
    if (assignments.length === 0) throw new Error("No students are assigned to this class for the selected session/term");

    const fees = finance.listFees({ sessionId, termId, classId, status: "ACTIVE" }).filter((f) => f.mandatory);
    if (fees.length === 0) throw new Error("This class has no mandatory fee items configured for the selected session/term");

    let generated = 0;
    let skipped = 0;
    const notifyParents: number[] = [];

    for (const a of assignments) {
      const existing = finance
        .listAllInvoices({ studentIds: [a.studentId], sessionId, termId })
        .filter((i) => i.status !== "CANCELLED");
      if (existing.length > 0) {
        skipped++;
        continue;
      }
      const items: finance.InvoiceItemInput[] = fees.map((f) => ({
        description: `${f.name} — ${f.categoryName}`,
        amount: f.amount,
        feeId: f.id,
      }));
      const due = fees
        .map((f) => (f.dueDate ? new Date(f.dueDate) : null))
        .filter((d): d is Date => d !== null)
        .sort((x, y) => y.getTime() - x.getTime())[0];
      const created = finance.createInvoice({
        studentId: a.studentId, sessionId, termId, sessionName: session.name,
        dueDate: due ? due.toISOString() : null, notes: `Bulk-generated for ${cls.name}`,
        generatedByUserId: user.id, generatedByName: user.name, items,
      });
      generated++;
      notifyParents.push(...(await parentUserIdsForStudent(a.studentId)));
    }

    await notify(notifyParents, {
      title: "New invoice generated",
      message: `Termly fee invoices for ${cls.name} (${term.name}, ${session.name}) are now available.`,
      type: "info",
      link: "/billing",
    });
    await logAudit({
      user, action: `Bulk-generated ${generated} invoice(s) for ${cls.name}`, entity: "Class", entityId: classId,
      newValue: { generated, skipped }, ip: await clientIp(),
    });
    revalidatePath("/billing");
    revalidatePath("/dashboard");
    if (generated === 0) return ok(`All ${skipped} students in ${cls.name} already have invoices for this term`);
    return ok(`${generated} invoice(s) generated for ${cls.name}${skipped ? ` (${skipped} skipped — already invoiced)` : ""}`);
  } catch (e) {
    return fail(e);
  }
}

export async function cancelInvoiceAction(fd: FormData): Promise<ActionResult> {
  try {
    const user = await authUser(["SUPER_ADMIN", "ADMIN"]);
    const id = num(fd, "id", { required: true });
    const invoice = finance.getInvoiceById(id);
    if (!invoice) throw new Error("Invoice not found");
    if (invoice.status === "CANCELLED") throw new Error("Invoice is already cancelled");
    if (invoice.amountPaid > 0) throw new Error("This invoice has payments recorded against it and cannot be cancelled");
    finance.cancelInvoice(id);
    await notify(await parentUserIdsForStudent(invoice.studentId), {
      title: "Invoice cancelled",
      message: `Invoice ${invoice.invoiceNumber} has been cancelled by the school.`,
      type: "warning",
      link: `/billing/${id}`,
    });
    await logAudit({ user, action: `Cancelled invoice ${invoice.invoiceNumber}`, entity: "Invoice", entityId: id, oldValue: { status: invoice.status }, newValue: { status: "CANCELLED" }, ip: await clientIp() });
    revalidatePath(`/billing/${id}`);
    revalidatePath("/billing");
    revalidatePath("/dashboard");
    return ok(`Invoice ${invoice.invoiceNumber} cancelled`);
  } catch (e) {
    return fail(e);
  }
}
