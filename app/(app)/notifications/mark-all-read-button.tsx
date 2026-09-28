"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCheck, Loader2 } from "lucide-react";
import { toast } from "@/components/toast";
import type { ActionResult } from "@/lib/server-utils";

export function MarkAllReadButton({ action }: { action: () => Promise<ActionResult> }) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  return (
    <button
      onClick={async () => {
        if (busy) return;
        setBusy(true);
        try {
          const res = await action();
          if (res.ok) {
            toast.success(res.message);
            router.refresh();
          } else {
            toast.error(res.message);
          }
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Failed");
        } finally {
          setBusy(false);
        }
      }}
      disabled={busy}
      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-60"
    >
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCheck className="h-3.5 w-3.5" />}
      Mark All Read
    </button>
  );
}
