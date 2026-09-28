import Link from "next/link";
import { notFound } from "next/navigation";
import { Printer, Ban } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getScope } from "@/lib/scope";
import * as finance from "@/lib/repo/finance";
import { formatDate, formatDateTime, toISODateInput } from "@/lib/format";
import { Card, PageHeader, TableWrap, Th, Td, EmptyState } from "@/components/ui";
import { StatusBadge, Avatar } from "@/components/badges";
import { CrudModalButton } from "@/components/crud-modal-button";
import { ConfirmActionButton } from "@/components/confirm-button";
import { PrintButton } from "@/components/export-buttons";
import { PayOnlineButton } from "@/components/pay-online-button";
import { recordPaymentAction } from "@/app/actions/payments";
import { cancelInvoiceAction } from "@/app/actions/invoices";
import type { FormField } from "@/components/data-form";
import { OFFLINE_METHODS } from "@/lib/constants";

export const metadata = { title: "Invoice" };

export default async function InvoiceDetailPage({ params }: { params: { id: string } }) {
  const user = await requireUser(["SUPER_ADMIN", "ADMIN", "TEACHER", "PARENT"]);
  const id = Number(params.id);
  if (!Number.isFinite(id)) notFound();

  const invoice = finance.getInvoiceDetail(id);
  if (!invoice) notFound();

  // Access control
  const scope = await getScope(user);
  if (scope.studentIds !== null && !scope.studentIds.includes(invoice.studentId)) notFound();

  const canRecord = (user.role === "SUPER_ADMIN" || user.role === "ADMIN" || user.role === "TEACHER") && invoice.status !== "CANCELLED" && invoice.balance > 0;
  const isAdminUser = user.role === "SUPER_ADMIN" || user.role === "ADMIN";

  const recordFields: FormField[] = [
    {
      name: "amount", label: `Amount (₦) — outstanding ${invoice.balance.toLocaleString("en-NG")}`, type: "number",
      required: true, min: 1, defaultValue: invoice.balance, section: "Payment Details",
      help: "Partial payments are supported — the balance is recalculated automatically",
    },
    {
      name: "method", label: "Payment Method", type: "select", required: true, defaultValue: "Cash",
      options: OFFLINE_METHODS.map((m) => ({ value: m, label: m })),
    },
    { name: "transactionReference", label: "Transaction / Reference No.", type: "text", placeholder: "e.g. teller number or transfer ref", help: "Used to prevent duplicate payments" },
    { name: "paymentDate", label: "Payment Date", type: "date", defaultValue: toISODateInput(new Date()) },
    { name: "notes", label: "Notes", type: "textarea", colSpan: 2 },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <PageHeader
        title={`Invoice ${invoice.invoiceNumber}`}
        subtitle={`${invoice.sessionName} · ${invoice.termName} · Generated ${formatDate(invoice.createdAt)} by ${invoice.generatedByName ?? "System"}`}
      >
        <PrintButton label="Print Invoice" />
        {invoice.balance > 0 && invoice.status !== "CANCELLED" && <PayOnlineButton invoiceId={invoice.id} balance={invoice.balance} />}
        {canRecord && (
          <CrudModalButton
            label="Record Payment"
            title="Record Offline Payment"
            subtitle={`Invoice ${invoice.invoiceNumber} · Outstanding ₦${invoice.balance.toLocaleString("en-NG")}`}
            fields={recordFields}
            action={recordPaymentAction}
            hidden={{ invoiceId: invoice.id }}
            submitLabel="Record Payment"
          />
        )}
        {isAdminUser && invoice.status !== "CANCELLED" && invoice.amountPaid === 0 && (
          <ConfirmActionButton
            action={cancelInvoiceAction}
            payload={{ id: invoice.id }}
            label="Cancel Invoice"
            confirmTitle={`Cancel invoice ${invoice.invoiceNumber}?`}
            confirmMessage="The invoice will be marked cancelled. The parent will be notified."
            confirmLabel="Cancel Invoice"
            className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50"
          />
        )}
      </PageHeader>

      {/* Status banner */}
      <div className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4 ${
        invoice.status === "FULLY_PAID" ? "border-emerald-200 bg-emerald-50"
        : invoice.status === "OVERDUE" ? "border-red-200 bg-red-50"
        : invoice.status === "PARTIALLY_PAID" ? "border-amber-200 bg-amber-50"
        : invoice.status === "CANCELLED" ? "border-slate-200 bg-slate-50"
        : "border-slate-200 bg-white"
      }`}>
        <div className="flex items-center gap-3">
          <StatusBadge status={invoice.status} />
          <div className="text-sm">
            {invoice.status === "FULLY_PAID" && <p className="font-semibold text-emerald-700">This invoice has been fully paid. Thank you!</p>}
            {invoice.status === "PARTIALLY_PAID" && <p className="text-amber-800">Part payment received — outstanding balance: <strong>₦{invoice.balance.toLocaleString("en-NG")}</strong></p>}
            {invoice.status === "OVERDUE" && <p className="font-semibold text-red-700">This invoice is overdue — outstanding: ₦{invoice.balance.toLocaleString("en-NG")}</p>}
            {invoice.status === "UNPAID" && <p className="text-slate-600">Payment due by {formatDate(invoice.dueDate)}</p>}
            {invoice.status === "CANCELLED" && <p className="text-slate-500">This invoice has been cancelled.</p>}
          </div>
        </div>
        <p className="text-xs text-slate-500">Due date: <strong>{formatDate(invoice.dueDate)}</strong></p>
      </div>

      {/* Student card */}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div className="flex items-center gap-4">
            <Avatar name={`${invoice.firstName} ${invoice.lastName}`} size="lg" />
            <div>
              <Link href={`/students/${invoice.studentId}`} className="text-lg font-bold text-slate-900 hover:text-brand-700">
                {invoice.firstName} {invoice.middleName ?? ""} {invoice.lastName}
              </Link>
              <p className="text-xs text-slate-500">
                {invoice.studentCode} · {invoice.className ?? "No class"} · {invoice.gender}
              </p>
              {invoice.parentName && (
                <p className="text-xs text-slate-400">Parent: {invoice.parentName} ({invoice.parentPhone})</p>
              )}
            </div>
          </div>
          <div className="text-right">
            <p className="text-[11px] font-semibold uppercase text-slate-400">Invoice Total</p>
            <p className="text-2xl font-bold tabular-nums text-brand-800">₦{invoice.totalAmount.toLocaleString("en-NG")}</p>
          </div>
        </div>
      </Card>

      {/* Items */}
      <Card title="Invoice Items" subtitle={`${invoice.items.length} item(s)`}>
        <TableWrap>
          <thead>
            <tr>
              <Th>Description</Th>
              <Th className="num">Quantity</Th>
              <Th className="num">Amount</Th>
              <Th className="num">Line Total</Th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((it) => (
              <tr key={it.id}>
                <Td className="font-medium text-slate-800">{it.description}</Td>
                <Td className="num">{it.quantity}</Td>
                <Td className="num">₦{it.amount.toLocaleString("en-NG")}</Td>
                <Td className="num font-semibold">₦{(it.amount * it.quantity).toLocaleString("en-NG")}</Td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-slate-50/80">
              <Td className="font-semibold">Total</Td>
              <Td />
              <Td />
              <Td className="num font-bold text-brand-800">₦{invoice.totalAmount.toLocaleString("en-NG")}</Td>
            </tr>
            <tr>
              <Td className="font-semibold text-emerald-700">Amount Paid</Td>
              <Td /><Td />
              <Td className="num font-bold text-emerald-700">₦{invoice.amountPaid.toLocaleString("en-NG")}</Td>
            </tr>
            <tr>
              <Td className={`font-semibold ${invoice.balance > 0 ? "text-amber-700" : "text-emerald-700"}`}>Outstanding Balance</Td>
              <Td /><Td />
              <Td className={`num font-bold ${invoice.balance > 0 ? "text-amber-700" : "text-emerald-700"}`}>
                ₦{invoice.balance.toLocaleString("en-NG")}
              </Td>
            </tr>
          </tfoot>
        </TableWrap>
      </Card>

      {/* Payments on this invoice */}
      <Card title="Payments on this Invoice" subtitle="Multiple partial payments are supported">
        {invoice.payments.length === 0 ? (
          <EmptyState title="No payments yet" message="When a payment is recorded it will appear here with its receipt." />
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <Th>Payment Ref</Th>
                <Th>Receipt No.</Th>
                <Th className="num">Amount</Th>
                <Th>Method</Th>
                <Th>Date</Th>
                <Th>Recorded By</Th>
                <Th>Status</Th>
                <Th className="text-right"></Th>
              </tr>
            </thead>
            <tbody>
              {invoice.payments.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50/60">
                  <Td className="font-mono text-xs">{p.reference}</Td>
                  <Td>
                    {p.receiptNumber ? (
                      <Link href={`/receipts/${p.id}`} className="text-xs font-semibold text-brand-600 hover:underline">{p.receiptNumber}</Link>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </Td>
                  <Td className="num font-semibold">₦{p.amount.toLocaleString("en-NG")}</Td>
                  <Td className="text-xs">
                    {p.method}
                    {p.channel && <span className="block text-[10px] uppercase text-slate-400">{p.channel}</span>}
                  </Td>
                  <Td className="whitespace-nowrap text-xs">{formatDateTime(p.paymentDate)}</Td>
                  <Td className="text-xs text-slate-500">{p.recordedByName ?? "—"}</Td>
                  <Td><StatusBadge status={p.status} /></Td>
                  <Td className="text-right">
                    {p.status === "SUCCESSFUL" && (
                      <Link href={`/receipts/${p.id}`} className="text-xs font-semibold text-brand-600 hover:underline">Receipt →</Link>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}
      </Card>
    </div>
  );
}
