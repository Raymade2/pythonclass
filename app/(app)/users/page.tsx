import { requireUser } from "@/lib/auth";
import * as core from "@/lib/repo/core";
import * as people from "@/lib/repo/people";
import * as academics from "@/lib/repo/academics";
import { formatDate, formatDateTime } from "@/lib/format";
import { roleLabel } from "@/lib/constants";
import { Card, PageHeader, TableWrap, Th, Td, EmptyState } from "@/components/ui";
import { StatusBadge, Avatar } from "@/components/badges";
import { CrudModalButton } from "@/components/crud-modal-button";
import { ConfirmActionButton } from "@/components/confirm-button";
import { Modal } from "@/components/modal";
import { ResetPasswordButton } from "./reset-password-button";
import { saveUserAction, setUserStatusAction, deleteUserAction, resetUserPasswordAction } from "@/app/actions/users";
import type { FormField } from "@/components/data-form";
import { ROLES } from "@/lib/constants";

export const metadata = { title: "Users & Roles" };

export default async function UsersPage() {
  const me = await requireUser(["SUPER_ADMIN"]);
  const users = core.listUsers();
  const teachers = people.listTeachers({ status: "ACTIVE" });
  const parents = (await import("@/lib/db")).all<{ id: number; name: string; phone: string }>(`SELECT id, name, phone FROM parents ORDER BY name LIMIT 500`);

  const fields = (u?: core.UserRow): FormField[] => [
    { name: "name", label: "Full Name", type: "text", required: true, defaultValue: u?.name, section: "Account Details" },
    { name: "email", label: "Email", type: "email", required: true, defaultValue: u?.email },
    { name: "phone", label: "Phone", type: "tel", defaultValue: u?.phone ?? "" },
    { name: "username", label: "Username", type: "text", required: true, defaultValue: u?.username },
    {
      name: "role", label: "Role", type: "select", required: true, defaultValue: u?.role ?? "ADMIN",
      options: ROLES.map((r) => ({ value: r, label: roleLabel(r) })),
      help: "Role-based access control is enforced across the entire application",
    },
    {
      name: "teacherId", label: "Linked Teacher (for teacher role)", type: "select", defaultValue: u?.teacherId ? String(u.teacherId) : "",
      options: teachers.map((t) => ({ value: String(t.id), label: `${t.firstName} ${t.lastName} (${t.teacherCode})` })),
      section: "Role Link",
    },
    {
      name: "parentId", label: "Linked Parent (for parent role)", type: "select", defaultValue: u?.parentId ? String(u.parentId) : "",
      options: parents.map((p) => ({ value: String(p.id), label: `${p.name} (${p.phone})` })),
    },
    {
      name: "password", label: u ? "New Password (leave blank to keep)" : "Password", type: "password",
      required: !u, help: "Minimum 8 characters. Stored as a secure bcrypt hash.",
      section: "Security",
    },
    {
      name: "status", label: "Status", type: "select", required: true, defaultValue: u?.status ?? "ACTIVE",
      options: [{ value: "ACTIVE", label: "Active" }, { value: "SUSPENDED", label: "Suspended" }],
    },
  ];

  void academics;

  return (
    <div className="space-y-5">
      <PageHeader title="Users & Roles" subtitle={`${users.length} user account(s) — strict role-based access control`}>
        <CrudModalButton label="Add User" title="Create User Account" fields={fields()} action={saveUserAction} submitLabel="Create User" />
      </PageHeader>

      {/* Role legend */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { role: "SUPER_ADMIN", desc: "Full access: users, settings, audit logs and every module." },
          { role: "ADMIN", desc: "Day-to-day management: students, teachers, classes, fees, payments, reports." },
          { role: "TEACHER", desc: "Assigned classes only: view students, generate invoices, record payments." },
          { role: "PARENT", desc: "Parent portal: view wards' bills, outstanding balance, pay online, receipts." },
        ].map((r) => (
          <div key={r.role} className="rounded-xl border border-slate-200 bg-white p-4 shadow-card">
            <p className="text-sm font-bold text-brand-800">{roleLabel(r.role)}</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">{r.desc}</p>
          </div>
        ))}
      </div>

      <Card>
        {users.length === 0 ? (
          <EmptyState title="No users" />
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <Th>User</Th>
                <Th>Username</Th>
                <Th>Role</Th>
                <Th>Linked Record</Th>
                <Th>Last Login</Th>
                <Th>Status</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50/60">
                  <Td>
                    <div className="flex items-center gap-3">
                      <Avatar name={u.name} />
                      <div>
                        <p className="font-semibold text-slate-800">{u.name}</p>
                        <p className="text-[11px] text-slate-400">{u.email}{u.phone ? ` · ${u.phone}` : ""}</p>
                      </div>
                    </div>
                  </Td>
                  <Td className="font-mono text-xs">{u.username}</Td>
                  <Td>
                    <span className="inline-flex rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-700">
                      {roleLabel(u.role)}
                    </span>
                  </Td>
                  <Td className="text-xs text-slate-500">
                    {u.teacherId ? `Teacher #${u.teacherId}` : u.parentId ? `Parent #${u.parentId}` : "—"}
                  </Td>
                  <Td className="whitespace-nowrap text-xs">{u.lastLoginAt ? formatDateTime(u.lastLoginAt) : "Never"}</Td>
                  <Td><StatusBadge status={u.status} /></Td>
                  <Td className="text-right">
                    <div className="flex justify-end gap-1.5">
                      <CrudModalButton label="Edit" variant="ghost" icon="pencil" title={`Edit ${u.name}`} fields={fields(u)} action={saveUserAction} hidden={{ id: u.id }} submitLabel="Save Changes" />
                      <ResetPasswordButton userId={u.id} userName={u.name} action={resetUserPasswordAction} />
                      {u.id !== me.id && (
                        <>
                          <ConfirmActionButton
                            action={setUserStatusAction}
                            payload={{ id: u.id, status: u.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE" }}
                            label={u.status === "ACTIVE" ? "Suspend" : "Activate"}
                            confirmTitle={u.status === "ACTIVE" ? `Suspend ${u.name}?` : `Reactivate ${u.name}?`}
                            confirmMessage={u.status === "ACTIVE" ? "The user will be signed out and unable to log in." : "The user will be able to log in again."}
                            confirmLabel={u.status === "ACTIVE" ? "Suspend" : "Activate"}
                            className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-amber-600 transition hover:bg-amber-50"
                          />
                          <ConfirmActionButton
                            action={deleteUserAction}
                            payload={{ id: u.id }}
                            label="Delete"
                            confirmTitle={`Delete ${u.name}?`}
                            confirmMessage="This permanently removes the user account. Their audit history is preserved."
                            confirmLabel="Delete User"
                            className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50"
                          />
                        </>
                      )}
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}
      </Card>

      <p className="text-xs text-slate-400">
        Sessions expire after 7 days · passwords are hashed with bcrypt · every administrative action is written to the audit log.
      </p>
    </div>
  );
}
