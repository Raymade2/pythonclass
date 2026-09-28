import { formatMoney } from "@/lib/format";
import type { InvoiceStatus } from "./invoice";

export function StatusBadge({ status }: { status: string }) {
  const s = status as InvoiceStatus;
  const map: Record<string, { label: string; cls: string; dot: string }> = {
    UNPAID: { label: "Unpaid", cls: "bg-slate-100 text-slate-700 ring-slate-200", dot: "bg-slate-400" },
    PARTIALLY_PAID: { label: "Partially Paid", cls: "bg-amber-50 text-amber-700 ring-amber-200", dot: "bg-amber-500" },
    FULLY_PAID: { label: "Fully Paid", cls: "bg-emerald-50 text-emerald-700 ring-emerald-200", dot: "bg-emerald-500" },
    OVERDUE: { label: "Overdue", cls: "bg-red-50 text-red-700 ring-red-200", dot: "bg-red-500" },
    CANCELLED: { label: "Cancelled", cls: "bg-slate-100 text-slate-500 ring-slate-200", dot: "bg-slate-300" },
    PENDING: { label: "Pending", cls: "bg-amber-50 text-amber-700 ring-amber-200", dot: "bg-amber-400" },
    SUCCESSFUL: { label: "Successful", cls: "bg-emerald-50 text-emerald-700 ring-emerald-200", dot: "bg-emerald-500" },
    FAILED: { label: "Failed", cls: "bg-red-50 text-red-700 ring-red-200", dot: "bg-red-500" },
    ABANDONED: { label: "Abandoned", cls: "bg-slate-100 text-slate-500 ring-slate-200", dot: "bg-slate-300" },
    ACTIVE: { label: "Active", cls: "bg-emerald-50 text-emerald-700 ring-emerald-200", dot: "bg-emerald-500" },
    INACTIVE: { label: "Inactive", cls: "bg-slate-100 text-slate-600 ring-slate-200", dot: "bg-slate-400" },
    SUSPENDED: { label: "Suspended", cls: "bg-red-50 text-red-700 ring-red-200", dot: "bg-red-500" },
    GRADUATED: { label: "Graduated", cls: "bg-blue-50 text-blue-700 ring-blue-200", dot: "bg-blue-500" },
    TRANSFERRED: { label: "Transferred", cls: "bg-violet-50 text-violet-700 ring-violet-200", dot: "bg-violet-500" },
  };
  const cfg = map[s] ?? { label: status, cls: "bg-slate-100 text-slate-600 ring-slate-200", dot: "bg-slate-400" };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${cfg.cls}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

export function Money({ value, className = "" }: { value: number; className?: string }) {
  return <span className={`tabular-nums ${className}`}>{formatMoney(value)}</span>;
}

export function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
  const sizes = {
    sm: "h-7 w-7 text-[10px]",
    md: "h-9 w-9 text-xs",
    lg: "h-14 w-14 text-lg",
  };
  const palette = [
    "bg-brand-100 text-brand-700",
    "bg-amber-100 text-amber-700",
    "bg-emerald-100 text-emerald-700",
    "bg-rose-100 text-rose-700",
    "bg-violet-100 text-violet-700",
    "bg-sky-100 text-sky-700",
  ];
  const idx = name.split("").reduce((s, c) => s + c.charCodeAt(0), 0) % palette.length;
  return (
    <span className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold ${sizes[size]} ${palette[idx]}`}>
      {initials || "?"}
    </span>
  );
}
