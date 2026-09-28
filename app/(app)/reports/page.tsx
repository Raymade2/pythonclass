import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getCurrentAcademic } from "@/lib/scope";
import * as academics from "@/lib/repo/academics";
import * as finance from "@/lib/repo/finance";
import * as people from "@/lib/repo/people";
import { formatMoney, formatDate } from "@/lib/format";
import { Card, PageHeader, TableWrap, Th, Td, EmptyState, StatCard } from "@/components/ui";
import { FilterForm, FilterSelect, FilterInput } from "@/components/filter-form";
import { PrintButton, CsvButton, PdfButton } from "@/components/export-buttons";
import { BarChart3, Users, School, Wallet, TrendingUp, AlertTriangle } from "lucide-react";

export const metadata = { title: "Reports" };

type Params = {
  tab?: string; type?: string; session?: string; term?: string; class?: string;
  from?: string; to?: string;
};

export default async function ReportsPage({ searchParams }: { searchParams: Params }) {
  await requireUser(["SUPER_ADMIN", "ADMIN"]);
  const current = await getCurrentAcademic();
  const sessions = academics.listSessions();

  const tab = ["financial", "students", "classes"].includes(searchParams.tab ?? "") ? searchParams.tab! : "financial";

  const sessionId = Number(searchParams.session) || current?.session.id || 0;
  const session = sessions.find((s) => s.id === sessionId);
  const terms = session ? academics.listTermsForSession(session.id) : [];
  const termId = Number(searchParams.term) || terms.find((t) => t.isCurrent)?.id || terms[0]?.id || 0;
  const term = terms.find((t) => t.id === termId);
  const classId = Number(searchParams.class) || 0;
  const from = searchParams.from ?? "";
  const to = searchParams.to ?? "";

  const classes = academics.listClasses({ status: "ACTIVE" });
  const cls = classes.find((c) => c.id === classId);

  const invFilter = {
    sessionId,
    termId,
    classId: classId || undefined,
  };

  const exportBase = { session: String(sessionId), term: String(termId), ...(classId ? { class: String(classId) } : {}), ...(from ? { from } : {}), ...(to ? { to } : {}) };

  const tabs = [
    { id: "financial", label: "Financial Reports", icon: BarChart3 },
    { id: "students", label: "Student Reports", icon: Users },
    { id: "classes", label: "Class Reports", icon: School },
  ];

  const subtitle = `${session?.name ?? "—"} · ${term?.name ?? "—"}${cls ? ` · ${cls.name}` : " · All Classes"}`;

  return (
    <div className="space-y-5">
      <PageHeader title="Reports" subtitle="Financial, student and class reports — view, print or export" />

      {/* Tabs */}
      <div className="no-print flex flex-wrap gap-2">
        {tabs.map((t) => (
          <Link
            key={t.id}
            href={`/reports?tab=${t.id}&session=${sessionId}&term=${termId}${classId ? `&class=${classId}` : ""}`}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
              tab === t.id ? "bg-brand-600 text-white shadow-sm" : "border border-slate-200 bg-white text-slate-600 hover:border-brand-200 hover:text-brand-700"
            }`}
          >
            <t.icon className="h-4 w-4" /> {t.label}
          </Link>
        ))}
      </div>

      <FilterForm basePath={`/reports?tab=${tab}`}>
        <input type="hidden" name="tab" value={tab} />
        <FilterSelect name="session" label="Session" defaultValue={String(sessionId)} allLabel="—" options={sessions.map((s) => ({ value: String(s.id), label: s.name }))} />
        <FilterSelect name="term" label="Term" defaultValue={String(termId)} allLabel="—" options={terms.map((t) => ({ value: String(t.id), label: t.name }))} />
        <FilterSelect name="class" label="Class" defaultValue={classId ? String(classId) : ""} options={classes.map((c) => ({ value: String(c.id), label: c.name }))} />
        <FilterInput name="from" label="From" type="date" defaultValue={from} />
        <FilterInput name="to" label="To" type="date" defaultValue={to} />
      </FilterForm>

      {tab === "financial" && <FinancialReport
        searchParams={searchParams}
        sessionId={sessionId}
        termId={termId}
        classId={classId}
        from={from}
        to={to}
        subtitle={subtitle}
        exportBase={exportBase}
      />}

      {tab === "students" && <StudentReport
        searchParams={searchParams}
        sessionId={sessionId}
        termId={termId}
        classId={classId}
        subtitle={subtitle}
        exportBase={exportBase}
      />}

      {tab === "classes" && <ClassReport
        sessionId={sessionId}
        termId={termId}
        subtitle={subtitle}
        exportBase={exportBase}
      />}
    </div>
  );
}

// ---------------------------------------------------------------------------

function FinancialReport({
  searchParams, sessionId, termId, classId, from, to, subtitle, exportBase,
}: {
  searchParams: Params; sessionId: number; termId: number; classId: number;
  from: string; to: string; subtitle: string; exportBase: Record<string, string>;
}) {
  const type = searchParams.type ?? "monthly";
  const payFilter: finance.PaymentFilter = {
    sessionId,
    termId,
    classId: classId || undefined,
    from: from || undefined,
    to: to || undefined,
  };

  const agg = finance.invoiceAggregates({ sessionId, termId, classId: classId || undefined });
  const defaultFrom = from || new Date(Date.now() - 180 * 86400000).toISOString().slice(0, 10);
  const defaultTo = to || new Date().toISOString().slice(0, 10);
  const daily = finance.dailyPaymentTotals(defaultFrom, defaultTo, payFilter);

  const periodKey = (day: string): string => {
    const d = new Date(day + "T00:00:00");
    switch (type) {
      case "daily":
        return day;
      case "weekly": {
        const monday = new Date(d);
        monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
        return `Week of ${monday.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}`;
      }
      case "termly":
        return subtitle;
      case "annual":
        return String(d.getFullYear());
      default:
        return d.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
    }
  };

  const periods = new Map<string, { total: number; count: number }>();
  for (const d of daily) {
    const k = periodKey(d.day);
    const cur = periods.get(k) ?? { total: 0, count: 0 };
    cur.total += d.total;
    cur.count += 1;
    periods.set(k, cur);
  }
  const rows = [...periods.entries()].map(([period, v]) => ({ period, total: v.total, days: v.count }));
  const grandTotal = rows.reduce((s, r) => s + r.total, 0);

  const debtors = finance.debtorRows({ sessionId, termId, classId: classId || undefined }, 0);

  const csvQs = new URLSearchParams({ type: "collection", granularity: type, ...exportBase, from: defaultFrom, to: defaultTo }).toString();

  const typeOptions = [
    { value: "daily", label: "Daily Collection" },
    { value: "weekly", label: "Weekly Collection" },
    { value: "monthly", label: "Monthly Collection" },
    { value: "termly", label: "Termly Collection" },
    { value: "annual", label: "Annual Collection" },
  ];

  return (
    <div className="space-y-4">
      <Card title="Financial Reports" subtitle={subtitle}>
        <div className="border-b border-slate-100 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Report type</span>
            {typeOptions.map((t) => {
              const params = new URLSearchParams({ tab: "financial", type: t.value, session: String(sessionId), term: String(termId), ...(classId ? { class: String(classId) } : {}), from: defaultFrom, to: defaultTo });
              return (
                <Link
                  key={t.value}
                  href={`/reports?${params.toString()}`}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                    type === t.value ? "bg-brand-600 text-white" : "border border-slate-200 text-slate-600 hover:border-brand-200"
                  }`}
                >
                  {t.label}
                </Link>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4">
          <StatCard label="Expected Fees" value={formatMoney(agg.expected)} icon={<Wallet className="h-5 w-5" />} tone="slate" />
          <StatCard label="Fees Collected" value={formatMoney(agg.collected)} icon={<TrendingUp className="h-5 w-5" />} tone="green" />
          <StatCard label="Outstanding Fees" value={formatMoney(agg.outstanding)} icon={<AlertTriangle className="h-5 w-5" />} tone="amber" />
          <StatCard label="Debtors" value={String(agg.debtors)} icon={<Users className="h-5 w-5" />} tone="red" />
        </div>
      </Card>

      <Card
        title={`${typeOptions.find((t) => t.value === type)?.label ?? "Collection"} Report`}
        subtitle={`${formatDate(defaultFrom)} — ${formatDate(defaultTo)}`}
        action={
          <div className="no-print flex gap-2">
            <PrintButton />
            <CsvButton url={`/api/export?${csvQs}`} />
            <PdfButton
              spec={{
                title: typeOptions.find((t) => t.value === type)?.label ?? "Collection",
                subtitle,
                columns: ["Period", "Active Days", "Amount Collected (₦)"],
                rows: rows.map((r) => [r.period, r.days, r.total.toLocaleString("en-NG")]),
              }}
              filename="sfgs-collection-report.pdf"
            />
          </div>
        }
      >
        {rows.length === 0 ? (
          <EmptyState title="No collections in this period" />
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <Th>Period</Th>
                <Th className="num">Active Days</Th>
                <Th className="num">Amount Collected</Th>
                <Th className="w-48">Share</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const pct = grandTotal > 0 ? Math.round((r.total / grandTotal) * 100) : 0;
                return (
                  <tr key={r.period} className="hover:bg-slate-50/60">
                    <Td className="font-medium text-slate-800">{r.period}</Td>
                    <Td className="num">{r.days}</Td>
                    <Td className="num font-semibold">{formatMoney(r.total)}</Td>
                    <Td>
                      <div className="flex items-center gap-2">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full rounded-full bg-brand-500" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="w-8 text-right text-xs font-bold text-slate-500">{pct}%</span>
                      </div>
                    </Td>
                  </tr>
                );
              })}
              <tr className="bg-slate-50/80 font-bold">
                <Td className="border-t-2 border-slate-200">Total</Td>
                <Td className="num border-t-2 border-slate-200">{daily.length}</Td>
                <Td className="num border-t-2 border-slate-200 text-brand-800">{formatMoney(grandTotal)}</Td>
                <Td className="border-t-2 border-slate-200" />
              </tr>
            </tbody>
          </TableWrap>
        )}
      </Card>

      <Card
        title="Debtors Report"
        subtitle={`${debtors.total} debtor(s) · ${formatMoney(debtors.rows.reduce((s, d) => s + d.outstanding, 0))} outstanding`}
        action={
          <Link href="/debtors" className="no-print text-xs font-semibold text-brand-600 hover:underline">
            Open Debtors Module →
          </Link>
        }
      >
        {debtors.rows.length === 0 ? (
          <EmptyState title="No debtors 🎉" />
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <Th>Student</Th>
                <Th>Class</Th>
                <Th className="num">Outstanding</Th>
                <Th>Due Date</Th>
              </tr>
            </thead>
            <tbody>
              {debtors.rows.slice(0, 10).map((d) => (
                <tr key={d.studentId}>
                  <Td className="font-medium">{d.firstName} {d.lastName}</Td>
                  <Td>{d.className ?? "—"}</Td>
                  <Td className="num font-semibold text-red-600">{formatMoney(d.outstanding)}</Td>
                  <Td className="text-xs">{formatDate(d.dueDate)}</Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------

function StudentReport({
  searchParams, sessionId, termId, classId, subtitle, exportBase,
}: {
  searchParams: Params; sessionId: number; termId: number; classId: number;
  subtitle: string; exportBase: Record<string, string>;
}) {
  const type = searchParams.type ?? "all";
  const { rows: students } = people.listStudents({
    classId: classId || undefined,
    sessionId,
    termId,
    limit: 1000,
    ...(type === "active" ? { status: "ACTIVE" } : {}),
    ...(type === "former" ? { status: "INACTIVE" } : {}),
  });

  const newAdmissions = students.filter((s) => {
    const d = new Date(s.admissionDate);
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - 6);
    return d >= cutoff;
  });

  const shown = type === "new" ? newAdmissions : students;

  const csvQs = new URLSearchParams({ type: "students", ...exportBase }).toString();

  const typeOptions = [
    { value: "all", label: "Student List" },
    { value: "active", label: "Active Students" },
    { value: "new", label: "New Admissions" },
    { value: "former", label: "Former Students" },
  ];

  return (
    <Card
      title="Student Reports"
      subtitle={subtitle}
      action={
        <div className="no-print flex gap-2">
          <PrintButton />
          <CsvButton url={`/api/export?${csvQs}`} />
          <PdfButton
            spec={{
              title: typeOptions.find((t) => t.value === type)?.label ?? "Student List",
              subtitle,
              columns: ["Student", "Student ID", "Class", "Gender", "Parent", "Phone", "Status"],
              rows: shown.map((s) => [
                `${s.firstName} ${s.middleName ?? ""} ${s.lastName}`.trim(),
                s.studentCode,
                s.className ?? "—",
                s.gender,
                s.parentName ?? "—",
                s.parentPhone ?? "—",
                s.status,
              ]),
            }}
            filename="sfgs-students-report.pdf"
          />
        </div>
      }
    >
      <div className="border-b border-slate-100 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Report type</span>
          {typeOptions.map((t) => {
            const params = new URLSearchParams({ tab: "students", type: t.value, session: String(sessionId), term: String(termId), ...(classId ? { class: String(classId) } : {}) });
            return (
              <Link
                key={t.value}
                href={`/reports?${params.toString()}`}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  type === t.value ? "bg-brand-600 text-white" : "border border-slate-200 text-slate-600 hover:border-brand-200"
                }`}
              >
                {t.label}
              </Link>
            );
          })}
        </div>
      </div>

      {shown.length === 0 ? (
        <EmptyState title="No students match this report" />
      ) : (
        <TableWrap>
          <thead>
            <tr>
              <Th>Student</Th>
              <Th>Student ID</Th>
              <Th>Class</Th>
              <Th>Gender</Th>
              <Th>Parent</Th>
              <Th>Phone</Th>
              <Th>Admitted</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody>
            {shown.slice(0, 100).map((s) => (
              <tr key={s.id} className="hover:bg-slate-50/60">
                <Td>
                  <Link href={`/students/${s.id}`} className="font-semibold text-brand-700 hover:underline">
                    {s.firstName} {s.middleName ?? ""} {s.lastName}
                  </Link>
                </Td>
                <Td className="font-mono text-xs">{s.studentCode}</Td>
                <Td>{s.className ?? "—"}</Td>
                <Td>{s.gender}</Td>
                <Td className="text-xs">{s.parentName ?? "—"}</Td>
                <Td className="text-xs">{s.parentPhone ?? "—"}</Td>
                <Td className="whitespace-nowrap text-xs">{formatDate(s.admissionDate)}</Td>
                <Td className="text-xs">{s.status}</Td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      )}
      {shown.length > 100 && (
        <p className="border-t border-slate-100 px-4 py-2.5 text-center text-xs text-slate-400">
          Showing the first 100 of {shown.length} students — export for the full list.
        </p>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------

function ClassReport({
  sessionId, termId, subtitle, exportBase,
}: {
  sessionId: number; termId: number; subtitle: string; exportBase: Record<string, string>;
}) {
  const perf = finance.classPerformance(sessionId, termId);
  const csvQs = new URLSearchParams({ type: "classes", ...exportBase }).toString();

  const totalStudents = perf.reduce((s, p) => s + p.studentCount, 0);
  const totalExpected = perf.reduce((s, p) => s + p.expected, 0);
  const totalPaid = perf.reduce((s, p) => s + p.paid, 0);

  return (
    <Card
      title="Class Reports"
      subtitle={subtitle}
      action={
        <div className="no-print flex gap-2">
          <PrintButton />
          <CsvButton url={`/api/export?${csvQs}`} />
          <PdfButton
            spec={{
              title: "Class Payment Performance",
              subtitle,
              columns: ["Class", "Students", "Expected (₦)", "Paid (₦)", "Outstanding (₦)", "Payment %"],
              rows: perf.map((p) => [
                p.className,
                p.studentCount,
                p.expected.toLocaleString("en-NG"),
                p.paid.toLocaleString("en-NG"),
                p.outstanding.toLocaleString("en-NG"),
                `${p.expected > 0 ? Math.round((p.paid / p.expected) * 100) : 0}%`,
              ]),
            }}
            filename="sfgs-class-report.pdf"
          />
        </div>
      }
    >
      <div className="grid grid-cols-3 gap-3 p-4">
        <StatCard label="Students" value={String(totalStudents)} icon={<Users className="h-5 w-5" />} tone="blue" />
        <StatCard label="Expected" value={formatMoney(totalExpected)} icon={<Wallet className="h-5 w-5" />} tone="slate" />
        <StatCard label="Collected" value={formatMoney(totalPaid)} icon={<TrendingUp className="h-5 w-5" />} tone="green" />
      </div>
      <TableWrap>
        <thead>
          <tr>
            <Th>Class</Th>
            <Th>Group</Th>
            <Th className="num">Students</Th>
            <Th className="num">Expected</Th>
            <Th className="num">Paid</Th>
            <Th className="num">Outstanding</Th>
            <Th className="w-44">Payment %</Th>
          </tr>
        </thead>
        <tbody>
          {perf.map((p) => {
            const pct = p.expected > 0 ? Math.min(100, Math.round((p.paid / p.expected) * 100)) : 0;
            return (
              <tr key={p.classId} className="hover:bg-slate-50/60">
                <Td className="font-semibold text-slate-800">{p.className}</Td>
                <Td className="text-xs text-slate-500">{p.groupName ?? "—"}</Td>
                <Td className="num">{p.studentCount}</Td>
                <Td className="num">{formatMoney(p.expected)}</Td>
                <Td className="num text-emerald-600">{formatMoney(p.paid)}</Td>
                <Td className="num text-amber-600">{formatMoney(p.outstanding)}</Td>
                <Td>
                  <div className="flex items-center gap-2">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <div className={`h-full rounded-full ${pct >= 75 ? "bg-emerald-500" : pct >= 40 ? "bg-amber-500" : "bg-red-400"}`} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-9 text-right text-xs font-bold text-slate-600">{pct}%</span>
                  </div>
                </Td>
              </tr>
            );
          })}
        </tbody>
      </TableWrap>
    </Card>
  );
}
