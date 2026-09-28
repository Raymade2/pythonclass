import { requireUser } from "@/lib/auth";
import { getCurrentAcademic } from "@/lib/scope";
import * as academics from "@/lib/repo/academics";
import * as people from "@/lib/repo/people";
import { formatDate } from "@/lib/format";
import { Card, PageHeader, TableWrap, Th, Td, EmptyState } from "@/components/ui";
import { StatusBadge } from "@/components/badges";
import { FilterForm, FilterSelect } from "@/components/filter-form";
import { BulkAssignClient } from "@/components/bulk-assign-client";

export const metadata = { title: "Student-Class Assignment" };

export default async function StudentAssignmentPage({
  searchParams,
}: {
  searchParams: { session?: string; term?: string; class?: string };
}) {
  await requireUser(["SUPER_ADMIN", "ADMIN"]);
  const current = await getCurrentAcademic();
  const sessions = academics.listSessions();

  const sessionId = Number(searchParams.session) || current?.session.id || 0;
  const session = sessions.find((s) => s.id === sessionId);
  const terms = session ? academics.listTermsForSession(session.id) : [];
  const termId = Number(searchParams.term) || terms.find((t) => t.isCurrent)?.id || terms[0]?.id || 0;

  const classes = academics.listClasses({ status: "ACTIVE" });
  const classId = Number(searchParams.class) || classes[0]?.id || 0;
  const cls = classes.find((c) => c.id === classId);

  // Current roster for the selected class/term
  const roster = classId && termId ? academics.listStudentAssignments({ sessionId, termId, classId, limit: 500 }) : { rows: [], total: 0 };

  // Students that could be assigned (not in the selected class for this term)
  const allStudents = people.listStudents({ sessionId, termId, limit: 1000 }).rows;
  const inClass = new Set(roster.rows.map((r) => r.studentId));
  const candidates = allStudents.filter((s) => !inClass.has(s.id) && s.status === "ACTIVE");

  return (
    <div className="space-y-5">
      <PageHeader
        title="Student-Class Assignment"
        subtitle="Assign students to classes per session & term — supports bulk assignment"
      />

      <FilterForm basePath="/assignments/students">
        <FilterSelect name="session" label="Session" defaultValue={String(sessionId)} allLabel="—" options={sessions.map((s) => ({ value: String(s.id), label: s.name }))} />
        <FilterSelect name="term" label="Term" defaultValue={String(termId)} allLabel="—" options={terms.map((t) => ({ value: String(t.id), label: t.name }))} />
        <FilterSelect name="class" label="Class" defaultValue={String(classId)} allLabel="—" options={classes.map((c) => ({ value: String(c.id), label: c.name }))} />
      </FilterForm>

      {!cls ? (
        <Card>
          <EmptyState title="Select a class" message="Choose a session, term and class above to manage assignments." />
        </Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          <Card
            title={`${cls.name} — Current Roster`}
            subtitle={`${roster.total} student(s) assigned · capacity ${cls.capacity}`}
          >
            {roster.rows.length === 0 ? (
              <EmptyState title="No students yet" message="Assign students from the panel on the right." />
            ) : (
              <TableWrap>
                <thead>
                  <tr>
                    <Th>Student</Th>
                    <Th>Student ID</Th>
                    <Th>Assigned</Th>
                    <Th>By</Th>
                  </tr>
                </thead>
                <tbody>
                  {roster.rows.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/60">
                      <Td className="font-medium text-slate-800">
                        {r.firstName} {r.lastName}
                        <span className="ml-2 inline-flex"><StatusBadge status={(r as { studentStatus?: string }).studentStatus ?? "ACTIVE"} /></span>
                      </Td>
                      <Td className="text-xs text-slate-500">{r.studentCode}</Td>
                      <Td className="whitespace-nowrap text-xs">{formatDate(r.assignedAt)}</Td>
                      <Td className="text-xs text-slate-500">{r.assignedByName ?? "—"}</Td>
                    </tr>
                  ))}
                </tbody>
              </TableWrap>
            )}
          </Card>

          <Card title={`Assign Students to ${cls.name}`} subtitle="Search, select multiple and assign in one action">
            <BulkAssignClient
              students={candidates}
              sessionId={sessionId}
              termId={termId}
              classId={cls.id}
              className={cls.name}
            />
          </Card>
        </div>
      )}
    </div>
  );
}
