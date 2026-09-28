"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Avatar } from "@/components/badges";

type PickStudent = { id: number; name: string; code: string; className: string | null; gender: string };

export function StudentPicker({
  students,
  currentStudentId,
  basePath,
  extraParams = {},
}: {
  students: PickStudent[];
  currentStudentId?: number;
  basePath: string;
  extraParams?: Record<string, string>;
}) {
  const [q, setQ] = useState("");
  const router = useRouter();

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return students.slice(0, 8);
    return students
      .filter((s) => `${s.name} ${s.code} ${s.className ?? ""}`.toLowerCase().includes(query))
      .slice(0, 8);
  }, [students, q]);

  function select(id: number) {
    const params = new URLSearchParams(extraParams);
    params.set("student", String(id));
    router.push(`${basePath}?${params.toString()}`);
  }

  return (
    <div>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search students by name, ID or class…"
          className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm outline-none transition focus:border-brand-400 focus:bg-white focus:ring-2 focus:ring-brand-100"
        />
      </div>
      <div className="mt-3 space-y-1.5">
        {filtered.map((s) => (
          <button
            key={s.id}
            onClick={() => select(s.id)}
            className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${
              s.id === currentStudentId
                ? "border-brand-400 bg-brand-50"
                : "border-slate-200 bg-white hover:border-brand-200 hover:bg-brand-50/40"
            }`}
          >
            <Avatar name={s.name} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-800">{s.name}</p>
              <p className="truncate text-[11px] text-slate-400">
                {s.code} · {s.className ?? "No class"}
              </p>
            </div>
            {s.id === currentStudentId && (
              <span className="rounded-full bg-brand-600 px-2 py-0.5 text-[10px] font-bold text-white">SELECTED</span>
            )}
          </button>
        ))}
        {filtered.length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-300 p-4 text-center text-sm text-slate-400">
            No students match “{q}”.
          </p>
        )}
      </div>
    </div>
  );
}
