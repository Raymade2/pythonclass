import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getCurrentAcademic, getClassesForUser } from "@/lib/scope";
import * as academics from "@/lib/repo/academics";
import * as people from "@/lib/repo/people";
import { formatMoney } from "@/lib/format";
import { Card, PageHeader, TableWrap, Th, Td, EmptyState, Pagination } from "@/components/ui";
import { StatusBadge } from "@/components/badges";
import { CrudModalButton } from "@/components/crud-modal-button";
import { ConfirmActionButton } from "@/components/confirm-button";
import { FilterForm, FilterSelect, FilterInput } from "@/components/filter-form";
import { saveClassAction, deleteClassAction } from "@/app/actions/classes";
import type { FormField } from "@/components/data-form";

export const metadata = { title: "Classes" };

export default async function ClassesPage({
  searchParams,
}: {
  searchParams: { q?: string; group?: string; status?: string; page?: string };
}) {
  const user = await requireUser(["SUPER_ADMIN", "ADMIN", "TEACHER"]);
  const current = await getCurrentAcademic();
  const isAdminUser = user.role === "SUPER_ADMIN" || user.role === "ADMIN";

  const groups = academics.listClassGroups();
  const teachers = people.listTeachers({ status: "ACTIVE" });
  const sessions = academics.listSessions();

  const classes = await getClassesForUser(user);

  const q = (searchParams.q ?? "").trim();
  const groupFilter = Number(searchParams.group) || 0;
  const statusFilter = searchParams.status ?? "";
  const page = Math.max(1, Number(searchParams.page) || 1);
  const perPage = 20;

  const filtered = classes.filter((c) => {
    if (q && !`${c.name} ${c.code} ${c.teacherName ?? ""}`.toLowerCase().includes(q.toLowerCase())) return false;
    if (groupFilter && c.classGroupId !== groupFilter) return false;
    if (statusFilter && c.status !== statusFilter) return false;
    return true;
  });
  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const rows = filtered.slice((page - 1) * perPage, page * perPage);

  const fields = (row?: academics.ClassListRow): FormField[] => [
    { name: "name", label: "Class Name", type: "text", required: true, placeholder: "e.g. Primary 5", defaultValue: row?.name },
    { name: "code", label: "Class Code", type: "text", required: true, placeholder: "e.g. PRI-5", defaultValue: row?.code },
    { name: "section", label: "Section", type: "text", placeholder: "e.g. A", defaultValue: row?.section ?? "" },
    {
      name: "classGroupId", label: "Class Group", type: "select", required: true, defaultValue: row?.classGroupId ? String(row.classGroupId) : "",
      options: groups.map((g) => ({ value: String(g.id), label: g.name })),
    },
    {
      name: "sessionId", label: "Academic Session (introduced in)", type: "select", defaultValue: row?.sessionId ? String(row.sessionId) : current ? String(current.session.id) : "",
      options: sessions.map((s) => ({ value: String(s.id), label: s.name })),
    },
    {
      name: "classTeacherId", label: "Class Teacher", type: "select", defaultValue: row?.classTeacherId ? String(row.classTeacherId) : "",
      options: teachers.map((t) => ({ value: String(t.id), label: `${t.firstName} ${t.lastName} (${t.teacherCode})` })),
    },
    { name: "capacity", label: "Maximum Capacity", type: "number", min: 1, max: 500, defaultValue: row?.capacity ?? 30 },
    {
      name: "status", label: "Status", type: "select", required: true, defaultValue: row?.status ?? "ACTIVE",
      options: [{ value: "ACTIVE", label: "Active" }, { value: "INACTIVE", label: "Inactive" }],
    },
  ];

  return (
    <div>
      <PageHeader title="Classes" subtitle={`${classes.length} class(es) configured for the school`}>
        {isAdminUser && (
          <CrudModalButton label="Add Class" title="Create New Class" subtitle="Classes hold students and per-class fee structures" fields={fields()} action={saveClassAction} submitLabel="Create Class" />
        )}
      </PageHeader>

      <FilterForm basePath="/classes">
        <FilterInput name="q" label="Search" defaultValue={q} placeholder="Class name or code…" />
        <FilterSelect name="group" label="Class Group" defaultValue={groupFilter ? String(groupFilter) : ""} options={groups.map((g) => ({ value: String(g.id), label: g.name }))} />
        <FilterSelect name="status" label="Status" defaultValue={statusFilter} options={[{ value: "ACTIVE", label: "Active" }, { value: "INACTIVE", label: "Inactive" }]} />
      </FilterForm>

      <div className="mt-4">
        <Card>
          {rows.length === 0 ? (
            <EmptyState title="No classes found" message="Adjust your filters or create a new class." />
          ) : (
            <TableWrap>
              <thead>
                <tr>
                  <Th>Class</Th>
                  <Th>Code</Th>
                  <Th>Group</Th>
                  <Th>Class Teacher</Th>
                  <Th className="num">Students</Th>
                  <Th className="num">Term Fees</Th>
                  <Th className="num">Capacity</Th>
                  <Th>Status</Th>
                  {isAdminUser && <Th className="text-right">Actions</Th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/60">
                    <Td className="font-semibold text-slate-800">{c.name}</Td>
                    <Td><span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600">{c.code}</span></Td>
                    <Td>{c.groupName ?? "—"}</Td>
                    <Td>{c.teacherName ?? <span className="text-slate-400">Not assigned</span>}</Td>
                    <Td className="num">
                      {current ? (
                        <Link href={`/students?class=${c.id}&session=${current.session.id}&term=${current.term.id}`} className="font-semibold text-brand-700 hover:underline">
                          {c.studentCount}
                        </Link>
                      ) : (
                        c.studentCount
                      )}
                    </Td>
                    <Td className="num">{formatMoney(c.feeTotal)}</Td>
                    <Td className="num">{c.capacity}</Td>
                    <Td><StatusBadge status={c.status} /></Td>
                    {isAdminUser && (
                      <Td className="text-right">
                        <div className="flex justify-end gap-1.5">
                          <CrudModalButton label="Edit" variant="ghost" icon="pencil" title={`Edit ${c.name}`} fields={fields(c)} action={saveClassAction} hidden={{ id: c.id }} submitLabel="Save Changes" />
                          <ConfirmActionButton
                            action={deleteClassAction}
                            payload={{ id: c.id }}
                            label="Delete"
                            confirmTitle={`Delete ${c.name}?`}
                            confirmMessage="Classes with students, fees or teacher assignments will be deactivated instead of deleted."
                            confirmLabel="Delete / Deactivate"
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50"
                          />
                        </div>
                      </Td>
                    )}
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          )}
          <Pagination page={page} totalPages={totalPages} baseParams={{ q, group: groupFilter ? String(groupFilter) : "", status: statusFilter }} />
        </Card>
      </div>
    </div>
  );
}

