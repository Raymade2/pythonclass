"use client";

import { useRouter } from "next/navigation";

export function TermPicker({
  sessions,
  termsBySession,
  sessionId,
  termId,
  basePath,
  extraParams = {},
}: {
  sessions: { id: number; name: string }[];
  termsBySession: Record<string, { id: number; name: string }[]>;
  sessionId: number;
  termId: number;
  basePath: string;
  extraParams?: Record<string, string>;
}) {
  const router = useRouter();
  const terms = termsBySession[String(sessionId)] ?? [];

  function nav(next: { session?: number; term?: number }) {
    const params = new URLSearchParams(extraParams);
    const s = next.session ?? sessionId;
    const t = next.term ?? termId;
    params.set("session", String(s));
    // when the session changes, reset the term to the first of that session
    const terms2 = termsBySession[String(s)] ?? [];
    const keepTerm = next.session ? terms2[0]?.id ?? t : t;
    params.set("term", String(keepTerm));
    router.push(`${basePath}?${params.toString()}`);
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      <label className="block">
        <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-400">Academic Session</span>
        <select
          value={sessionId}
          onChange={(e) => nav({ session: Number(e.target.value) })}
          className="h-10 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm font-medium text-slate-700 outline-none focus:border-brand-400"
        >
          {sessions.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-400">Term</span>
        <select
          value={termId}
          onChange={(e) => nav({ term: Number(e.target.value) })}
          className="h-10 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm font-medium text-slate-700 outline-none focus:border-brand-400"
        >
          {terms.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </label>
    </div>
  );
}
