import { NextRequest, NextResponse } from "next/server";
import * as finance from "@/lib/repo/finance";
import { notify, parentUserIdsForStudent } from "@/lib/server-utils";

/**
 * Paystack payment callback. Paystack redirects the payer here with
 * ?reference=<txref>; we verify the transaction server-side with the secret
 * key (never exposed to the frontend) before confirming the payment.
 */
export async function GET(req: NextRequest) {
  const reference = req.nextUrl.searchParams.get("reference");
  const origin = new URL(req.url).origin;
  if (!reference) {
    return NextResponse.redirect(`${origin}/payments?error=missing-reference`);
  }

  const payment = finance.getPaymentByTxRef(reference);
  if (!payment) {
    return NextResponse.redirect(`${origin}/payments?error=unknown-transaction`);
  }
  if (payment.status === "SUCCESSFUL") {
    // Duplicate callback — payment already processed (duplicate protection)
    return NextResponse.redirect(`${origin}/receipts/${payment.id}`);
  }

  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) {
    // Demo mode: without a secret key, confirm via the demo flow instead
    try {
      finance.completePendingPayment(payment.id);
      return NextResponse.redirect(`${origin}/receipts/${payment.id}`);
    } catch {
      return NextResponse.redirect(`${origin}/billing/${payment.invoiceId ?? ""}?error=verification-failed`);
    }
  }

  try {
    const resp = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    const data = (await resp.json()) as { status: boolean; data?: { status: string; amount: number; reference: string } };
    if (!resp.ok || !data.status || data.data?.status !== "success") {
      finance.failPendingPayment(payment.id, `Gateway verification failed (${data.data?.status ?? "unknown"}). `);
      return NextResponse.redirect(`${origin}/billing/${payment.invoiceId ?? ""}?error=payment-not-successful`);
    }
    // Verify the paid amount matches (amount is in kobo)
    if (data.data.amount !== payment.amount * 100) {
      finance.failPendingPayment(payment.id, "Amount mismatch on gateway verification. ");
      return NextResponse.redirect(`${origin}/billing/${payment.invoiceId ?? ""}?error=amount-mismatch`);
    }
    const result = finance.completePendingPayment(payment.id);
    await notify(await parentUserIdsForStudent(payment.studentId), {
      title: "Online payment successful",
      message: `₦${payment.amount.toLocaleString("en-NG")} received via online payment. Receipt ${result.receiptNumber}.`,
      type: "success",
      link: `/receipts/${payment.id}`,
    });
    return NextResponse.redirect(`${origin}/receipts/${payment.id}`);
  } catch (e) {
    console.error("paystack callback error", e);
    return NextResponse.redirect(`${origin}/billing/${payment.invoiceId ?? ""}?error=verification-error`);
  }
}
