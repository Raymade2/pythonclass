"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "@/components/toast";
import { Modal } from "@/components/modal";
import type { ActionResult } from "@/lib/server-utils";

/**
 * Button that asks for confirmation (modal dialog) before running a server
 * action with the given payload. Used for destructive operations.
 */
export function ConfirmActionButton({
  action,
  payload,
  label,
  confirmTitle,
  confirmMessage,
  className = "",
  confirmLabel = "Confirm",
  danger = true,
  icon,
}: {
  action: (fd: FormData) => Promise<ActionResult>;
  payload?: Record<string, string | number>;
  label: string;
  confirmTitle: string;
  confirmMessage: string;
  className?: string;
  confirmLabel?: string;
  danger?: boolean;
  icon?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function run() {
    if (busy) return;
    setBusy(true);
    try {
      const fd = new FormData();
      Object.entries(payload ?? {}).forEach(([k, v]) => fd.set(k, String(v)));
      const res = await action(fd);
      if (res.ok) {
        toast.success(res.message);
        setOpen(false);
        router.refresh();
      } else {
        toast.error(res.message);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        {icon} {label}
      </button>
      <Modal open={open} title={confirmTitle} onClose={() => setOpen(false)}>
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-500">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <p className="text-sm text-slate-600">{confirmMessage}</p>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={() => setOpen(false)}
            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            onClick={run}
            disabled={busy}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 ${
              danger ? "bg-red-600 hover:bg-red-700" : "bg-brand-600 hover:bg-brand-700"
            }`}
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </Modal>
    </>
  );
}
