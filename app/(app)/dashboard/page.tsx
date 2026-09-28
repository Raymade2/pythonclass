import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Users, GraduationCap, School, Wallet, TrendingUp, AlertTriangle, CalendarDays, CalendarRange,
  Coins, ArrowRight, ShieldAlert,
} from "lucide-react";
import { requireUser, isAdmin } from "@/lib/auth";
import { getScope, getCurrentAcademic } from "@/lib/scope";
import * as finance from "@/lib/repo/finance";
import * as academics from "@/lib/repo/academics";
import * as people from "@/lib/repo/people";
import { formatMoney, formatDate, greeting, formatMoneyPlain } from "@/lib/format";
import { Card, PageHeader, StatCard, TableWrap, Th, Td, EmptyState } from "@/components/ui";
import { StatusBadge } from "@/components/badges";
import { CollectionBarChart, TrendAreaChart, MethodsPieChart } from "@/components/charts";
import { FilterForm, FilterSelect, FilterInput } from "@/components/filter-form";

export const metadata = { title: "Dashboard" };

type SearchParams = { session?: string; term?: string; group?: string; class?: string; from?: string; to?: string; denied?: string };

export default async function DashboardPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  if (user.role === "PARENT") redirect("/portal");

  const current = await getCurrentAcademic();
  const sessions = academics.listSessions();
  const scope = await getScope(user);
  const isAdminUser = isAdmin(user);

  const sessionId = Number(searchParams.session) || current?.session.id || 0;
  const session = sessions.find((s) => s.id === sessionId) ?? current?.session ?? null;
  const terms = session ? academics.listTermsForSession(session.id) : [];
  const termId = Number(searchParams.term) || terms.find((t) => t.isCurrent)?.id || terms[0]?.id || 0;
  const term = terms.find((t) => t.id === termId) ?? null;

  const groups = academics.listClassGroups();
  const classes = academics.listClasses({ status: "ACTIVE" });
  const groupId = Number(searchParams.group) || 0;
  const classId = Number(searchParams.class) || 0;
  const from = searchParams.from || "";
  const to = searchParams.to || "";

  // Base financial filters
  const invFilter: finance.InvoiceFilter = {
    sessionId,
    termId,
    classGroupId: groupId || undefined,
    classId: classId || undefined,
    studentIds: scope.studentIds,
  };
  const payFilter: finance.PaymentFilter = { ...invFilter };

  const [agg, todayTotal, monthTotal, recentPays, debtors] = await Promise.all([
    Promise.resolve(finance.invoiceAggregates(invFilter)),
    Promise.resolve(finance.paymentsToday(payFilter)),
    Promise.resolve(finance.paymentsThisMonth(payFilter)),
    Promise.resolve(finance.recentPayments(8, payFilter)),
    Promise.resolve(finance.debtorRows(invFilter, 8)),
  ]);

  // Counts
  const activeStudents = scope.studentIds ? scope.studentIds.length : people.countStudents("ACTIVE");
  const activeTeachers = isAdminUser
    ? (await import("@/lib/repo/people")).listTeachers({ status: "ACTIVE" }).length
    : 0;
  const activeClasses = scope.classIds ? classes.filter((c) => scope.classIds!.includes(c.id)).length : classes.length;

  // Trend data
  const trendFrom = from || new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10);
  const trendTo = to || new Date().toISOString().slice(0, 10);
  const trend = finance.dailyPaymentTotals(trendFrom, trendTo, payFilter);
  const dayMap = new Map(trend.map((t) => [t.day, t.total]));
  const trendData: { date: string; amount: number }[] = [];
  const cursor = new Date(trendFrom + "T00:00:00");
  const end = new Date(trendTo + "T00:00:00");
  for (let d = 0; d < 90 && cursor <= end; d++) {
    const key = cursor.toISOString().slice(0, 10);
    trendData.push({
      date: cursor.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }),
      amount: dayMap.get(key) ?? 0,
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  // Methods pie
  const methods = finance.methodTotals(payFilter).map((m) => ({ name: m.method, value: m.total }));

  // Class/group performance
  const allPerf = finance.classPerformance(sessionId, termId, { classGroupId: groupId || undefined, classId: classId || undefined });
  const perf = scope.classIds ? allPerf.filter((p) => scope.classIds!.includes(p.classId)) : allPerf;

  const groupNames = ["Early Years", "Primary", "Secondary"];
  const collectionData = [
    {
      name: "Overall",
      expected: agg.expected,
      collected: agg.collected,
      outstanding: agg.outstanding,
    },
    ...groupNames
      .map((gname) => {
        const g = groups.find((x) => x.name === gname);
        if (!g) return null;
        const relevant = perf.filter((p) => p.groupName === gname);
        if (relevant.length === 0) return null;
        return {
          name: gname,
          expected: relevant.reduce((s, p) => s + p.expected, 0),
          collected: relevant.reduce((s, p) => s + p.paid, 0),
          outstanding: relevant.reduce((s, p) => s + p.outstanding, 0),
        };
      })
      .filter(Boolean),
  ] as { name: string; expected: number; collected: number; outstanding: number }[];

  const collectionRate = agg.expected > 0 ? Math.round((agg.collected / agg.expected) * 100) : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${greeting()}, ${user.name.split(" ")[0]}`}
        subtitle={`${session?.name ?? "No session"} · ${term?.name ?? "No term"} — here is your school's financial position.`}
      >
        <Link
          href="/billing/new"
          className="inline-flex items-center gap-1.5 rounded-lg bg-gold-500 px-3.5 py-2 text-xs font-bold text-brand-950 shadow-sm transition hover:bg-gold-400"
        >
          Generate Payment <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </PageHeader>

      {searchParams.denied === "1" && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <ShieldAlert className="h-5 w-5 shrink-0 text-amber-500" />
          You do not have permission to access that page.
        </div>
      )}

      <FilterForm basePath="/dashboard">
        <FilterSelect name="session" label="Session" defaultValue={String(sessionId)} allLabel="—" options={sessions.map((s) => ({ value: String(s.id), label: s.name }))} />
        <FilterSelect name="term" label="Term" defaultValue={String(termId)} allLabel="—" options={terms.map((t) => ({ value: String(t.id), label: t.name }))} />
        <FilterSelect name="group" label="Class Group" defaultValue={groupId ? String(groupId) : ""} options={groups.map((g) => ({ value: String(g.id), label: g.name }))} />
        <FilterSelect
          name="class"
          label="Class"
          defaultValue={classId ? String(classId) : ""}
          options={(scope.classIds ? classes.filter((c) => scope.classIds.includes(c.id)) : classes).map((c) => ({ value: String(c.id), label: c.name }))}
        />
        <FilterInput name="from" label="From" type="date" defaultValue={from} />
        <FilterInput name="to" label="To" type="date" defaultValue={to} />
      </FilterForm>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-3">
        <div className="grid grid-cols-1 gap-3 sm:gap-4">
          <StatCard label="Total Students" value={String(activeStudents)} hint="Currently enrolled" icon={<GraduationCap className="h-5 w-5" />} tone="blue" href="/students" />
          <StatCard label="Total Teachers" value={String(activeTeachers)} hint="Active teaching staff" icon={<Users className="h-5 w-5" />} tone="violet" href="/teachers" />
          <StatCard label="Total Classes" value={String(activeClasses)} hint="Active classes" icon={<School className="h-5 w-5" />} tone="sky" href="/classes" />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:gap-4">
          <StatCard label="Expected Fees" value={formatMoney(agg.expected)} hint={`${agg.invoices} invoice(s) · ${collectionRate}% collected`} icon={<Coins className="h-5 w-5" />} tone="slate" />
          <StatCard label="Amount Collected" value={formatMoney(agg.collected)} hint={`₦${formatMoneyPlain(agg.collected)} received`} icon={<Wallet className="h-5 w-5" />} tone="green" href="/payments" />
          <StatCard label="Outstanding Fees" value={formatMoney(agg.outstanding)} hint="Total unpaid balance" icon={<AlertTriangle className="h-5 w-5" />} tone="amber" href="/debtors" />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:gap-4">
          <StatCard label="Debtors" value={String(agg.debtors)} hint="Students with balances" icon={<AlertTriangle className="h-5 w-5" />} tone="red" href="/debtors" />
          <StatCard label="Today's Payments" value={formatMoney(todayTotal)} hint={formatDate(new Date())} icon={<CalendarDays className="h-5 w-5" />} tone="green" />
          <StatCard label="Monthly Collection" value={formatMoney(monthTotal)} hint={new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric" })} icon={<CalendarRange className="h-5 w-5" />} tone="blue" />
        </div>
      </div>

      {/* Charts */}
      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2" title="Fee Collection Overview" subtitle="Expected vs collected vs outstanding">
          <div className="p-4">
            <CollectionBarChart data={collectionData} />
          </div>
        </Card>
        <Card title="Payment Methods" subtitle="Share of collections">
          <div className="p-4">
            {methods.length > 0 ? <MethodsPieChart data={methods} /> : <EmptyState title="No payments yet" />}
          </div>
        </Card>
      </div>

      <Card title="Payment Trend" subtitle={`Daily collections ${trendData.length > 0 ? `· ${trendData[0].date} — ${trendData[trendData.length - 1].date}` : ""}`}>
        <div className="p-4">
          <TrendAreaChart data={trendData} />
        </div>
      </Card>

      {/* Class performance */}
      <Card title="Class Payment Performance" subtitle={`${session?.name ?? ""} ${term?.name ?? ""}`}>
        {perf.length === 0 ? (
          <EmptyState title="No classes found" message="Assign students to classes to see performance." />
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <Th>Class</Th>
                <Th>Students</Th>
                <Th className="num">Expected</Th>
                <Th className="num">Paid</Th>
                <Th className="num">Outstanding</Th>
                <Th className="w-56">Performance</Th>
              </tr>
            </thead>
            <tbody>
              {perf.map((c) => {
                const pct = c.expected > 0 ? Math.min(100, Math.round((c.paid / c.expected) * 100)) : 0;
                return (
                  <tr key={c.classId} className="hover:bg-slate-50/60">
                    <Td className="font-medium text-slate-800">
                      {c.className}
                      <span className="ml-2 text-[11px] text-slate-400">{c.groupName ?? ""}</span>
                    </Td>
                    <Td>{c.studentCount}</Td>
                    <Td className="num">{formatMoney(c.expected)}</Td>
                    <Td className="num text-emerald-600">{formatMoney(c.paid)}</Td>
                    <Td className="num text-amber-600">{formatMoney(c.outstanding)}</Td>
                    <Td>
                      <div className="flex items-center gap-2">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className={`h-full rounded-full ${pct >= 75 ? "bg-emerald-500" : pct >= 40 ? "bg-amber-500" : "bg-red-400"}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="w-9 text-right text-xs font-bold tabular-nums text-slate-600">{pct}%</span>
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </TableWrap>
        )}
      </Card>

      {/* Recent payments & debtors */}
      <div className="grid gap-4 xl:grid-cols-2">
        <Card
          title="Recent Payments"
          action={
            <Link href="/payments" className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-800">
              View all <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          }
        >
          {recentPays.length === 0 ? (
            <EmptyState title="No payments yet" message="Payments recorded for this period will appear here." />
          ) : (
            <TableWrap>
              <thead>
                <tr>
                  <Th>Student</Th>
                  <Th>Class</Th>
                  <Th>Type</Th>
                  <Th className="num">Amount</Th>
                  <Th>Date</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {recentPays.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/60">
                    <Td>
                      <Link href={`/students/${p.studentId}`} className="font-medium text-brand-700 hover:underline">
                        {p.firstName} {p.lastName}
                      </Link>
                      <span className="block text-[11px] text-slate-400">{p.studentCode}</span>
                    </Td>
                    <Td>{p.className ?? "—"}</Td>
                    <Td>
                      <span className="text-xs">{p.method}</span>
                      <span className="block text-[11px] text-slate-400">{p.receiptNumber}</span>
                    </Td>
                    <Td className="num font-semibold">{formatMoney(p.amount)}</Td>
                    <Td className="whitespace-nowrap text-xs">{formatDate(p.paymentDate)}</Td>
                    <Td><StatusBadge status={p.status} /></Td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          )}
        </Card>

        <Card
          title="Recent Debtors"
          subtitle="Students with the highest outstanding balances"
          action={
            <Link href="/debtors" className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-800">
              View all <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          }
        >
          {debtors.rows.length === 0 ? (
            <EmptyState title="No debtors 🎉" message="All invoices for this period have been settled." />
          ) : (
            <TableWrap>
              <thead>
                <tr>
                  <Th>Student</Th>
                  <Th>Class</Th>
                  <Th className="num">Bill</Th>
                  <Th className="num">Outstanding</Th>
                  <Th>Due Date</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {debtors.rows.map((d) => {
                  const overdue = d.dueDate ? new Date(d.dueDate) < new Date() : false;
                  return (
                    <tr key={d.studentId} className="hover:bg-slate-50/60">
                      <Td>
                        <Link href={`/students/${d.studentId}`} className="font-medium text-brand-700 hover:underline">
                          {d.firstName} {d.lastName}
                        </Link>
                        <span className="block text-[11px] text-slate-400">{d.studentCode}</span>
                      </Td>
                      <Td>{d.className ?? "—"}</Td>
                      <Td className="num">{formatMoney(d.totalBill)}</Td>
                      <Td className="num font-semibold text-red-600">{formatMoney(d.outstanding)}</Td>
                      <Td className="whitespace-nowrap text-xs">{formatDate(d.dueDate)}</Td>
                      <Td>
                        <StatusBadge status={overdue ? "OVERDUE" : "PARTIALLY_PAID"} />
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </TableWrap>
          )}
        </Card>
      </div>
    </div>
  );
}
