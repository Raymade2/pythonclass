import Link from "next/link";
import { SchoolLogo } from "./school-logo";

export function Card({
  children,
  className = "",
  title,
  subtitle,
  action,
}: {
  children?: React.ReactNode;
  className?: string;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className={`rounded-2xl border border-slate-200/80 bg-white shadow-card ${className}`}>
      {(title || action) && (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            {title && <h2 className="text-[15px] font-semibold text-slate-800">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function PageHeader({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

const STAT_STYLES: Record<string, string> = {
  blue: "bg-brand-50 text-brand-700",
  green: "bg-emerald-50 text-emerald-600",
  red: "bg-red-50 text-red-600",
  amber: "bg-amber-50 text-amber-600",
  violet: "bg-violet-50 text-violet-600",
  sky: "bg-sky-50 text-sky-600",
  slate: "bg-slate-100 text-slate-600",
};

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = "blue",
  href,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: React.ReactNode;
  tone?: keyof typeof STAT_STYLES;
  href?: string;
}) {
  const body = (
    <div className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-card transition hover:shadow-md sm:p-5">
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${STAT_STYLES[tone] ?? STAT_STYLES.blue}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="truncate text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
        <p className="truncate text-xl font-bold text-slate-900 tabular-nums sm:text-[22px]">{value}</p>
        {hint && <p className="truncate text-[11px] text-slate-400">{hint}</p>}
      </div>
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

export function EmptyState({ icon, title, message }: { icon?: React.ReactNode; title: string; message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
        {icon}
      </div>
      <p className="text-sm font-semibold text-slate-700">{title}</p>
      {message && <p className="mt-1 max-w-sm text-xs text-slate-500">{message}</p>}
    </div>
  );
}

export function TableWrap({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">{children}</table>
    </div>
  );
}

export function Th({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return (
    <th className={`whitespace-nowrap border-b border-slate-100 bg-slate-50/60 px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 ${className}`}>
      {children}
    </th>
  );
}

export function Td({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return <td className={`border-b border-slate-50 px-4 py-3 text-slate-700 ${className}`}>{children}</td>;
}

export function Pagination({
  page,
  totalPages,
  baseParams,
}: {
  page: number;
  totalPages: number;
  baseParams: Record<string, string | undefined>;
}) {
  if (totalPages <= 1) return null;
  const make = (p: number) => {
    const params = new URLSearchParams();
    Object.entries(baseParams).forEach(([k, v]) => {
      if (v) params.set(k, v);
    });
    params.set("page", String(p));
    return `?${params.toString()}`;
  };
  const pages: number[] = [];
  const from = Math.max(1, page - 2);
  const to = Math.min(totalPages, from + 4);
  for (let i = from; i <= to; i++) pages.push(i);
  return (
    <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm">
      <p className="text-xs text-slate-500">
        Page <span className="font-semibold">{page}</span> of {totalPages}
      </p>
      <div className="flex gap-1">
        {page > 1 && (
          <Link href={make(page - 1)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium hover:bg-slate-50">
            Previous
          </Link>
        )}
        {pages.map((p) => (
          <Link
            key={p}
            href={make(p)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
              p === page ? "bg-brand-600 text-white" : "border border-slate-200 hover:bg-slate-50"
            }`}
          >
            {p}
          </Link>
        ))}
        {page < totalPages && (
          <Link href={make(page + 1)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium hover:bg-slate-50">
            Next
          </Link>
        )}
      </div>
    </div>
  );
}

export function BrandBanner() {
  return (
    <div className="flex items-center gap-3">
      <SchoolLogo size={36} />
      <div className="leading-tight">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-gold-600">Sure Foundation</p>
        <p className="text-sm font-bold text-slate-900">Group of Schools</p>
      </div>
    </div>
  );
}
