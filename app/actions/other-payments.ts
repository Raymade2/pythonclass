"use server";

import { revalidatePath } from "next/cache";
import { authUser, clientIp } from "@/lib/auth";
import * as finance from "@/lib/repo/finance";
import { str, optStr, num, optNum, optDateStr, bool, fail, ok, logAudit, type ActionResult } from "@/lib/server-utils";

const ADMIN = ["SUPER_ADMIN", "ADMIN"];

// ---------------------------------------------------------------------------
// Other payments
// ---------------------------------------------------------------------------

const SCOPES = ["STUDENT", "CLASS", "GROUP", "SCHOOL"] as const;

export async function saveOtherPaymentAction(fd: FormData): Promise<ActionResult> {
  try {
    const user = await authUser(ADMIN);
    const id = optNum(fd, "id");
    const name = str(fd, "name", { required: true, max: 100 });
    const category = str(fd, "category", { required: true, max: 80 });
    const amount = num(fd, "amount", { required: true, min: 1, max: 100_000_000 });
    const scope = (fd.get("scope")?.toString() ?? "SCHOOL") as (typeof SCOPES)[number];
    if (!SCOPES.includes(scope)) throw new Error("Invalid scope");
    const studentId = optNum(fd, "studentId");
    const classId = optNum(fd, "classId");
    const classGroupId = optNum(fd, "classGroupId");
    const sessionId = num(fd, "sessionId", { required: true });
    const termId = num(fd, "termId", { required: true });
    const dueDate = optDateStr(fd, "dueDate");
    const description = optStr(fd, "description", 300);
    const mandatory = bool(fd, "mandatory");
    const status = str(fd, "status", { max: 20 }) || "ACTIVE";

    if (scope === "STUDENT" && !studentId) throw new Error("Select the student this payment applies to");
    if (scope === "CLASS" && !classId) throw new Error("Select the class this payment applies to");
    if (scope === "GROUP" && !classGroupId) throw new Error("Select the class group this payment applies to");

    const data = { name, category, amount, scope, studentId: scope === "STUDENT" ? studentId : null,
      classId: scope === "CLASS" ? classId : null, classGroupId: scope === "GROUP" ? classGroupId : null,
      sessionId, termId, dueDate, description, mandatory, status };

    if (id) {
      finance.updateOtherPayment(id, data);
      await logAudit({ user, action: "Updated other payment", entity: "OtherPayment", entityId: id, newValue: { name, amount, scope }, ip: await clientIp() });
      revalidatePath("/other-payments");
      return ok("Other payment updated successfully", id);
    }
    const createdId = finance.createOtherPayment(data);
    await logAudit({ user, action: "Created other payment", entity: "OtherPayment", entityId: createdId, newValue: { name, amount, scope }, ip: await clientIp() });
    revalidatePath("/other-payments");
    return ok(`Other payment "${name}" created successfully`, createdId);
  } catch (e) {
    return fail(e);
  }
}

export async function deleteOtherPaymentAction(fd: FormData): Promise<ActionResult> {
  try {
    const user = await authUser(ADMIN);
    const id = num(fd, "id", { required: true });
    const rows = finance.listOtherPayments({});
    const target = rows.find((r) => r.id === id);
    finance.deleteOtherPayment(id);
    await logAudit({ user, action: "Deleted other payment", entity: "OtherPayment", entityId: id, oldValue: target ? { name: target.name } : null, ip: await clientIp() });
    revalidatePath("/other-payments");
    return ok("Other payment deleted");
  } catch (e) {
    return fail(e);
  }
}
