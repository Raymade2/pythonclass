"use client";

import { useState } from "react";
import { Printer, FileDown, Loader2 } from "lucide-react";
import { toast } from "@/components/toast";
import { exportReceiptToPdf, type ReceiptPdfData } from "@/lib/pdf";

export function ReceiptActions({ receipt }: { receipt: ReceiptPdfData }) {
  const [busy, setBusy] = useState(false);

  return (
    <div className="no-print flex gap-2">
      <button
        type="button"
        onClick={() => window.print()}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
      >
        <Printer className="h-3.5 w-3.5" /> Print Receipt
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await exportReceiptToPdf(receipt);
            toast.success("Receipt PDF downloaded");
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Could not generate PDF");
          } finally {
            setBusy(false);
          }
        }}
        className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5" />} Download PDF
      </button>
    </div>
  );
}
