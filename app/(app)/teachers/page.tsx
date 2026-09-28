import Link from "next/link";
import { requireUser } from "@/lib/auth";
import * as people from "@/lib/repo/people";
import { formatDate, toISODateInput } from "@/lib/format";
import { Card, PageHeader, TableWrap, Th, Td, EmptyState, Pagination } from "@/components/ui";
import { StatusBadge, Avatar } from "@/components/badges";
import { CrudModalButton } from "@/components/crud-modal-button";
import { ConfirmActionButton } from "@/components/confirm-button";
import { FilterForm, FilterSelect, FilterInput } from "@/components/filter-form";
import { saveTeacherAction, setTeacherStatusAction } from "@/app/actions/teachers";
import type { FormField } from "@/components/data-form";

export const metadata = { title: "Teachers" };

export default async function TeachersPage({
  searchParams,
}: {
  searchParams: { q?: string; status?: string; page?: string };
}) {
  await requireUser(["SUPER_ADMIN", "ADMIN"]);
  const q = (searchParams.q ?? "").trim();
  const status = searchParams.status ?? "";
  const page = Math.max(1, Number(searchParams.page) || 1);
  const perPage = 20;

  const all = people.listTeachers({ q: q || undefined, status: status || undefined });
  const totalPages = Math.max(1, Math.ceil(all.length / perPage));
  const rows = all.slice((page - 1) * perPage, page * perPage);

  const fields = (t?: people.TeacherListRow): FormField[] => [
    { name: "firstName", label: "First Name", type: "text", required: true, defaultValue: t?.firstName, section: "Teacher Information" },
    { name: "lastName", label: "Last Name", type: "text", required: true, defaultValue: t?.lastName },
    { name: "gender", label: "Gender", type: "select", options: [{ value: "Male", label: "Male" }, { value: "Female", label: "Female" }], defaultValue: t?.gender ?? "Male" },
    { name: "phone", label: "Phone", type: "tel", placeholder: "+234 …", defaultValue: t?.phone ?? "" },
    { name: "email", label: "Email", type: "email", defaultValue: t?.email ?? "" },
    { name: "address", label: "Address", type: "textarea", defaultValue: t?.address ?? "", colSpan: 2 },
    { name: "qualification", label: "Qualification", type: "text", placeholder: "e.g. B.Ed (UNN)", defaultValue: t?.qualification ?? "", section: "Employment" },
    { name: "specialization", label: "Specialization / Subject", type: "text", placeholder: "e.g. Mathematics", defaultValue: t?.specialization ?? "" },
    { name: "dateEmployed", label: "Date Employed", type: "date", defaultValue: t?.dateEmployed ? toISODateInput(t.dateEmployed) : "" },
    { name: "photoUrl", label: "Passport Photograph (URL)", type: "text", placeholder: "https://…", defaultValue: t?.photoUrl ?? "" },
    {
      name: "status", label: "Status", type: "select", required: true, defaultValue: t?.status ?? "ACTIVE",
      options: [{ value: "ACTIVE", label: "Active" }, { value: "INACTIVE", label: "Inactive" }],
    },
  ];

  return (
    <div>
      <PageHeader title="Teachers" subtitle={`${people.listTeachers().length} teacher(s) on record`}>
        <CrudModalButton label="Enrol Teacher" title="Enrol New Teacher" fields={fields()} action={saveTeacherAction} submitLabel="Enrol Teacher" />
      </PageHeader>

      <FilterForm basePath="/teachers">
        <FilterInput name="q" label="Search" defaultValue={q} placeholder="Name, code, phone or email…" />
        <FilterSelect name="status" label="Status" defaultValue={status} options={[{ value: "ACTIVE", label: "Active" }, { value: "INACTIVE", label: "Inactive" }]} />
      </FilterForm>

      <div className="mt-4">
        <Card>
          {rows.length === 0 ? (
            <EmptyState title="No teachers found" message="Adjust your filters or enrol a new teacher." />
          ) : (
            <TableWrap>
              <thead>
                <tr>
                  <Th>Teacher</Th>
                  <Th>Teacher ID</Th>
                  <Th>Gender</Th>
                  <Th>Contact</Th>
                  <Th>Qualification</Th>
                  <Th>Date Employed</Th>
                  <Th className="num">Classes</Th>
                  <Th>Portal</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Actions</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/60">
                    <Td>
                      <div className="flex items-center gap-3">
                        <Avatar name={`${t.firstName} ${t.lastName}`} />
                        <div>
                          <p className="font-semibold text-slate-800">{t.firstName} {t.lastName}</p>
                          <p className="text-[11px] text-slate-400">{t.specialization ?? "General"}</p>
                        </div>
                      </div>
                    </Td>
                    <Td><span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600">{t.teacherCode}</span></Td>
                    <Td>{t.gender ?? "—"}</Td>
                    <Td>
                      <p className="text-xs">{t.phone ?? "—"}</p>
                      <p className="text-[11px] text-slate-400">{t.email ?? ""}</p>
                    </Td>
                    <Td className="text-xs">{t.qualification ?? "—"}</Td>
                    <Td className="whitespace-nowrap text-xs">{formatDate(t.dateEmployed)}</Td>
                    <Td className="num">
                      <Link href={`/assignments/teachers?teacher=${t.id}`} className="font-semibold text-brand-700 hover:underline">{t.classCount}</Link>
                    </Td>
                    <Td>{t.hasAccount ? <span className="text-[11px] font-semibold text-emerald-600">● Active</span> : <span className="text-[11px] text-slate-400">—</span>}</Td>
                    <Td><StatusBadge status={t.status} /></Td>
                    <Td className="text-right">
                      <div className="flex justify-end gap-1.5">
                        <CrudModalButton label="Edit" variant="ghost" icon="pencil" title={`Edit ${t.firstName} ${t.lastName}`} fields={fields(t)} action={saveTeacherAction} hidden={{ id: t.id }} submitLabel="Save Changes" />
                        <ConfirmActionButton
                          action={setTeacherStatusAction}
                          payload={{ id: t.id, status: t.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" }}
                          label={t.status === "ACTIVE" ? "Deactivate" : "Activate"}
                          confirmTitle={t.status === "ACTIVE" ? `Deactivate ${t.firstName} ${t.lastName}?` : `Reactivate ${t.firstName} ${t.lastName}?`}
                          confirmMessage={t.status === "ACTIVE" ? "Their portal account will also be suspended." : "The teacher will be able to use the portal again."}
                          confirmLabel={t.status === "ACTIVE" ? "Deactivate" : "Activate"}
                          danger={t.status === "ACTIVE"}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50"
                        />
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          )}
          <Pagination page={page} totalPages={totalPages} baseParams={{ q, status }} />
        </Card>
      </div>
    </div>
  );
}
