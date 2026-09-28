"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, FileText } from "lucide-react";
import { toast } from "@/components/toast";
import { generateInvoiceAction } from "@/app/actions/invoices";
import { formatMoney } from "@/lib/format";

type Item = {
  id: number;
  label: string;
  sublabel: string;
  amount: number;
  dueDate: string | null;
  mandatory: boolean;
  kind: "fee" | "other";
};

export function GenerateInvoiceClient({
  studentId,
  sessionId,
  termId,
  fees,
  others,
}: {
  studentId: number;
  sessionId: number;
  termId: number;
  fees: Item[];
  others: Item[];
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  const items: Item[] = useMemo(
    () => [
      ...fees.map((f) => ({ ...f, kind: "fee" as const })),
      ...others.map((o) => ({ ...o, kind: "other" as const })),
    ],
    [fees, others]
  );

  const key = (it: Item) => `${it.kind}-${it.id}`;

  function toggle(it: Item) {
    const k = key(it);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  }

  const selectedItems = items.filter((it) => selected.has(key(it)));
  const total = selectedItems.reduce((s, it) => s + it.amount, 0);

  async function generate() {
    if (selectedItems.length === 0) {
      toast.error("Select at least one payment item");
      return;
    }
    if (busy) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set("studentId", String(studentId));
      fd.set("sessionId", String(sessionId));
      fd.set("termId", String(termId));
      selectedItems.forEach((it) => {
        if (it.kind === "fee") fd.append("feeIds", String(it.id));
        else fd.append("otherPaymentIds", String(it.id));
      });
      const res = await generateInvoiceAction(fd);
      if (res.ok) {
        toast.success(res.message);
        router.push(`/billing/${res.id}`);
      } else {
        toast.error(res.message);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not generate invoice");
    } finally {
      setBusy(false);
    }
  }

  function ItemRow({ it }: { it: Item }) {
    const isSel = selected.has(key(it));
    return (
      <label
        className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition ${
          isSel ? "border-brand-300 bg-brand-50/50" : "border-slate-200 bg-white hover:border-slate-300"
        }`}
      >
        <input
          type="checkbox"
          checked={isSel}
          onChange={() => toggle(it)}
          className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-slate-800">
            {it.label}
            {it.mandatory && <span className="ml-1.5 rounded bg-brand-100 px-1.5 py-0.5 text-[10px] font-bold text-brand-700">REQ</span>}
          </p>
          <p className="truncate text-[11px] text-slate-400">{it.sublabel}</p>
        </div>
        <p className="shrink-0 text-sm font-bold tabular-nums text-slate-800">{formatMoney(it.amount)}</p>
      </label>
    );
  }

  return (
    <div className="space-y-5">
      {fees.length > 0 && (
        <div>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-brand-700">School Fees ({fees.length} available)</p>
          <div className="grid gap-2 lg:grid-cols-2">
            {fees.map((f) => <ItemRow key={`fee-${f.id}`} it={f} />)}
          </div>
        </div>
      )}
      {others.length > 0 && (
        <div>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-brand-700">Other Payments ({others.length} available)</p>
          <div className="grid gap-2 lg:grid-cols-2">
            {others.map((o) => <ItemRow key={`other-${o.id}`} it={o} />)}
          </div>
        </div>
      )}
      {items.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">
          No new charges are available for this student in the selected session/term. They may already be invoiced for everything.
        </div>
      )}

      <div className="sticky bottom-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-lg">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Selected total ({selectedItems.length} item{selectedItems.length === 1 ? "" : "s"})</p>
          <p className="text-2xl font-bold tabular-nums text-brand-800">{formatMoney(total)}</p>
        </div>
        <button
          onClick={generate}
          disabled={busy || selectedItems.length === 0}
          className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
          Generate Invoice & Payment Reference
        </button>
      </div>
    </div>
  );
}
