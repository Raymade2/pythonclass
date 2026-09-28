"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Lock, Mail } from "lucide-react";
import { toast } from "@/components/toast";
import { loginAction } from "@/app/actions/auth";

export function LoginForm() {
  const [busy, setBusy] = useState(false);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const router = useRouter();
  const params = useSearchParams();

  // Pre-fill from demo account buttons (?demo=email|password)
  useEffect(() => {
    const demo = params.get("demo");
    if (demo && demo.includes("|")) {
      const [email, pass] = demo.split("|");
      setIdentifier(email);
      setPassword(pass);
    }
  }, [params]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set("identifier", identifier);
      fd.set("password", password);
      const res = await loginAction(fd);
      if (res.ok) {
        toast.success(res.message);
        router.push("/dashboard");
        router.refresh();
      } else {
        toast.error(res.message);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  const inputCls =
    "w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-brand-400 focus:bg-white focus:ring-2 focus:ring-brand-100";

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4">
      <div>
        <label htmlFor="identifier" className="mb-1.5 block text-xs font-semibold text-slate-600">
          Email or username
        </label>
        <div className="relative">
          <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            id="identifier"
            type="text"
            autoComplete="username"
            required
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="you@sfgs.edu.ng"
            className={inputCls}
          />
        </div>
      </div>
      <div>
        <label htmlFor="password" className="mb-1.5 block text-xs font-semibold text-slate-600">
          Password
        </label>
        <div className="relative">
          <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className={inputCls}
          />
        </div>
      </div>
      <button
        type="submit"
        disabled={busy}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-300 disabled:opacity-60"
      >
        {busy && <Loader2 className="h-4 w-4 animate-spin" />}
        {busy ? "Signing in…" : "Sign In"}
      </button>
      <p className="text-center text-[11px] text-slate-400">
        Protected area — access is role-based and every activity is logged.
      </p>
    </form>
  );
}
