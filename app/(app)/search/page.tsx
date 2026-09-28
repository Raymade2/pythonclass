import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getScope } from "@/lib/scope";
import * as people from "@/lib/repo/people";
import { formatMoney, formatDate } from "@/lib/format";
import { Card, PageHeader, EmptyState } from "@/components/ui";
import { StatusBadge, Avatar } from "@/components/badges";
import { Search as SearchIcon } from "lucide-react";

export const metadata = { title: "Search" };

export default async function SearchPage({ searchParams }: { searchParams: { q?: string } }) {
  const user = await requireUser();
  const q = (searchParams.q ?? "").trim();
  const scope = await getScope(user);

  const results = q.length >= 2 ? people.globalSearch(q, { studentIds: scope.studentIds }) : null;
  const total = results
    ? results.students.length + results.teachers.length + results.invoices.length + results.payments.length + results.classes.length
    : 0;

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <PageHeader title="Search" subtitle={q ? `${total} result(s) for “${q}”` : "Search students, teachers, invoices, payments and classes"}>
        <form action="/search" className="relative w-full max-w-md sm:w-96">
          <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            name="q"
            defaultValue={q}
            autoFocus
            placeholder="Search students, teachers, payments, receipts…"
            className="h-11 w-full rounded-full border border-slate-200 bg-white pl-10 pr-4 text-sm outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
          />
        </form>
      </PageHeader>

      {!results && (
        <Card>
          <EmptyState
            icon={<SearchIcon className="h-6 w-6" />}
            title="Start typing to search"
            message="You can search by student name, student ID, admission number, parent phone, teacher name, invoice/payment reference or receipt number."
          />
        </Card>
      )}

      {results && total === 0 && (
        <Card>
          <EmptyState icon={<SearchIcon className="h-6 w-6" />} title={`No results for “${q}”`} message="Try a different keyword or check the spelling." />
        </Card>
      )}

      {results && results.students.length > 0 && (
        <Card title="Students" subtitle={`${results.students.length} match(es)`}>
          <ul className="divide-y divide-slate-100">
            {results.students.map((s) => (
              <li key={s.id}>
                <Link href={`/students/${s.id}`} className="flex items-center gap-3 p-4 transition hover:bg-slate-50">
                  <Avatar name={`${s.firstName} ${s.lastName}`} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-800">
                      {s.firstName} {s.middleName ?? ""} {s.lastName}
                    </p>
                    <p className="truncate text-xs text-slate-400">
                      {s.studentCode} · {s.admissionNumber} · {s.className ?? "No class"}
                      {s.parentPhone ? ` · Parent: ${s.parentPhone}` : ""}
                    </p>
                  </div>
                  <StatusBadge status={s.status} />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {results && results.teachers.length > 0 && (
        <Card title="Teachers" subtitle={`${results.teachers.length} match(es)`}>
          <ul className="divide-y divide-slate-100">
            {results.teachers.map((t) => (
              <li key={t.id}>
                <Link href="/teachers" className="flex items-center gap-3 p-4 transition hover:bg-slate-50">
                  <Avatar name={`${t.firstName} ${t.lastName}`} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-800">{t.firstName} {t.lastName}</p>
                    <p className="truncate text-xs text-slate-400">{t.teacherCode} · {t.phone ?? "—"} · {t.specialization ?? "General"}</p>
                  </div>
                  <StatusBadge status={t.status} />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {results && results.invoices.length > 0 && (
        <Card title="Invoices" subtitle={`${results.invoices.length} match(es)`}>
          <ul className="divide-y divide-slate-100">
            {results.invoices.map((i) => (
              <li key={i.id}>
                <Link href={`/billing/${i.id}`} className="flex items-center justify-between gap-3 p-4 transition hover:bg-slate-50">
                  <div>
                    <p className="font-mono text-sm font-semibold text-brand-700">{i.invoiceNumber}</p>
                    <p className="text-xs text-slate-400">{i.studentName}</p>
                  </div>
                  <StatusBadge status={i.status} />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {results && results.payments.length > 0 && (
        <Card title="Payments & Receipts" subtitle={`${results.payments.length} match(es)`}>
          <ul className="divide-y divide-slate-100">
            {results.payments.map((p) => (
              <li key={p.id}>
                <Link href={`/receipts/${p.id}`} className="flex items-center justify-between gap-3 p-4 transition hover:bg-slate-50">
                  <div>
                    <p className="font-mono text-sm font-semibold text-brand-700">{p.receiptNumber ?? p.reference}</p>
                    <p className="text-xs text-slate-400">
                      {p.studentName} · {formatMoney(p.amount)}
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-brand-600">View Receipt →</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {results && results.classes.length > 0 && (
        <Card title="Classes" subtitle={`${results.classes.length} match(es)`}>
          <ul className="divide-y divide-slate-100">
            {results.classes.map((c) => (
              <li key={c.id}>
                <Link href={`/students?class=${c.id}`} className="flex items-center justify-between gap-3 p-4 transition hover:bg-slate-50">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{c.name}</p>
                    <p className="text-xs text-slate-400">{c.code}</p>
                  </div>
                  <span className="text-xs font-semibold text-brand-600">View Students →</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
