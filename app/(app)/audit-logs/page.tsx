import { requireUser } from "@/lib/auth";
import * as core from "@/lib/repo/core";
import { formatDateTime } from "@/lib/format";
import { Card, PageHeader, TableWrap, Th, Td, EmptyState, Pagination } from "@/components/ui";
import { FilterForm, FilterSelect, FilterInput } from "@/components/filter-form";

export const metadata = { title: "Audit Logs" };

export default async function AuditLogsPage({
  searchParams,
}: {
  searchParams: { q?: string; user?: string; entity?: string; from?: string; to?: string; page?: string };
}) {
  await requireUser(["SUPER_ADMIN"]);
  const q = (searchParams.q ?? "").trim();
  const userId = Number(searchParams.user) || 0;
  const entity = searchParams.entity ?? "";
  const from = searchParams.from ?? "";
  const to = searchParams.to ?? "";
  const page = Math.max(1, Number(searchParams.page) || 1);
  const perPage = 30;

  const { rows, total } = core.listAuditLogs({
    q: q || undefined,
    userId: userId || undefined,
    entity: entity || undefined,
    from: from || undefined,
    to: to || undefined,
    limit: perPage,
    offset: (page - 1) * perPage,
  });
  const totalPages = Math.max(1, Math.ceil(total / perPage));

  const users = core.listUsers();
  const entities = ["User", "Student", "Teacher", "Class", "ClassGroup", "Fee", "OtherPayment", "Invoice", "Payment", "StudentClassAssignment", "TeacherClassAssignment", "AcademicSession", "Term", "School"];

  return (
    <div className="space-y-5">
      <PageHeader title="Audit Logs" subtitle={`${total} recorded administrative action(s)`} />

      <FilterForm basePath="/audit-logs">
        <FilterInput name="q" label="Search Action" defaultValue={q} placeholder="e.g. recorded, created, deleted…" />
        <FilterSelect name="user" label="User" defaultValue={userId ? String(userId) : ""} options={users.map((u) => ({ value: String(u.id), label: u.name }))} />
        <FilterSelect name="entity" label="Entity" defaultValue={entity} options={entities.map((e) => ({ value: e, label: e }))} />
        <FilterInput name="from" label="From" type="date" defaultValue={from} />
        <FilterInput name="to" label="To" type="date" defaultValue={to} />
      </FilterForm>

      <Card>
        {rows.length === 0 ? (
          <EmptyState title="No audit entries" message="Administrative actions will be logged here automatically." />
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <Th>When</Th>
                <Th>User</Th>
                <Th>Action</Th>
                <Th>Entity</Th>
                <Th>Details</Th>
                <Th>IP</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50/60">
                  <Td className="whitespace-nowrap text-xs text-slate-500">{formatDateTime(log.createdAt)}</Td>
                  <Td className="font-medium text-slate-800">{log.userName ?? "System"}</Td>
                  <Td className="max-w-xs text-sm">{log.action}</Td>
                  <Td>
                    {log.entity ? (
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                        {log.entity}{log.entityId ? ` #${log.entityId}` : ""}
                      </span>
                    ) : "—"}
                  </Td>
                  <Td className="max-w-sm">
                    {log.newValue ? (
                      <code className="block max-h-16 overflow-y-auto rounded bg-slate-50 px-2 py-1 text-[10px] leading-relaxed text-slate-500">
                        {log.newValue.length > 220 ? log.newValue.slice(0, 220) + "…" : log.newValue}
                      </code>
                    ) : (
                      <span className="text-xs text-slate-300">—</span>
                    )}
                  </Td>
                  <Td className="font-mono text-[11px] text-slate-400">{log.ip ?? "—"}</Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}
        <Pagination page={page} totalPages={totalPages} baseParams={{ q, user: userId ? String(userId) : "", entity, from, to }} />
      </Card>
    </div>
  );
}
