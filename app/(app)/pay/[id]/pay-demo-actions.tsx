"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CreditCard, Loader2, XCircle } from "lucide-react";
import { toast } from "@/components/toast";
import { demoGatewayConfirmAction, demoGatewayCancelAction } from "@/app/actions/payments";

export function PayDemoActions({ paymentId, invoiceId }: { paymentId: number; invoiceId: number | null }) {
  const [busy, setBusy] = useState<"pay" | "cancel" | null>(null);
  const router = useRouter();

  async function confirm() {
    if (busy) return;
    setBusy("pay");
    try {
      const fd = new FormData();
      fd.set("paymentId", String(paymentId));
      const res = await demoGatewayConfirmAction(fd);
      if (res.ok) {
        toast.success(res.message);
        router.push(`/receipts/${paymentId}`);
        router.refresh();
      } else {
        toast.error(res.message);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Payment failed");
    } finally {
      setBusy(null);
    }
  }

  async function cancel() {
    if (busy) return;
    setBusy("cancel");
    try {
      const fd = new FormData();
      fd.set("paymentId", String(paymentId));
      const res = await demoGatewayCancelAction(fd);
      if (res.ok) {
        toast.info(res.message);
        router.push(invoiceId ? `/billing/${invoiceId}` : "/billing");
        router.refresh();
      } else {
        toast.error(res.message);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not cancel");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      <button
        onClick={confirm}
        disabled={busy !== null}
        className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60"
      >
        {busy === "pay" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
        Authorize Payment
      </button>
      <button
        onClick={cancel}
        disabled={busy !== null}
        className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-60"
      >
        {busy === "cancel" ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
        Cancel
      </button>
    </div>
  );
}
