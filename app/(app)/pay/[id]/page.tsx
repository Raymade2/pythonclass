import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Lock, ShieldCheck } from "lucide-react";
import { requireUser, isAdmin } from "@/lib/auth";
import * as finance from "@/lib/repo/finance";
import { formatMoney } from "@/lib/format";
import { SchoolLogo } from "@/components/school-logo";
import { PayDemoActions } from "./pay-demo-actions";

export const metadata = { title: "Secure Checkout" };

export default async function PayPage({ params }: { params: { id: string } }) {
  const user = await requireUser();
  const id = Number(params.id);
  if (!Number.isFinite(id)) notFound();

  const payment = finance.getPaymentById(id);
  if (!payment) notFound();
  if (!isAdmin(user) && payment.recordedByUserId !== user.id) notFound();
  if (payment.status === "SUCCESSFUL") redirect(`/receipts/${id}`);
  if (payment.status !== "PENDING") notFound();

  const invoice = payment.invoiceId ? finance.getInvoiceById(payment.invoiceId) : null;

  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <div className="w-full max-w-md">
        {/* Simulated gateway chrome */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card">
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-5 py-3">
            <div className="flex items-center gap-2">
              <SchoolLogo size={28} />
              <div className="leading-tight">
                <p className="text-xs font-bold text-slate-800">SFGS Pay</p>
                <p className="text-[10px] text-slate-400">Secure Checkout</p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-600">
              <Lock className="h-3 w-3" /> SSL Secured
            </span>
          </div>

          <div className="space-y-4 p-6">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Amount to pay</p>
              <p className="text-3xl font-bold tabular-nums text-slate-900">{formatMoney(payment.amount)}</p>
            </div>

            <dl className="space-y-2 rounded-xl bg-slate-50 p-4 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Student</dt>
                <dd className="font-semibold text-slate-800">{payment.firstName} {payment.lastName}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Invoice</dt>
                <dd className="font-mono text-xs font-semibold text-slate-800">{invoice?.invoiceNumber ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Outstanding before payment</dt>
                <dd className="font-semibold text-slate-800">{formatMoney((invoice?.balance ?? 0) + payment.amount)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Transaction Ref</dt>
                <dd className="font-mono text-[11px] font-semibold text-slate-800">{payment.transactionReference}</dd>
              </div>
            </dl>

            <PayDemoActions paymentId={payment.id} invoiceId={payment.invoiceId} />
          </div>

          <div className="border-t border-slate-100 bg-amber-50/60 px-5 py-3">
            <p className="flex items-start gap-2 text-[11px] leading-relaxed text-amber-700">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Demo gateway simulator. Set PAYSTACK_SECRET_KEY (or FLUTTERWAVE_SECRET_KEY) in the server environment to
              route online checkout through the real gateway — secrets are never exposed to the frontend.
            </p>
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-slate-400">
          Changed your mind?{" "}
          <Link href={payment.invoiceId ? `/billing/${payment.invoiceId}` : "/billing"} className="font-semibold text-brand-600 hover:underline">
            Return to invoice
          </Link>
        </p>
      </div>
    </div>
  );
}
