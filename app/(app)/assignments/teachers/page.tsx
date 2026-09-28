import { requireUser } from "@/lib/auth";
import { getCurrentAcademic } from "@/lib/scope";
import * as academics from "@/lib/repo/academics";
import * as people from "@/lib/repo/people";
import { formatDate } from "@/lib/format";
import { Card, PageHeader, TableWrap, Th, Td, EmptyState, Pagination } from "@/components/ui";
import { FilterForm, FilterSelect } from "@/components/filter-form";
import { CrudModalButton } from "@/components/crud-modal-button";
import { ConfirmActionButton } from "@/components/confirm-button";
import { assignTeacherClassAction, removeTeacherAssignmentAction } from "@/app/actions/teachers";
import type { FormField } from "@/components/data-form";

export const metadata = { title: "Teacher-Class Assignment" };

export default async function TeacherAssignmentPage({
  searchParams,
}: {
  searchParams: { session?: string; term?: string; class?: string; teacher?: string; page?: string };
}) {
  await requireUser(["SUPER_ADMIN", "ADMIN"]);
  const current = await getCurrentAcademic();
  const sessions = academics.listSessions();

  const sessionId = Number(searchParams.session) || current?.session.id || 0;
  const session = sessions.find((s) => s.id === sessionId);
  const terms = session ? academics.listTermsForSession(session.id) : [];
  const termId = Number(searchParams.term) || terms.find((t) => t.isCurrent)?.id || terms[0]?.id || 0;

  const classes = academics.listClasses({ status: "ACTIVE" });
  const teachers = people.listTeachers({ status: "ACTIVE" });

  const classFilter = Number(searchParams.class) || 0;
  const teacherFilter = Number(searchParams.teacher) || 0;
  const page = Math.max(1, Number(searchParams.page) || 1);
  const perPage = 25;

  const all = academics.listTeacherAssignments({
    sessionId,
    termId,
    classId: classFilter || undefined,
    teacherId: teacherFilter || undefined,
  });
  const totalPages = Math.max(1, Math.ceil(all.length / perPage));
  const rows = all.slice((page - 1) * perPage, page * perPage);

  const fields: FormField[] = [
    {
      name: "teacherId", label: "Teacher", type: "select", required: true,
      options: teachers.map((t) => ({ value: String(t.id), label: `${t.firstName} ${t.lastName} (${t.teacherCode})` })),
      section: "Assignment",
    },
    {
      name: "classId", label: "Class", type: "select", required: true,
      options: classes.map((c) => ({ value: String(c.id), label: c.name })),
    },
    {
      name: "role", label: "Role", type: "select", required: true, defaultValue: "CLASS_TEACHER",
      options: [
        { value: "CLASS_TEACHER", label: "Class Teacher (primary)" },
        { value: "SUBJECT_TEACHER", label: "Subject Teacher" },
      ],
    },
    {
      name: "subject", label: "Subject (for subject teachers)", type: "text", placeholder: "e.g. Mathematics",
      help: "Only one class teacher is allowed per class per term",
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader title="Teacher-Class Assignment" subtitle={`${all.length} assignment(s) for ${session?.name ?? ""} — ${terms.find((t) => t.id === termId)?.name ?? ""}`}>
        <CrudModalButton
          label="Assign Teacher"
          title="Assign Teacher to Class"
          subtitle="A class may have one primary class teacher and additional subject teachers"
          fields={fields}
          action={assignTeacherClassAction}
          hidden={{ sessionId, termId }}
          submitLabel="Assign Teacher"
        />
      </PageHeader>

      <FilterForm basePath="/assignments/teachers">
        <FilterSelect name="session" label="Session" defaultValue={String(sessionId)} allLabel="—" options={sessions.map((s) => ({ value: String(s.id), label: s.name }))} />
        <FilterSelect name="term" label="Term" defaultValue={String(termId)} allLabel="—" options={terms.map((t) => ({ value: String(t.id), label: t.name }))} />
        <FilterSelect name="class" label="Class" defaultValue={classFilter ? String(classFilter) : ""} options={classes.map((c) => ({ value: String(c.id), label: c.name }))} />
        <FilterSelect name="teacher" label="Teacher" defaultValue={teacherFilter ? String(teacherFilter) : ""} options={teachers.map((t) => ({ value: String(t.id), label: `${t.firstName} ${t.lastName}` }))} />
      </FilterForm>

      <Card>
        {rows.length === 0 ? (
          <EmptyState title="No assignments found" message="Assign teachers to classes using the button above." />
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <Th>Teacher</Th>
                <Th>Teacher ID</Th>
                <Th>Class</Th>
                <Th>Role</Th>
                <Th>Subject</Th>
                <Th>Assigned</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.id} className="hover:bg-slate-50/60">
                  <Td className="font-semibold text-slate-800">{a.firstName} {a.lastName}</Td>
                  <Td><span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600">{a.teacherCode}</span></Td>
                  <Td>{a.className}</Td>
                  <Td>
                    {a.role === "CLASS_TEACHER" ? (
                      <span className="inline-flex items-center rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-700 ring-1 ring-inset ring-brand-200">Class Teacher</span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">Subject Teacher</span>
                    )}
                  </Td>
                  <Td className="text-xs">{a.subject ?? "—"}</Td>
                  <Td className="whitespace-nowrap text-xs">{formatDate(a.assignedAt)}</Td>
                  <Td className="text-right">
                    <ConfirmActionButton
                      action={removeTeacherAssignmentAction}
                      payload={{ id: a.id }}
                      label="Remove"
                      confirmTitle="Remove assignment?"
                      confirmMessage={`${a.firstName} ${a.lastName} will no longer teach ${a.className}.`}
                      confirmLabel="Remove"
                      className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50"
                    />
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}
        <Pagination
          page={page}
          totalPages={totalPages}
          baseParams={{
            session: String(sessionId),
            term: String(termId),
            class: classFilter ? String(classFilter) : "",
            teacher: teacherFilter ? String(teacherFilter) : "",
          }}
        />
      </Card>
    </div>
  );
}
