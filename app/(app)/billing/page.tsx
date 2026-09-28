import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getCurrentAcademic, getScope } from "@/lib/scope";
import * as academics from "@/lib/repo/academics";
import * as finance from "@/lib/repo/finance";
import { formatMoney, formatDate } from "@/lib/format";
import { Card, PageHeader, TableWrap, Th, Td, EmptyState, Pagination, StatCard } from "@/components/ui";
import { StatusBadge } from "@/components/badges";
import { FilterForm, FilterSelect, FilterInput } from "@/components/filter-form";
import { CrudModalButton } from "@/components/crud-modal-button";
import { PrintButton, CsvButton } from "@/components/export-buttons";
import { bulkGenerateInvoicesAction } from "@/app/actions/invoices";
import type { FormField } from "@/components/data-form";
import { Receipt, FileText } from "lucide-react";

export const metadata = { title: "Student Payments / Billing" };

export default async function BillingPage({
  searchParams,
}: {
  searchParams: { q?: string; session?: string; term?: string; class?: string; status?: string; page?: string };
}) {
  const user = await requireUser(["SUPER_ADMIN", "ADMIN", "TEACHER", "PARENT"]);
  const current = await getCurrentAcademic();
  const scope = await getScope(user);
  const isAdminUser = user.role === "SUPER_ADMIN" || user.role === "ADMIN";

  const sessions = academics.listSessions();
  const sessionId = Number(searchParams.session) || current?.session.id || 0;
  const session = sessions.find((s) => s.id === sessionId);
  const terms = session ? academics.listTermsForSession(session.id) : [];
  const termId = Number(searchParams.term) || terms.find((t) => t.isCurrent)?.id || terms[0]?.id || 0;
  const classId = Number(searchParams.class) || 0;
  const status = searchParams.status ?? "";
  const q = (searchParams.q ?? "").trim();
  const page = Math.max(1, Number(searchParams.page) || 1);
  const perPage = 25;

  const classes =
    user.role === "TEACHER" && scope.classIds
      ? academics.listClasses({ status: "ACTIVE" }).filter((c) => scope.classIds.includes(c.id))
      : academics.listClasses({ status: "ACTIVE" });

  const { rows, total } = finance.listInvoices(
    {
      q: q || undefined,
      sessionId,
      termId,
      classId: classId || undefined,
      status: status || undefined,
      studentIds: scope.studentIds,
    },
    perPage,
    (page - 1) * perPage
  );
  const totalPages = Math.max(1, Math.ceil(total / perPage));

  const agg = finance.invoiceAggregates({ sessionId, termId, classId: classId || undefined, studentIds: scope.studentIds });

  const bulkFields: FormField[] = [
    {
      name: "classId", label: "Class", type: "select", required: true,
      options: classes.map((c) => ({ value: String(c.id), label: c.name })),
      section: "Bulk Invoice Generation",
    },
    {
      name: "sessionId", label: "Session", type: "select", required: true, defaultValue: String(sessionId),
      options: sessions.map((s) => ({ value: String(s.id), label: s.name })),
    },
    {
      name: "termId", label: "Term", type: "select", required: true, defaultValue: String(termId),
      options: terms.map((t) => ({ value: String(t.id), label: t.name })),
    },
    {
      name: "confirmNote", label: "How it works", type: "checkbox", defaultValue: false,
      help: "Every student in the class without an existing invoice for the term will be billed all mandatory fee items.",
    },
  ];

  const exportQs = new URLSearchParams({ type: "invoices", session: String(sessionId), term: String(termId), ...(classId ? { class: String(classId) } : {}), ...(status ? { status } : {}), ...(q ? { q } : {}) }).toString();

  return (
    <div className="space-y-5">
      <PageHeader title="Student Payments / Billing" subtitle={`${total} invoice(s) for ${session?.name ?? ""} — ${terms.find((t) => t.id === termId)?.name ?? ""}`}>
        <PrintButton label="Print List" />
        {isAdminUser && <CsvButton url={`/api/export?${exportQs}`} label="Export CSV" />}
        {isAdminUser && (
          <CrudModalButton
            label="Bulk-Generate for Class"
            variant="ghost"
            title="Bulk-Generate Invoices"
            subtitle="Generate termly fee invoices for every student in a class"
            fields={bulkFields}
            action={bulkGenerateInvoicesAction}
            submitLabel="Generate Invoices"
          />
        )}
        <Link
          href="/billing/new"
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-brand-700"
        >
          <FileText className="h-3.5 w-3.5" /> Generate Invoice
        </Link>
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Expected" value={formatMoney(agg.expected)} icon={<Receipt className="h-5 w-5" />} tone="slate" />
        <StatCard label="Collected" value={formatMoney(agg.collected)} icon={<Receipt className="h-5 w-5" />} tone="green" />
        <StatCard label="Outstanding" value={formatMoney(agg.outstanding)} icon={<Receipt className="h-5 w-5" />} tone="amber" />
        <StatCard label="Debtors" value={String(agg.debtors)} icon={<Receipt className="h-5 w-5" />} tone="red" />
      </div>

      <FilterForm basePath="/billing">
        <FilterInput name="q" label="Search" defaultValue={q} placeholder="Invoice no, student name or ID…" />
        <FilterSelect name="session" label="Session" defaultValue={String(sessionId)} allLabel="—" options={sessions.map((s) => ({ value: String(s.id), label: s.name }))} />
        <FilterSelect name="term" label="Term" defaultValue={String(termId)} allLabel="—" options={terms.map((t) => ({ value: String(t.id), label: t.name }))} />
        <FilterSelect name="class" label="Class" defaultValue={classId ? String(classId) : ""} options={classes.map((c) => ({ value: String(c.id), label: c.name }))} />
        <FilterSelect
          name="status" label="Status" defaultValue={status}
          options={["UNPAID", "PARTIALLY_PAID", "FULLY_PAID", "OVERDUE", "CANCELLED"].map((s) => ({ value: s, label: s.replace(/_/g, " ") }))}
        />
      </FilterForm>

      <Card>
        {rows.length === 0 ? (
          <EmptyState title="No invoices found" message="Generate an invoice for a student or adjust your filters." />
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <Th>Invoice</Th>
                <Th>Student</Th>
                <Th>Class</Th>
                <Th>Session / Term</Th>
                <Th className="num">Total</Th>
                <Th className="num">Paid</Th>
                <Th className="num">Balance</Th>
                <Th>Due Date</Th>
                <Th>Status</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((inv) => (
                <tr key={inv.id} className="hover:bg-slate-50/60">
                  <Td>
                    <Link href={`/billing/${inv.id}`} className="font-semibold text-brand-700 hover:underline">{inv.invoiceNumber}</Link>
                    <span className="block text-[11px] text-slate-400">{formatDate(inv.createdAt)}</span>
                  </Td>
                  <Td>
                    <Link href={`/students/${inv.studentId}`} className="font-medium text-slate-800 hover:text-brand-700">
                      {inv.firstName} {inv.middleName ?? ""} {inv.lastName}
                    </Link>
                    <span className="block text-[11px] text-slate-400">{inv.studentCode}</span>
                  </Td>
                  <Td>{inv.className ?? "—"}</Td>
                  <Td className="whitespace-nowrap text-xs">{inv.sessionName} · {inv.termName}</Td>
                  <Td className="num font-semibold">{formatMoney(inv.totalAmount)}</Td>
                  <Td className="num text-emerald-600">{formatMoney(inv.amountPaid)}</Td>
                  <Td className="num font-semibold text-amber-600">{formatMoney(inv.balance)}</Td>
                  <Td className="whitespace-nowrap text-xs">{formatDate(inv.dueDate)}</Td>
                  <Td><StatusBadge status={inv.status} /></Td>
                  <Td className="text-right">
                    <Link href={`/billing/${inv.id}`} className="text-xs font-semibold text-brand-600 hover:underline">
                      {inv.balance > 0 && inv.status !== "CANCELLED" ? "Pay / View →" : "View →"}
                    </Link>
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}
        <Pagination
          page={page}
          totalPages={totalPages}
          baseParams={{ q, session: String(sessionId), term: String(termId), class: classId ? String(classId) : "", status }}
        />
      </Card>
    </div>
  );
}
