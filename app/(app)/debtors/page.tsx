import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getCurrentAcademic, getScope } from "@/lib/scope";
import * as academics from "@/lib/repo/academics";
import * as finance from "@/lib/repo/finance";
import { formatMoney, formatDate, daysOverdue } from "@/lib/format";
import { Card, PageHeader, TableWrap, Th, Td, EmptyState, Pagination, StatCard } from "@/components/ui";
import { StatusBadge } from "@/components/badges";
import { FilterForm, FilterSelect, FilterInput } from "@/components/filter-form";
import { PrintButton, CsvButton, PdfButton } from "@/components/export-buttons";
import { ConfirmActionButton } from "@/components/confirm-button";
import { sendPaymentReminderAction } from "@/app/actions/payments";
import { AlertTriangle, Users, Wallet, BellRing } from "lucide-react";

export const metadata = { title: "Debtors" };

export default async function DebtorsPage({
  searchParams,
}: {
  searchParams: {
    q?: string; session?: string; term?: string; class?: string; group?: string;
    dueBefore?: string; minOutstanding?: string; page?: string;
  };
}) {
  const user = await requireUser(["SUPER_ADMIN", "ADMIN", "TEACHER"]);
  const current = await getCurrentAcademic();
  const scope = await getScope(user);

  const sessions = academics.listSessions();
  const sessionId = Number(searchParams.session) || current?.session.id || 0;
  const session = sessions.find((s) => s.id === sessionId);
  const terms = session ? academics.listTermsForSession(session.id) : [];
  const termId = Number(searchParams.term) || terms.find((t) => t.isCurrent)?.id || terms[0]?.id || 0;
  const classId = Number(searchParams.class) || 0;
  const groupId = Number(searchParams.group) || 0;
  const q = (searchParams.q ?? "").trim();
  const dueBefore = searchParams.dueBefore ?? "";
  const minOutstanding = searchParams.minOutstanding ?? "";
  const page = Math.max(1, Number(searchParams.page) || 1);
  const perPage = 25;

  const groups = academics.listClassGroups();
  const classes =
    user.role === "TEACHER" && scope.classIds
      ? academics.listClasses({ status: "ACTIVE" }).filter((c) => scope.classIds.includes(c.id))
      : academics.listClasses({ status: "ACTIVE" });

  const { rows, total } = finance.debtorRows(
    {
      q: q || undefined,
      sessionId,
      termId,
      classId: classId || undefined,
      classGroupId: groupId || undefined,
      studentIds: scope.studentIds,
      ...(dueBefore ? {} : {}),
    },
    perPage,
    (page - 1) * perPage
  );

  // Client-side extras for due date / minimum filters (kept simple & correct)
  const filtered = rows.filter((r) => {
    if (dueBefore && (!r.dueDate || new Date(r.dueDate) > new Date(dueBefore))) return false;
    if (minOutstanding && r.outstanding < Number(minOutstanding)) return false;
    return true;
  });

  const summary = finance.debtorRows(
    { sessionId, termId, classId: classId || undefined, classGroupId: groupId || undefined, studentIds: scope.studentIds },
    0
  );
  const totalOutstanding = summary.rows.reduce((s, r) => s + r.outstanding, 0);

  const exportQs = new URLSearchParams({
    type: "debtors", session: String(sessionId), term: String(termId),
    ...(classId ? { class: String(classId) } : {}), ...(groupId ? { group: String(groupId) } : {}),
    ...(q ? { q } : {}), ...(dueBefore ? { dueBefore } : {}), ...(minOutstanding ? { minOutstanding } : {}),
  }).toString();

  const csvColumns = ["Student", "Student ID", "Class", "Parent", "Phone", "Total Bill", "Paid", "Outstanding", "Due Date", "Days Overdue"];
  const csvRows = () =>
    filtered.map((d) => [
      `${d.firstName} ${d.middleName ?? ""} ${d.lastName}`.trim(),
      d.studentCode,
      d.className ?? "",
      d.parentName ?? "",
      d.parentPhone ?? "",
      d.totalBill,
      d.totalPaid,
      d.outstanding,
      d.dueDate ? formatDate(d.dueDate) : "",
      daysOverdue(d.dueDate),
    ]);

  return (
    <div className="space-y-5">
      <PageHeader title="Debtors" subtitle="Students with outstanding balances">
        <PrintButton label="Print" />
        <CsvButton url={`/api/export?${exportQs}`} />
        <PdfButton spec={{ title: "Debtors Report", subtitle: `${session?.name ?? ""} — ${terms.find((t) => t.id === termId)?.name ?? ""}`, columns: csvColumns, rows: csvRows() }} filename="sfgs-debtors.pdf" />
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total Debtors" value={String(summary.total)} icon={<Users className="h-5 w-5" />} tone="red" />
        <StatCard label="Total Outstanding" value={formatMoney(totalOutstanding)} icon={<Wallet className="h-5 w-5" />} tone="amber" />
        <StatCard label="Total Billed" value={formatMoney(summary.rows.reduce((s, r) => s + r.totalBill, 0))} icon={<Wallet className="h-5 w-5" />} tone="slate" />
        <StatCard
          label="Overdue Debtors"
          value={String(summary.rows.filter((r) => daysOverdue(r.dueDate) > 0).length)}
          icon={<AlertTriangle className="h-5 w-5" />}
          tone="red"
        />
      </div>

      <FilterForm basePath="/debtors">
        <FilterInput name="q" label="Search" defaultValue={q} placeholder="Student name or ID…" />
        <FilterSelect name="session" label="Session" defaultValue={String(sessionId)} allLabel="—" options={sessions.map((s) => ({ value: String(s.id), label: s.name }))} />
        <FilterSelect name="term" label="Term" defaultValue={String(termId)} allLabel="—" options={terms.map((t) => ({ value: String(t.id), label: t.name }))} />
        <FilterSelect name="class" label="Class" defaultValue={classId ? String(classId) : ""} options={classes.map((c) => ({ value: String(c.id), label: c.name }))} />
        <FilterSelect name="group" label="Class Group" defaultValue={groupId ? String(groupId) : ""} options={groups.map((g) => ({ value: String(g.id), label: g.name }))} />
        <FilterInput name="dueBefore" label="Due On / Before" type="date" defaultValue={dueBefore} />
        <FilterInput name="minOutstanding" label="Min. Outstanding (₦)" type="number" defaultValue={minOutstanding} placeholder="e.g. 50000" />
      </FilterForm>

      <Card>
        {filtered.length === 0 ? (
          <EmptyState title="No debtors 🎉" message="All students have settled their bills for the selected period." />
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <Th>Student</Th>
                <Th>Student ID</Th>
                <Th>Class</Th>
                <Th>Parent / Guardian</Th>
                <Th className="num">Total Bill</Th>
                <Th className="num">Paid</Th>
                <Th className="num">Outstanding</Th>
                <Th>Due Date</Th>
                <Th className="num">Days Overdue</Th>
                <Th>Status</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((d) => {
                const overdueDays = daysOverdue(d.dueDate);
                return (
                  <tr key={d.studentId} className="hover:bg-slate-50/60">
                    <Td>
                      <Link href={`/students/${d.studentId}`} className="font-semibold text-slate-800 hover:text-brand-700">
                        {d.firstName} {d.middleName ?? ""} {d.lastName}
                      </Link>
                      <span className="block text-[11px] text-slate-400">{d.admissionNumber}</span>
                    </Td>
                    <Td className="font-mono text-xs">{d.studentCode}</Td>
                    <Td>{d.className ?? "—"}</Td>
                    <Td>
                      <p className="text-xs font-medium text-slate-700">{d.parentName ?? "—"}</p>
                      <p className="text-[11px] text-slate-400">{d.parentPhone ?? ""}</p>
                    </Td>
                    <Td className="num">{formatMoney(d.totalBill)}</Td>
                    <Td className="num text-emerald-600">{formatMoney(d.totalPaid)}</Td>
                    <Td className="num font-bold text-red-600">{formatMoney(d.outstanding)}</Td>
                    <Td className="whitespace-nowrap text-xs">{formatDate(d.dueDate)}</Td>
                    <Td className="num">
                      {overdueDays > 0 ? (
                        <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-bold text-red-600">{overdueDays}</span>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </Td>
                    <Td><StatusBadge status={overdueDays > 0 ? "OVERDUE" : "PARTIALLY_PAID"} /></Td>
                    <Td className="text-right">
                      <div className="flex justify-end gap-1.5">
                        <ConfirmActionButton
                          action={sendPaymentReminderAction}
                          payload={{ studentId: d.studentId }}
                          label="Remind"
                          confirmTitle="Send payment reminder?"
                          confirmMessage={`A reminder about the outstanding ${formatMoney(d.outstanding)} will be delivered to the parent's portal notifications.`}
                          confirmLabel="Send Reminder"
                          danger={false}
                          className="inline-flex items-center gap-1 rounded-lg bg-gold-500 px-2.5 py-1.5 text-xs font-bold text-brand-950 transition hover:bg-gold-400"
                        />
                        <Link
                          href={`/students/${d.studentId}`}
                          className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-brand-700 transition hover:border-brand-300"
                        >
                          View
                        </Link>
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </TableWrap>
        )}
        <Pagination
          page={page}
          totalPages={Math.max(1, Math.ceil(total / perPage))}
          baseParams={{
            q, session: String(sessionId), term: String(termId), class: classId ? String(classId) : "",
            group: groupId ? String(groupId) : "", dueBefore, minOutstanding,
          }}
        />
      </Card>

      <p className="flex items-center gap-2 text-xs text-slate-400">
        <BellRing className="h-3.5 w-3.5" /> Reminders are delivered to the parent portal notification centre (email/SMS/WhatsApp channels are prepared for future integration).
      </p>
    </div>
  );
}
