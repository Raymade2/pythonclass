import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { isAdmin } from "@/lib/auth";
import { getScope } from "@/lib/scope";
import * as finance from "@/lib/repo/finance";
import * as core from "@/lib/repo/core";
import { formatDate, formatDateTime } from "@/lib/format";
import { Card, PageHeader, EmptyState } from "@/components/ui";
import { StatusBadge } from "@/components/badges";
import { SchoolLogo } from "@/components/school-logo";
import { ReceiptActions } from "./receipt-actions";

export const metadata = { title: "Payment Receipt" };

export default async function ReceiptPage({ params }: { params: { id: string } }) {
  const user = await requireUser();
  const id = Number(params.id);
  if (!Number.isFinite(id)) notFound();

  const payment = finance.getPaymentForReceipt(id);
  if (!payment) notFound();
  if (payment.status !== "SUCCESSFUL") {
    return (
      <div className="mx-auto max-w-2xl">
        <Card>
          <EmptyState
            title="Payment not completed"
            message="A receipt is only available once the payment has been confirmed as successful."
          />
        </Card>
      </div>
    );
  }

  // Access control: admins, the recorder, or the student's parent
  const scope = await getScope(user);
  if (!isAdmin(user) && payment.recordedByUserId !== user.id && !(scope.studentIds ?? []).includes(payment.studentId)) {
    notFound();
  }

  const school = core.getSchool();
  const studentName = `${payment.firstName} ${payment.middleName ?? ""} ${payment.lastName}`.trim();
  const previousBalance = (payment.invoiceBalance ?? 0) + payment.amount;
  const remainingBalance = payment.invoiceBalance ?? 0;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader title="Payment Receipt" subtitle={`Receipt ${payment.receiptNumber}`}>
        <Link
          href={payment.invoiceId ? `/billing/${payment.invoiceId}` : "/payments"}
          className="no-print inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
        >
          ← Back
        </Link>
        <ReceiptActions
          receipt={{
            school: { name: school.name, address: school.address, phone: school.phone, email: school.email },
            receiptNumber: payment.receiptNumber ?? "",
            paymentReference: payment.reference,
            transactionReference: payment.transactionReference,
            paymentDate: formatDateTime(payment.paymentDate),
            method: payment.method,
            studentName,
            studentCode: payment.studentCode,
            className: payment.className ?? "—",
            session: payment.sessionName ?? "—",
            term: payment.termName ?? "—",
            invoiceNumber: payment.invoiceNumber,
            description: payment.invoiceNumber ? `School fees payment on invoice ${payment.invoiceNumber}` : "School payment",
            amountPaid: payment.amount,
            previousBalance,
            remainingBalance,
            totalPaid: previousBalance - remainingBalance,
            invoiceTotal: payment.invoiceTotal ?? payment.amount,
            authorizedBy: payment.recordedByName ?? "Bursary",
          }}
        />
      </PageHeader>

      {/* Printable receipt */}
      <div className="print-area overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card">
        <div className="bg-gradient-to-r from-brand-950 to-brand-800 px-6 py-5 text-white">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <SchoolLogo size={48} />
              <div>
                <h2 className="text-base font-bold uppercase tracking-wide sm:text-lg">{school.name}</h2>
                <p className="text-[11px] text-white/70">{school.address}</p>
                <p className="text-[11px] text-white/70">Tel: {school.phone} · {school.email}</p>
              </div>
            </div>
            <div className="hidden text-right sm:block">
              <p className="text-[10px] uppercase tracking-widest text-gold-300">Official Receipt</p>
              <p className="font-mono text-sm font-bold">{payment.receiptNumber}</p>
              <span className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-emerald-400/20 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">
                ✓ PAID
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-5 p-6">
          <div className="sm:hidden">
            <p className="font-mono text-sm font-bold text-slate-800">{payment.receiptNumber}</p>
          </div>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <div>
              <dt className="text-[11px] font-semibold uppercase text-slate-400">Receipt Number</dt>
              <dd className="font-mono font-semibold text-slate-800">{payment.receiptNumber}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase text-slate-400">Payment Date</dt>
              <dd className="font-semibold text-slate-800">{formatDateTime(payment.paymentDate)}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase text-slate-400">Student Name</dt>
              <dd className="font-semibold text-slate-800">{studentName}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase text-slate-400">Student ID</dt>
              <dd className="font-mono text-slate-800">{payment.studentCode}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase text-slate-400">Class</dt>
              <dd className="text-slate-800">{payment.className ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase text-slate-400">Session / Term</dt>
              <dd className="text-slate-800">{payment.sessionName} · {payment.termName}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase text-slate-400">Payment Reference</dt>
              <dd className="font-mono text-slate-800">{payment.reference}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase text-slate-400">Invoice</dt>
              <dd className="text-slate-800">{payment.invoiceNumber ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase text-slate-400">Payment Method</dt>
              <dd className="text-slate-800">{payment.method}{payment.channel ? ` (${payment.channel})` : ""}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase text-slate-400">Transaction Ref</dt>
              <dd className="font-mono text-xs text-slate-800">{payment.transactionReference ?? "—"}</dd>
            </div>
          </dl>

          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4">
            <p className="text-[11px] font-semibold uppercase text-slate-400">Payment Description</p>
            <p className="text-sm text-slate-800">
              {payment.invoiceNumber ? `School fees payment on invoice ${payment.invoiceNumber}` : "School payment"}
            </p>
            {payment.notes && <p className="mt-1 text-xs text-slate-500">Note: {payment.notes}</p>}
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-slate-100">
                <AmountRow label="Previous Balance" value={previousBalance} />
                <AmountRow label="Amount Paid" value={payment.amount} highlight />
                <AmountRow label="Remaining Balance" value={remainingBalance} />
                <AmountRow label="Total Paid to Date (this invoice)" value={previousBalance - remainingBalance} />
                <tr className="bg-brand-50/60">
                  <td className="px-4 py-3 text-sm font-bold text-brand-900">Invoice Total</td>
                  <td className="px-4 py-3 text-right text-sm font-bold tabular-nums text-brand-900">
                    ₦{(payment.invoiceTotal ?? payment.amount).toLocaleString("en-NG")}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="flex items-end justify-between gap-6 pt-4">
            <div>
              <p className="text-xs text-slate-400">Status</p>
              <StatusBadge status={payment.status} />
            </div>
            <div className="text-center">
              <div className="h-10 w-40 border-b border-slate-300" />
              <p className="mt-1 text-xs font-semibold text-slate-600">{payment.recordedByName ?? "Bursary"}</p>
              <p className="text-[10px] text-slate-400">Authorized Officer · {school.shortName}</p>
            </div>
          </div>

          <p className="border-t border-dashed border-slate-200 pt-3 text-center text-[10px] text-slate-400">
            This receipt is computer-generated and valid without a physical signature. · Powered by {school.shortName} School Fee Management System
          </p>
        </div>
      </div>
    </div>
  );
}

function AmountRow({ label, value, highlight = false }: { label: string; value: number; highlight?: boolean }) {
  return (
    <tr className={highlight ? "bg-emerald-50/50" : ""}>
      <td className={`px-4 py-2.5 text-sm ${highlight ? "font-bold text-emerald-800" : "text-slate-600"}`}>{label}</td>
      <td className={`px-4 py-2.5 text-right text-sm tabular-nums ${highlight ? "font-bold text-emerald-800" : "font-semibold text-slate-800"}`}>
        ₦{value.toLocaleString("en-NG")}
      </td>
    </tr>
  );
}
