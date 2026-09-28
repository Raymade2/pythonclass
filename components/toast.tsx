"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { CheckCircle2, XCircle, Info, X } from "lucide-react";

type ToastKind = "success" | "error" | "info";
type Toast = { id: number; kind: ToastKind; message: string };

const ToastCtx = createContext<{
  push: (kind: ToastKind, message: string) => void;
}>({ push: () => undefined });

export function useToast() {
  return useContext(ToastCtx);
}

/** Imperative helpers usable from any client component. */
export const toast = {
  success(message: string) {
    window.dispatchEvent(new CustomEvent("sfgs-toast", { detail: { kind: "success", message } }));
  },
  error(message: string) {
    window.dispatchEvent(new CustomEvent("sfgs-toast", { detail: { kind: "error", message } }));
  },
  info(message: string) {
    window.dispatchEvent(new CustomEvent("sfgs-toast", { detail: { kind: "info", message } }));
  },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((kind: ToastKind, message: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, kind, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);

  // Listen for imperative toast events (e.g. from lib/toast helpers)
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { kind: ToastKind; message: string };
      push(detail.kind, detail.message);
    };
    window.addEventListener("sfgs-toast", handler);
    return () => window.removeEventListener("sfgs-toast", handler);
  }, [push]);

  const icons: Record<ToastKind, React.ReactNode> = {
    success: <CheckCircle2 className="h-5 w-5 text-emerald-500" />,
    error: <XCircle className="h-5 w-5 text-red-500" />,
    info: <Info className="h-5 w-5 text-brand-500" />,
  };

  return (
    <ToastCtx.Provider value={{ push }}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="animate-slide-in pointer-events-auto flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-lg"
            role="status"
          >
            {icons[t.kind]}
            <p className="flex-1 text-sm text-slate-700">{t.message}</p>
            <button
              onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))}
              className="rounded p-0.5 text-slate-400 hover:bg-slate-100"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
