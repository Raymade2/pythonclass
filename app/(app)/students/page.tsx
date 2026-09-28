import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getCurrentAcademic, getScope } from "@/lib/scope";
import * as people from "@/lib/repo/people";
import * as academics from "@/lib/repo/academics";
import { formatDate, toISODateInput } from "@/lib/format";
import { Card, PageHeader, TableWrap, Th, Td, EmptyState, Pagination } from "@/components/ui";
import { StatusBadge, Avatar } from "@/components/badges";
import { FilterForm, FilterSelect, FilterInput } from "@/components/filter-form";
import { STUDENT_STATUSES } from "@/lib/constants";

export const metadata = { title: "Students" };

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: { q?: string; class?: string; status?: string; gender?: string; page?: string };
}) {
  const user = await requireUser(["SUPER_ADMIN", "ADMIN", "TEACHER"]);
  const current = await getCurrentAcademic();
  const scope = await getScope(user);

  const q = (searchParams.q ?? "").trim();
  const classId = Number(searchParams.class) || 0;
  const status = searchParams.status ?? "";
  const gender = searchParams.gender ?? "";
  const page = Math.max(1, Number(searchParams.page) || 1);
  const perPage = 25;

  const classes = academics.listClasses({ status: "ACTIVE" });
  const { rows, total } = people.listStudents({
    q: q || undefined,
    classId: classId || undefined,
    sessionId: current?.session.id,
    termId: current?.term.id,
    status: status || undefined,
    gender: gender || undefined,
    limit: perPage,
    offset: (page - 1) * perPage,
  });
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const base = { q, class: classId ? String(classId) : "", status, gender };
  const qs = new URLSearchParams(Object.entries(base).filter(([, v]) => v)).toString();

  return (
    <div>
      <PageHeader
        title="Students"
        subtitle={`${total} student(s) ${user.role === "TEACHER" ? "in your assigned classes" : "on record"}`}
      >
        {user.role !== "TEACHER" && (
          <Link
            href="/students/new"
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-brand-700"
          >
            + Enrol Student
          </Link>
        )}
      </PageHeader>

      <FilterForm basePath="/students">
        <FilterInput name="q" label="Search" defaultValue={q} placeholder="Name, student ID, admission no, parent phone…" />
        <FilterSelect name="class" label="Class (current term)" defaultValue={classId ? String(classId) : ""} options={classes.map((c) => ({ value: String(c.id), label: c.name }))} />
        <FilterSelect name="status" label="Status" defaultValue={status} options={STUDENT_STATUSES.map((s) => ({ value: s, label: s }))} />
        <FilterSelect name="gender" label="Gender" defaultValue={gender} options={[{ value: "Male", label: "Male" }, { value: "Female", label: "Female" }]} />
      </FilterForm>

      <div className="mt-4">
        <Card>
          {rows.length === 0 ? (
            <EmptyState title="No students found" message="Adjust your filters or enrol a new student." />
          ) : (
            <TableWrap>
              <thead>
                <tr>
                  <Th>Student</Th>
                  <Th>Student ID</Th>
                  <Th>Class</Th>
                  <Th>Gender</Th>
                  <Th>Parent / Guardian</Th>
                  <Th>Admitted</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Actions</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/60">
                    <Td>
                      <div className="flex items-center gap-3">
                        <Avatar name={`${s.firstName} ${s.lastName}`} />
                        <div>
                          <p className="font-semibold text-slate-800">
                            {s.firstName} {s.middleName ?? ""} {s.lastName}
                          </p>
                          <p className="text-[11px] text-slate-400">{s.admissionNumber}</p>
                        </div>
                      </div>
                    </Td>
                    <Td><span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600">{s.studentCode}</span></Td>
                    <Td>{s.className ?? <span className="text-slate-400">Unassigned</span>}</Td>
                    <Td>{s.gender}</Td>
                    <Td>
                      <p className="text-xs font-medium text-slate-700">{s.parentName ?? "—"}</p>
                      <p className="text-[11px] text-slate-400">{s.parentPhone ?? ""}</p>
                    </Td>
                    <Td className="whitespace-nowrap text-xs">{formatDate(s.admissionDate)}</Td>
                    <Td><StatusBadge status={s.status} /></Td>
                    <Td className="text-right">
                      <Link
                        href={`/students/${s.id}`}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-brand-700 transition hover:border-brand-300 hover:bg-brand-50"
                      >
                        View Profile
                      </Link>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          )}
          <Pagination page={page} totalPages={totalPages} baseParams={base} />
        </Card>
      </div>
    </div>
  );
}
