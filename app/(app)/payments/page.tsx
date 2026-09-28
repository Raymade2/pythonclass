import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getCurrentAcademic, getScope } from "@/lib/scope";
import * as academics from "@/lib/repo/academics";
import * as finance from "@/lib/repo/finance";
import { formatMoney, formatDate } from "@/lib/format";
import { Card, PageHeader, TableWrap, Th, Td, EmptyState, Pagination, StatCard } from "@/components/ui";
import { StatusBadge } from "@/components/badges";
import { FilterForm, FilterSelect, FilterInput } from "@/components/filter-form";
import { PrintButton, CsvButton } from "@/components/export-buttons";
import { CreditCard, Wallet, CheckCircle2, Clock } from "lucide-react";

export const metadata = { title: "Payment History" };

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: {
    q?: string; session?: string; term?: string; class?: string; method?: string; status?: string;
    from?: string; to?: string; page?: string;
  };
}) {
  const user = await requireUser(["SUPER_ADMIN", "ADMIN", "TEACHER", "PARENT"]);
  const current = await getCurrentAcademic();
  const scope = await getScope(user);

  const sessions = academics.listSessions();
  const sessionId = Number(searchParams.session) || current?.session.id || 0;
  const session = sessions.find((s) => s.id === sessionId);
  const terms = session ? academics.listTermsForSession(session.id) : [];
  const termId = Number(searchParams.term) || 0;
  const classId = Number(searchParams.class) || 0;
  const method = searchParams.method ?? "";
  const status = searchParams.status ?? "";
  const q = (searchParams.q ?? "").trim();
  const from = searchParams.from ?? "";
  const to = searchParams.to ?? "";
  const page = Math.max(1, Number(searchParams.page) || 1);
  const perPage = 25;

  const classes =
    user.role === "TEACHER" && scope.classIds
      ? academics.listClasses({ status: "ACTIVE" }).filter((c) => scope.classIds.includes(c.id))
      : academics.listClasses({ status: "ACTIVE" });

  const filter: finance.PaymentFilter = {
    q: q || undefined,
    sessionId: sessionId || undefined,
    termId: termId || undefined,
    classId: classId || undefined,
    method: method || undefined,
    status: status || undefined,
    from: from || undefined,
    to: to || undefined,
    studentIds: scope.studentIds,
  };

  const { rows, total } = finance.listPayments(filter, perPage, (page - 1) * perPage);
  const totalPages = Math.max(1, Math.ceil(total / perPage));

  const successTotal = rows.filter((r) => r.status === "SUCCESSFUL").reduce((s, r) => s + r.amount, 0);
  const successfulCount = finance.listPayments({ ...filter, status: "SUCCESSFUL" }, 1, 0).total;
  const pendingCount = finance.listPayments({ ...filter, status: "PENDING" }, 1, 0).total;
  const totalCollected = finance.paymentsThisMonth(filter);
  void successfulCount;

  const exportQs = new URLSearchParams({
    type: "payments",
    ...(sessionId ? { session: String(sessionId) } : {}),
    ...(termId ? { term: String(termId) } : {}),
    ...(classId ? { class: String(classId) } : {}),
    ...(method ? { method } : {}),
    ...(status ? { status } : {}),
    ...(q ? { q } : {}),
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
  }).toString();

  return (
    <div className="space-y-5">
      <PageHeader title="Payment History" subtitle={`${total} payment record(s)`}>
        <PrintButton label="Print" />
        {(user.role === "SUPER_ADMIN" || user.role === "ADMIN") && <CsvButton url={`/api/export?${exportQs}`} />}
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Records" value={String(total)} icon={<CreditCard className="h-5 w-5" />} tone="blue" />
        <StatCard label="This Page" value={formatMoney(successTotal)} hint="Successful amounts on this page" icon={<Wallet className="h-5 w-5" />} tone="green" />
        <StatCard label="Pending" value={String(pendingCount)} hint="Awaiting confirmation" icon={<Clock className="h-5 w-5" />} tone="amber" />
        <StatCard label="This Month" value={formatMoney(totalCollected)} icon={<CheckCircle2 className="h-5 w-5" />} tone="green" />
      </div>

      <FilterForm basePath="/payments">
        <FilterInput name="q" label="Search" defaultValue={q} placeholder="Reference, receipt or student…" />
        <FilterSelect name="session" label="Session" defaultValue={sessionId ? String(sessionId) : ""} options={sessions.map((s) => ({ value: String(s.id), label: s.name }))} />
        <FilterSelect name="term" label="Term" defaultValue={termId ? String(termId) : ""} options={terms.map((t) => ({ value: String(t.id), label: t.name }))} />
        <FilterSelect name="class" label="Class" defaultValue={classId ? String(classId) : ""} options={classes.map((c) => ({ value: String(c.id), label: c.name }))} />
        <FilterSelect name="method" label="Method" defaultValue={method} options={["Cash", "Bank Transfer", "POS", "Cheque", "Online", "Other"].map((m) => ({ value: m, label: m }))} />
        <FilterSelect name="status" label="Status" defaultValue={status} options={["SUCCESSFUL", "PENDING", "FAILED", "ABANDONED"].map((s) => ({ value: s, label: s }))} />
        <FilterInput name="from" label="From" type="date" defaultValue={from} />
        <FilterInput name="to" label="To" type="date" defaultValue={to} />
      </FilterForm>

      <Card>
        {rows.length === 0 ? (
          <EmptyState title="No payments found" message="Adjust your filters to see more results." />
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <Th>Payment Ref</Th>
                <Th>Receipt No.</Th>
                <Th>Student</Th>
                <Th>Class</Th>
                <Th>Invoice</Th>
                <Th className="num">Amount</Th>
                <Th>Method</Th>
                <Th>Date</Th>
                <Th>Recorded By</Th>
                <Th>Status</Th>
                <Th className="text-right"></Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50/60">
                  <Td className="font-mono text-xs">{p.reference}</Td>
                  <Td>
                    {p.receiptNumber ? (
                      <Link href={`/receipts/${p.id}`} className="text-xs font-semibold text-brand-600 hover:underline">{p.receiptNumber}</Link>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </Td>
                  <Td>
                    <Link href={`/students/${p.studentId}`} className="font-medium text-slate-800 hover:text-brand-700">
                      {p.firstName} {p.lastName}
                    </Link>
                    <span className="block text-[11px] text-slate-400">{p.studentCode}</span>
                  </Td>
                  <Td>{p.className ?? "—"}</Td>
                  <Td>
                    {p.invoiceNumber ? (
                      <Link href={`/billing/${p.invoiceId}`} className="text-xs font-medium text-brand-600 hover:underline">{p.invoiceNumber}</Link>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </Td>
                  <Td className="num font-semibold">{formatMoney(p.amount)}</Td>
                  <Td className="text-xs">
                    {p.method}
                    {p.channel && <span className="block text-[10px] uppercase text-slate-400">{p.channel}</span>}
                  </Td>
                  <Td className="whitespace-nowrap text-xs">{formatDate(p.paymentDate)}</Td>
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
        <Pagination
          page={page}
          totalPages={totalPages}
          baseParams={{
            q, session: sessionId ? String(sessionId) : "", term: termId ? String(termId) : "",
            class: classId ? String(classId) : "", method, status, from, to,
          }}
        />
      </Card>
    </div>
  );
}
