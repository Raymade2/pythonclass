import Link from "next/link";
import { redirect } from "next/navigation";
import { GraduationCap, Wallet, AlertTriangle, ReceiptText, ArrowRight, FileText } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getCurrentAcademic } from "@/lib/scope";
import * as people from "@/lib/repo/people";
import * as finance from "@/lib/repo/finance";
import { formatMoney, formatDate } from "@/lib/format";
import { Card, PageHeader, TableWrap, Th, Td, EmptyState, StatCard } from "@/components/ui";
import { StatusBadge, Avatar } from "@/components/badges";
import { PayOnlineButton } from "@/components/pay-online-button";

export const metadata = { title: "Parent Portal" };

export default async function PortalPage() {
  const user = await requireUser();
  if (user.role !== "PARENT") redirect("/dashboard");
  if (!user.parentId) {
    return (
      <Card>
        <EmptyState title="No linked students" message="Your account is not linked to any student yet. Contact the school office." />
      </Card>
    );
  }

  const current = await getCurrentAcademic();
  const children = people.studentsForParent(user.parentId);

  const childrenData = children.map((child) => {
    const summary = finance.studentFinancialSummary(child.id, current?.session.id, current?.term.id);
    const invoices = finance
      .invoicesForStudent(child.id, current?.session.id, current?.term.id)
      .filter((i) => i.status !== "CANCELLED");
    const outstandingInvoices = invoices.filter((i) => i.balance > 0);
    const payments = finance.paymentsForStudent(child.id).filter((p) => p.status === "SUCCESSFUL").slice(0, 5);
    return { child, summary, invoices, outstandingInvoices, payments };
  });

  const totalOutstanding = childrenData.reduce((s, c) => s + c.summary.outstanding, 0);
  const totalPaid = childrenData.reduce((s, c) => s + c.summary.totalPaid, 0);
  const totalCharges = childrenData.reduce((s, c) => s + c.summary.totalCharges, 0);

  return (
    <div className="space-y-5">
      <PageHeader
        title={`Welcome, ${user.name}`}
        subtitle={`${current?.session.name ?? ""} · ${current?.term.name ?? ""} — your wards' fees at a glance`}
      >
        <Link
          href="/billing/new"
          className="inline-flex items-center gap-1.5 rounded-lg bg-gold-500 px-3.5 py-2 text-xs font-bold text-brand-950 shadow-sm transition hover:bg-gold-400"
        >
          <FileText className="h-3.5 w-3.5" /> Generate Payment Invoice
        </Link>
      </PageHeader>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="Total Charges" value={formatMoney(totalCharges)} hint={`${children.length} ward(s)`} icon={<ReceiptText className="h-5 w-5" />} tone="slate" />
        <StatCard label="Total Paid" value={formatMoney(totalPaid)} icon={<Wallet className="h-5 w-5" />} tone="green" />
        <StatCard label="Outstanding Balance" value={formatMoney(totalOutstanding)} icon={<AlertTriangle className="h-5 w-5" />} tone={totalOutstanding > 0 ? "red" : "green"} />
      </div>

      {/* Children */}
      {childrenData.map(({ child, summary, invoices, outstandingInvoices, payments }) => (
        <div key={child.id} className="space-y-4">
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-4 p-5">
              <div className="flex items-center gap-4">
                <Avatar name={`${child.firstName} ${child.lastName}`} size="lg" />
                <div>
                  <Link href={`/students/${child.id}`} className="text-lg font-bold text-slate-900 hover:text-brand-700">
                    {child.firstName} {child.middleName ?? ""} {child.lastName}
                  </Link>
                  <p className="text-xs text-slate-500">
                    {child.studentCode} · {child.className ?? "No class"} · <StatusBadge status={child.status} />
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-6">
                <div className="text-center">
                  <p className="text-[11px] font-semibold uppercase text-slate-400">Charges</p>
                  <p className="text-lg font-bold tabular-nums text-slate-800">{formatMoney(summary.totalCharges)}</p>
                </div>
                <div className="text-center">
                  <p className="text-[11px] font-semibold uppercase text-emerald-500">Paid</p>
                  <p className="text-lg font-bold tabular-nums text-emerald-700">{formatMoney(summary.totalPaid)}</p>
                </div>
                <div className="text-center">
                  <p className="text-[11px] font-semibold uppercase text-amber-500">Outstanding</p>
                  <p className="text-lg font-bold tabular-nums text-amber-700">{formatMoney(summary.outstanding)}</p>
                </div>
                <Link
                  href={`/students/${child.id}`}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-brand-700 transition hover:border-brand-300"
                >
                  <GraduationCap className="h-3.5 w-3.5" /> Profile
                </Link>
              </div>
            </div>
          </Card>

          <div className="grid gap-4 xl:grid-cols-2">
            <Card title="Current Bills" subtitle={`${invoices.length} invoice(s) this term`}>
              {invoices.length === 0 ? (
                <EmptyState title="No bills this term" message="Generate an invoice to view and pay your ward's fees." />
              ) : (
                <TableWrap>
                  <thead>
                    <tr>
                      <Th>Invoice</Th>
                      <Th className="num">Total</Th>
                      <Th className="num">Balance</Th>
                      <Th>Due Date</Th>
                      <Th>Status</Th>
                      <Th className="text-right">Action</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((inv) => (
                      <tr key={inv.id} className="hover:bg-slate-50/60">
                        <Td>
                          <Link href={`/billing/${inv.id}`} className="font-semibold text-brand-700 hover:underline">{inv.invoiceNumber}</Link>
                          <span className="block text-[11px] text-slate-400">{formatDate(inv.createdAt)}</span>
                        </Td>
                        <Td className="num">{formatMoney(inv.totalAmount)}</Td>
                        <Td className="num font-semibold">{formatMoney(inv.balance)}</Td>
                        <Td className="whitespace-nowrap text-xs">{formatDate(inv.dueDate)}</Td>
                        <Td><StatusBadge status={inv.status} /></Td>
                        <Td className="text-right">
                          {inv.balance > 0 ? (
                            <div className="flex justify-end gap-1.5">
                              <PayOnlineButton invoiceId={inv.id} balance={inv.balance} compact />
                              <Link
                                href={`/billing/${inv.id}`}
                                className="inline-flex items-center rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-brand-700 transition hover:border-brand-300"
                              >
                                Details
                              </Link>
                            </div>
                          ) : (
                            <Link href={`/billing/${inv.id}`} className="text-xs font-semibold text-emerald-600 hover:underline">
                              Paid ✓
                            </Link>
                          )}
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </TableWrap>
              )}
            </Card>

            <Card title="Recent Payments" subtitle="Latest receipts">
              {payments.length === 0 ? (
                <EmptyState title="No payments yet" />
              ) : (
                <TableWrap>
                  <thead>
                    <tr>
                      <Th>Date</Th>
                      <Th>Invoice</Th>
                      <Th className="num">Amount</Th>
                      <Th>Method</Th>
                      <Th className="text-right">Receipt</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50/60">
                        <Td className="whitespace-nowrap text-xs">{formatDate(p.paymentDate)}</Td>
                        <Td className="font-mono text-xs">{p.invoiceNumber ?? "—"}</Td>
                        <Td className="num font-semibold">{formatMoney(p.amount)}</Td>
                        <Td className="text-xs">{p.method}</Td>
                        <Td className="text-right">
                          <Link href={`/receipts/${p.id}`} className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:underline">
                            {p.receiptNumber} <ArrowRight className="h-3 w-3" />
                          </Link>
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </TableWrap>
              )}
            </Card>
          </div>
        </div>
      ))}
    </div>
  );
}
