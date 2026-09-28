"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "@/components/toast";
import type { ActionResult } from "@/lib/server-utils";

export type FormField = {
  name: string;
  label: string;
  type: "text" | "number" | "select" | "date" | "textarea" | "checkbox" | "email" | "tel" | "password";
  options?: { value: string; label: string }[];
  required?: boolean;
  placeholder?: string;
  defaultValue?: string | number | boolean | null;
  colSpan?: 1 | 2;
  min?: number;
  max?: number;
  step?: number;
  help?: string;
  section?: string;
};

const inputCls =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-100 disabled:bg-slate-50";

export function DataForm({
  fields,
  action,
  submitLabel = "Save",
  hidden,
  onCancel,
  onDone,
  footer,
  redirectAfter,
}: {
  fields: FormField[];
  action: (fd: FormData) => Promise<ActionResult>;
  submitLabel?: string;
  hidden?: Record<string, string | number>;
  onCancel?: () => void;
  onDone?: (res: ActionResult) => void;
  footer?: React.ReactNode;
  /** e.g. "/students/{id}" — navigates here after success (serializable alternative to onDone redirects) */
  redirectAfter?: string;
}) {
  const [busy, setBusy] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  let lastSection: string | null | undefined = null;
  void lastSection;

  // Group fields into sections (a field may declare which section it belongs to)
  const groups: { section?: string; fields: FormField[] }[] = [];
  for (const f of fields) {
    const last = groups[groups.length - 1];
    if (!last || last.section !== f.section) {
      groups.push({ section: f.section, fields: [f] });
    } else {
      last.fields.push(f);
    }
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const fd = new FormData(e.currentTarget);
      // ensure unchecked checkboxes are present
      fields.forEach((f) => {
        if (f.type === "checkbox" && !fd.has(f.name)) fd.set(f.name, "off");
      });
      const res = await action(fd);
      if (res.ok) {
        toast.success(res.message);
        formRef.current?.reset();
        onDone?.(res);
        router.refresh();
      } else {
        toast.error(res.message);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="space-y-4">
      {hidden &&
        Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={String(v)} />)}
      <div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
        {fields.map((f) => {
          const sectionHeader =
            f.section && f.section !== lastSection ? (
              (lastSection = f.section) && (
                <div key={`sec-${f.name}`} className="col-span-full mt-1 border-b border-slate-100 pb-1">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-brand-700">{f.section}</p>
                </div>
              )
            ) : null;

          const control = (
            <div key={f.name} className={f.colSpan === 2 ? "col-span-full" : ""}>
              {f.type !== "checkbox" && (
                <label htmlFor={`ff-${f.name}`} className="mb-1.5 block text-xs font-semibold text-slate-600">
                  {f.label} {f.required && <span className="text-red-500">*</span>}
                </label>
              )}
              {f.type === "select" ? (
                <select
                  id={`ff-${f.name}`}
                  name={f.name}
                  required={f.required}
                  defaultValue={(f.defaultValue ?? "") as string}
                  className={inputCls}
                >
                  {!f.required && <option value="">— none —</option>}
                  {f.options?.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              ) : f.type === "textarea" ? (
                <textarea
                  id={`ff-${f.name}`}
                  name={f.name}
                  rows={2}
                  required={f.required}
                  placeholder={f.placeholder}
                  defaultValue={(f.defaultValue ?? "") as string}
                  className={inputCls}
                />
              ) : f.type === "checkbox" ? (
                <label className="flex items-center gap-2.5 rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2.5">
                  <input
                    type="checkbox"
                    name={f.name}
                    defaultChecked={Boolean(f.defaultValue)}
                    className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                  />
                  <span className="text-sm font-medium text-slate-700">{f.label}</span>
                </label>
              ) : (
                <input
                  id={`ff-${f.name}`}
                  type={f.type}
                  name={f.name}
                  required={f.required}
                  placeholder={f.placeholder}
                  min={f.min}
                  max={f.max}
                  step={f.step ?? (f.type === "number" ? 1 : undefined)}
                  defaultValue={(f.defaultValue ?? "") as string}
                  className={inputCls}
                />
              )}
              {f.help && <p className="mt-1 text-[11px] text-slate-400">{f.help}</p>}
            </div>
          );

          return sectionHeader ? [sectionHeader, control] : control;
        })}
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
        {footer}
        {onCancel && (
          <button type="button" onClick={onCancel} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
