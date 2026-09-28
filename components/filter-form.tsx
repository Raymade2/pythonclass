"use client";

import { useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SlidersHorizontal, RotateCcw } from "lucide-react";

/**
 * Auto-submitting GET filter bar. Changing any control applies the filters;
 * works without JavaScript too (the Apply button submits the form).
 */
export function FilterForm({
  children,
  basePath,
  className = "",
}: {
  children: React.ReactNode;
  basePath: string;
  className?: string;
}) {
  const ref = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const params = useSearchParams();

  function onChange() {
    // allow the change to land in the form state first
    setTimeout(() => ref.current?.requestSubmit(), 0);
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const qs = new URLSearchParams();
    fd.forEach((v, k) => {
      if (String(v).trim() !== "") qs.set(k, String(v));
    });
    qs.delete("page");
    router.push(`${basePath}${qs.toString() ? `?${qs.toString()}` : ""}`);
  }

  return (
    <form
      ref={ref}
      onSubmit={onSubmit}
      onChange={onChange}
      className={`no-print grid grid-cols-2 gap-2.5 rounded-xl border border-slate-200 bg-slate-50/70 p-3 sm:grid-cols-3 lg:grid-cols-6 ${className}`}
    >
      {children}
      <div className="col-span-2 flex items-end gap-2 sm:col-span-3 lg:col-span-1">
        <button
          type="submit"
          className="inline-flex h-[38px] w-full items-center justify-center gap-1.5 rounded-lg bg-brand-600 px-3 text-xs font-semibold text-white transition hover:bg-brand-700"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" /> Apply
        </button>
        {params.toString() && (
          <button
            type="button"
            onClick={() => router.push(basePath)}
            title="Reset filters"
            className="inline-flex h-[38px] items-center justify-center rounded-lg border border-slate-200 bg-white px-2.5 text-slate-500 transition hover:text-brand-600"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </form>
  );
}

export function FilterSelect({
  name,
  label,
  defaultValue,
  options,
  allLabel = "All",
}: {
  name: string;
  label: string;
  defaultValue?: string;
  options: { value: string; label: string }[];
  allLabel?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</span>
      <select
        name={name}
        defaultValue={defaultValue ?? ""}
        className="h-[38px] w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 outline-none transition focus:border-brand-400"
      >
        <option value="">{allLabel}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function FilterInput({
  name,
  label,
  defaultValue,
  type = "text",
  placeholder,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  type?: string;
  placeholder?: string;
} ) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</span>
      <input
        type={type}
        name={name}
        defaultValue={defaultValue ?? ""}
        placeholder={placeholder}
        className="h-[38px] w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 outline-none transition placeholder:text-slate-300 focus:border-brand-400"
      />
    </label>
  );
}
