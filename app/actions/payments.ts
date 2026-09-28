"use server";

import { revalidatePath } from "next/cache";
import { authUser, clientIp } from "@/lib/auth";
import * as finance from "@/lib/repo/finance";
import { getScope } from "@/lib/scope";
import { str, optStr, num, optDateStr, oneOf, fail, ok, logAudit, notify, parentUserIdsForStudent, type ActionResult } from "@/lib/server-utils";
import { OFFLINE_METHODS } from "@/lib/constants";

// ---------------------------------------------------------------------------
// Record an offline payment (cash, transfer, POS, cheque, other)
// ---------------------------------------------------------------------------

export async function recordPaymentAction(fd: FormData): Promise<ActionResult> {
  try {
    const user = await authUser(["SUPER_ADMIN", "ADMIN", "TEACHER"]);
    const invoiceId = num(fd, "invoiceId", { required: true });
    const amount = num(fd, "amount", { required: true, min: 1, max: 100_000_000 });
    const method = oneOf(fd, "method", OFFLINE_METHODS, "Cash");
    const transactionReference = optStr(fd, "transactionReference", 80);
    const paymentDate = optDateStr(fd, "paymentDate") ?? new Date().toISOString();
    const notes = optStr(fd, "notes", 400);

    const invoice = finance.getInvoiceById(invoiceId);
    if (!invoice) throw new Error("Invoice not found");
    if (invoice.status === "CANCELLED") throw new Error("Cannot record payment against a cancelled invoice");
    if (invoice.balance <= 0) throw new Error("This invoice is already fully paid");
    if (amount > invoice.balance) throw new Error(`Amount exceeds the outstanding balance of ₦${invoice.balance.toLocaleString("en-NG")}`);
    if (transactionReference && finance.transactionReferenceExists(transactionReference)) {
      throw new Error("A payment with this transaction reference already exists");
    }

    // Teacher scope: only students in their classes
    const scope = await getScope(user);
    if (scope.studentIds !== null && !scope.studentIds.includes(invoice.studentId)) {
      throw new Error("You can only record payments for students in your assigned classes");
    }

    const result = finance.recordSuccessfulPayment({
      invoiceId,
      studentId: invoice.studentId,
      amount,
      method,
      channel: "office",
      transactionReference,
      paymentDate,
      recordedByUserId: user.id,
      recordedByName: user.name,
      notes,
    });

    const refreshed = finance.getInvoiceById(invoiceId)!;
    const fullyPaid = refreshed.balance <= 0;
    await notify(await parentUserIdsForStudent(invoice.studentId), {
      title: fullyPaid ? "Payment completed — thank you!" : "Payment partially completed",
      message: `₦${amount.toLocaleString("en-NG")} received for invoice ${invoice.invoiceNumber}. Receipt ${result.receiptNumber}. Outstanding balance: ₦${refreshed.balance.toLocaleString("en-NG")}.`,
      type: fullyPaid ? "success" : "warning",
      link: `/receipts/${result.paymentId}`,
    });
    await logAudit({
      user, action: `Recorded ₦${amount.toLocaleString("en-NG")} payment for invoice ${invoice.invoiceNumber}`,
      entity: "Payment", entityId: result.paymentId,
      newValue: { amount, method, receipt: result.receiptNumber }, ip: await clientIp(),
    });
    revalidatePath(`/billing/${invoiceId}`);
    revalidatePath("/payments");
    revalidatePath("/dashboard");
    revalidatePath("/debtors");
    return ok(
      `Payment of ₦${amount.toLocaleString("en-NG")} recorded successfully. Receipt ${result.receiptNumber}.`,
      result.paymentId
    );
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------------------
// Online payment initialization (Paystack / Flutterwave / demo gateway)
// ---------------------------------------------------------------------------

export async function initializeOnlinePaymentAction(fd: FormData): Promise<ActionResult & { url?: string }> {
  try {
    const user = await authUser(["SUPER_ADMIN", "ADMIN", "TEACHER", "PARENT"]);
    const invoiceId = num(fd, "invoiceId", { required: true });
    const amount = num(fd, "amount", { required: true, min: 100, max: 100_000_000 });

    const invoice = finance.getInvoiceById(invoiceId);
    if (!invoice) throw new Error("Invoice not found");
    if (invoice.status === "CANCELLED") throw new Error("This invoice has been cancelled");
    if (invoice.balance <= 0) throw new Error("This invoice is already fully paid");
    if (amount > invoice.balance) throw new Error(`Amount exceeds the outstanding balance of ₦${invoice.balance.toLocaleString("en-NG")}`);

    const scope = await getScope(user);
    if (scope.studentIds !== null && !scope.studentIds.includes(invoice.studentId)) {
      throw new Error("You can only pay invoices for your own students");
    }

    // Fail any previous pending online payment for this invoice by this user
    const stale = finance.listAllPayments({ invoiceId, status: "PENDING" });
    for (const p of stale) {
      finance.failPendingPayment(p.id, "Superseded by a new payment attempt. ");
    }

    const txRef = finance.newTransactionReference();
    const created = finance.createPendingPayment({
      invoiceId,
      studentId: invoice.studentId,
      amount,
      method: "Online",
      channel: process.env.PAYSTACK_SECRET_KEY ? "paystack" : process.env.FLUTTERWAVE_SECRET_KEY ? "flutterwave" : "demo",
      transactionReference: txRef,
      recordedByUserId: user.id,
      recordedByName: user.name,
    });

    await logAudit({
      user, action: `Initiated online payment of ₦${amount.toLocaleString("en-NG")} for invoice ${invoice.invoiceNumber}`,
      entity: "Payment", entityId: created.paymentId, newValue: { txRef }, ip: await clientIp(),
    });

    // Real Paystack integration when a secret key is configured (server-side only)
    const paystackKey = process.env.PAYSTACK_SECRET_KEY;
    if (paystackKey) {
      const callbackUrl = `${process.env.APP_URL ?? ""}/api/payments/callback?reference=${encodeURIComponent(txRef)}`;
      const resp = await fetch("https://api.paystack.co/transaction/initialize", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${paystackKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: user.email,
          amount: amount * 100, // kobo
          reference: txRef,
          callback_url: callbackUrl,
          metadata: { invoiceId, paymentId: created.paymentId, student: `${invoice.firstName} ${invoice.lastName}` },
        }),
      });
      const data = (await resp.json()) as { status: boolean; data?: { authorization_url: string }; message?: string };
      if (!resp.ok || !data.status || !data.data?.authorization_url) {
        finance.failPendingPayment(created.paymentId, "Gateway initialization failed. ");
        throw new Error(data.message ?? "Payment gateway error. Try again or pay at the school office.");
      }
      return { ok: true, message: "Redirecting to secure checkout…", url: data.data.authorization_url };
    }

    // Demo gateway simulator
    return { ok: true, message: "Redirecting to secure checkout…", url: `/pay/${created.paymentId}` };
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------------------
// Demo gateway confirmation (simulates the gateway webhook/callback)
// ---------------------------------------------------------------------------

export async function demoGatewayConfirmAction(fd: FormData): Promise<ActionResult & { paymentId?: number }> {
  try {
    const paymentId = num(fd, "paymentId", { required: true });
    const payment = finance.getPaymentById(paymentId);
    if (!payment) throw new Error("Payment not found");
    if (payment.channel !== "demo") throw new Error("This confirmation endpoint is only for the demo gateway");

    const result = finance.completePendingPayment(paymentId);
    const invoice = finance.getInvoiceById(result.invoiceId);
    await notify(await parentUserIdsForStudent(payment.studentId), {
      title: "Online payment successful",
      message: `₦${payment.amount.toLocaleString("en-NG")} received via online payment. Receipt ${result.receiptNumber}.`,
      type: "success",
      link: `/receipts/${paymentId}`,
    });
    await logAudit({
      user: null, action: `Online payment confirmed (demo gateway) — receipt ${result.receiptNumber}`,
      entity: "Payment", entityId: paymentId, newValue: { amount: payment.amount, receipt: result.receiptNumber },
    });
    revalidatePath(`/billing/${result.invoiceId}`);
    revalidatePath("/payments");
    revalidatePath("/dashboard");
    return {
      ok: true,
      message: `Payment successful! Receipt ${result.receiptNumber}.`,
      paymentId,
      url: `/receipts/${paymentId}`,
    } as ActionResult & { paymentId?: number; url?: string };
  } catch (e) {
    return fail(e);
  }
}

export async function demoGatewayCancelAction(fd: FormData): Promise<ActionResult> {
  try {
    const paymentId = num(fd, "paymentId", { required: true });
    const payment = finance.getPaymentById(paymentId);
    if (!payment) throw new Error("Payment not found");
    if (payment.status !== "PENDING") throw new Error("This payment is no longer pending");
    finance.failPendingPayment(paymentId, "Cancelled by user at checkout. ");
    return ok("Payment cancelled. You can try again any time.");
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------------------
// Debtors: send payment reminder
// ---------------------------------------------------------------------------

export async function sendPaymentReminderAction(fd: FormData): Promise<ActionResult> {
  try {
    const user = await authUser(["SUPER_ADMIN", "ADMIN", "TEACHER"]);
    const studentId = num(fd, "studentId", { required: true });
    const summary = finance.studentFinancialSummary(studentId);
    if (summary.outstanding <= 0) throw new Error("This student has no outstanding balance");

    const student = (await import("@/lib/repo/people")).getStudentById(studentId);
    if (!student) throw new Error("Student not found");

    await notify(await parentUserIdsForStudent(studentId), {
      title: "Payment reminder",
      message: `Kindly note an outstanding balance of ₦${summary.outstanding.toLocaleString("en-NG")} for ${student.firstName} ${student.lastName}. Please log in to view bills and make a payment. Thank you.`,
      type: "warning",
      link: "/billing",
    });
    await logAudit({
      user, action: `Sent payment reminder to parent of ${student.firstName} ${student.lastName}`,
      entity: "Student", entityId: studentId, newValue: { outstanding: summary.outstanding }, ip: await clientIp(),
    });
    return ok(`Payment reminder sent to the parent/guardian of ${student.firstName} ${student.lastName}`);
  } catch (e) {
    return fail(e);
  }
}
