"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CreditCard, Loader2 } from "lucide-react";
import { toast } from "@/components/toast";
import { initializeOnlinePaymentAction } from "@/app/actions/payments";
import { formatMoney } from "@/lib/format";

export function PayOnlineButton({
  invoiceId,
  balance,
  compact = false,
}: {
  invoiceId: number;
  balance: number;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(String(balance));
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function pay() {
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt < 100) {
      toast.error("Enter an amount of at least ₦100");
      return;
    }
    if (busy) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set("invoiceId", String(invoiceId));
      fd.set("amount", String(amt));
      const res = await initializeOnlinePaymentAction(fd);
      if (res.ok && res.url) {
        toast.success(res.message);
        window.location.href = res.url;
      } else {
        toast.error(res.message);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start payment");
    } finally {
      setBusy(false);
    }
  }

  if (balance <= 0) return null;

  if (compact) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700"
      >
        <CreditCard className="h-3.5 w-3.5" /> Pay Online
      </button>
    );
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700"
      >
        <CreditCard className="h-4 w-4" /> Pay Online
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="animate-fade-in relative z-10 w-full max-w-sm rounded-t-2xl bg-white p-6 shadow-2xl sm:rounded-2xl">
            <h3 className="text-lg font-bold text-slate-900">Pay Online</h3>
            <p className="mt-1 text-sm text-slate-500">
              Secure checkout via the school's payment gateway. Partial payments are supported.
            </p>
            <label className="mt-5 block">
              <span className="mb-1.5 block text-xs font-semibold text-slate-600">
                Amount to pay (outstanding: {formatMoney(balance)})
              </span>
              <input
                type="number"
                min={100}
                max={balance}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-lg font-bold tabular-nums outline-none focus:border-brand-400 focus:bg-white focus:ring-2 focus:ring-brand-100"
              />
            </label>
            <div className="mt-3 flex gap-2">
              {[
                { label: "Full", value: balance },
                { label: "50%", value: Math.round(balance / 2) },
                { label: "25%", value: Math.round(balance / 4) },
              ].map((b) => (
                <button
                  key={b.label}
                  type="button"
                  onClick={() => setAmount(String(b.value))}
                  className="flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-semibold text-slate-600 hover:border-brand-300 hover:bg-brand-50"
                >
                  {b.label}
                </button>
              ))}
            </div>
            <div className="mt-5 flex gap-2">
              <button
                onClick={() => setOpen(false)}
                className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={pay}
                disabled={busy}
                className="flex-1 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                {busy ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : `Pay ${formatMoney(Number(amount) || 0)}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
