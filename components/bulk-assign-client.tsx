"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2, UserPlus, CheckSquare, Square } from "lucide-react";
import { toast } from "@/components/toast";
import { bulkAssignStudentsAction } from "@/app/actions/students";
import type { StudentListRow } from "@/lib/repo/types";

export function BulkAssignClient({
  students,
  sessionId,
  termId,
  classId,
  className,
}: {
  students: StudentListRow[];
  sessionId: number;
  termId: number;
  classId: number;
  className: string;
}) {
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return students;
    return students.filter((s) =>
      `${s.firstName} ${s.middleName ?? ""} ${s.lastName} ${s.studentCode} ${s.admissionNumber} ${s.parentName ?? ""}`
        .toLowerCase()
        .includes(query)
    );
  }, [students, q]);

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const allVisibleSelected = filtered.length > 0 && filtered.every((s) => selected.has(s.id));

  function toggleAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) filtered.forEach((s) => next.delete(s.id));
      else filtered.forEach((s) => next.add(s.id));
      return next;
    });
  }

  async function assign() {
    if (selected.size === 0 || busy) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set("classId", String(classId));
      fd.set("sessionId", String(sessionId));
      fd.set("termId", String(termId));
      selected.forEach((id) => fd.append("studentIds", String(id)));
      const res = await bulkAssignStudentsAction(fd);
      if (res.ok) {
        toast.success(res.message);
        setSelected(new Set());
        router.refresh();
      } else {
        toast.error(res.message);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Assignment failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search students by name, ID or parent…"
            className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
          />
        </div>
        <button
          onClick={assign}
          disabled={selected.size === 0 || busy}
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
          Assign {selected.size > 0 ? `${selected.size} student${selected.size > 1 ? "s" : ""}` : ""} to {className}
        </button>
      </div>

      <div className="max-h-[420px] overflow-y-auto rounded-xl border border-slate-100">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-slate-50">
            <tr>
              <th className="w-10 px-3 py-2.5">
                <button onClick={toggleAll} className="text-brand-600 hover:text-brand-800" title="Select all">
                  {allVisibleSelected ? <CheckSquare className="h-4.5 w-4.5" /> : <Square className="h-4.5 w-4.5" />}
                </button>
              </th>
              <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">Student</th>
              <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">Student ID</th>
              <th className="hidden px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 sm:table-cell">Parent</th>
              <th className="hidden px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 sm:table-cell">Current Class</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => (
              <tr
                key={s.id}
                onClick={() => toggle(s.id)}
                className={`cursor-pointer border-t border-slate-50 transition hover:bg-brand-50/40 ${selected.has(s.id) ? "bg-brand-50/60" : ""}`}
              >
                <td className="px-3 py-2.5">
                  {selected.has(s.id) ? <CheckSquare className="h-4.5 w-4.5 text-brand-600" /> : <Square className="h-4.5 w-4.5 text-slate-300" />}
                </td>
                <td className="px-3 py-2.5 font-medium text-slate-800">
                  {s.firstName} {s.middleName ?? ""} {s.lastName}
                  <span className="ml-2 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">{s.gender}</span>
                </td>
                <td className="px-3 py-2.5 text-xs text-slate-500">{s.studentCode}</td>
                <td className="hidden px-3 py-2.5 text-xs text-slate-500 sm:table-cell">
                  {s.parentName ?? "—"}
                  {s.parentPhone ? <span className="block text-[10px] text-slate-400">{s.parentPhone}</span> : null}
                </td>
                <td className="hidden px-3 py-2.5 text-xs sm:table-cell">
                  {s.className ? (
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">{s.className}</span>
                  ) : (
                    <span className="text-slate-400">Unassigned</span>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-400">
                  No students found. All students may already be assigned for this term.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-slate-400">
        Showing {filtered.length} student(s) without a {className} assignment for the selected term. Students already in another class will be moved.
      </p>
    </div>
  );
}
