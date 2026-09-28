"use client";

import { useState } from "react";
import { Printer, FileSpreadsheet, FileDown, Loader2 } from "lucide-react";
import { toast } from "@/components/toast";
import { exportTableToPdf } from "@/lib/pdf";

export function PrintButton({ label = "Print" }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
    >
      <Printer className="h-3.5 w-3.5" /> {label}
    </button>
  );
}

export function CsvButton({ url, label = "Export CSV" }: { url: string; label?: string }) {
  return (
    <a
      href={url}
      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
    >
      <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" /> {label}
    </a>
  );
}

export type PdfTableSpec = {
  title: string;
  subtitle?: string;
  columns: string[];
  rows: (string | number)[][];
};

export function PdfButton({
  spec,
  filename,
  label = "Export PDF",
}: {
  spec: PdfTableSpec;
  filename: string;
  label?: string;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await exportTableToPdf(spec, filename);
          toast.success("PDF downloaded");
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Could not generate PDF");
        } finally {
          setBusy(false);
        }
      }}
      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-60"
    >
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin text-red-500" /> : <FileDown className="h-3.5 w-3.5 text-red-500" />}
      {label}
    </button>
  );
}
