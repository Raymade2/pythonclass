import Link from "next/link";
import { requireUser } from "@/lib/auth";
import * as academics from "@/lib/repo/academics";
import { Card, PageHeader, TableWrap, Th, Td, EmptyState } from "@/components/ui";
import { StatusBadge } from "@/components/badges";
import { CrudModalButton } from "@/components/crud-modal-button";
import { ConfirmActionButton } from "@/components/confirm-button";
import { saveClassGroupAction, deleteClassGroupAction } from "@/app/actions/classes";
import type { FormField } from "@/components/data-form";

export const metadata = { title: "Class Groups" };

export default async function ClassGroupsPage() {
  const user = await requireUser(["SUPER_ADMIN", "ADMIN"]);
  const isSuper = user.role === "SUPER_ADMIN";
  const groups = academics.listClassGroupsWithCounts();

  const fields = (row?: { id: number; name: string; description: string | null; status: string }): FormField[] => [
    { name: "name", label: "Group Name", type: "text", required: true, placeholder: "e.g. Early Years", defaultValue: row?.name },
    { name: "description", label: "Description", type: "textarea", placeholder: "What classes belong to this group?", defaultValue: row?.description ?? "", colSpan: 2 },
    {
      name: "status", label: "Status", type: "select", required: true, defaultValue: row?.status ?? "ACTIVE",
      options: [{ value: "ACTIVE", label: "Active" }, { value: "INACTIVE", label: "Inactive" }],
    },
  ];

  return (
    <div>
      <PageHeader title="Class Groups" subtitle="Group classes into academic levels (e.g. Early Years, Primary, Secondary)">
        <CrudModalButton label="Add Class Group" title="Create Class Group" fields={fields()} action={saveClassGroupAction} submitLabel="Create Group" />
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {groups.map((g) => (
          <Card key={g.id} className="flex flex-col p-5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-base font-bold text-slate-800">{g.name}</h3>
                <p className="mt-1 line-clamp-2 min-h-[2.5em] text-xs leading-relaxed text-slate-500">
                  {g.description ?? "No description"}
                </p>
              </div>
              <StatusBadge status={g.status} />
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
              <Link href={`/classes?group=${g.id}`} className="text-sm font-semibold text-brand-600 hover:text-brand-800">
                {g.classCount} class{g.classCount === 1 ? "" : "es"} →
              </Link>
              <div className="flex gap-1.5">
                <CrudModalButton label="Edit" variant="ghost" icon="pencil" title={`Edit ${g.name}`} fields={fields(g)} action={saveClassGroupAction} hidden={{ id: g.id }} submitLabel="Save Changes" />
                {isSuper && (
                  <ConfirmActionButton
                    action={deleteClassGroupAction}
                    payload={{ id: g.id }}
                    label="Delete"
                    confirmTitle={`Delete ${g.name}?`}
                    confirmMessage={g.classCount > 0 ? "This group still has classes and cannot be deleted." : "This action cannot be undone."}
                    confirmLabel="Delete"
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50"
                  />
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {groups.length === 0 && (
        <Card>
          <EmptyState title="No class groups yet" message="Create groups like Early Years, Primary and Secondary to organise your classes." />
        </Card>
      )}

      <Card title="All Groups" className="mt-6">
        {groups.length === 0 ? (
          <EmptyState title="No groups" />
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <Th>Group</Th>
                <Th>Description</Th>
                <Th className="num">Classes</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <tr key={g.id} className="hover:bg-slate-50/60">
                  <Td className="font-semibold text-slate-800">{g.name}</Td>
                  <Td className="max-w-md text-xs text-slate-500">{g.description ?? "—"}</Td>
                  <Td className="num">{g.classCount}</Td>
                  <Td><StatusBadge status={g.status} /></Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}
      </Card>
    </div>
  );
}

