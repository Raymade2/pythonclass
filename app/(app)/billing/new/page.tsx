import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getCurrentAcademic, getScope } from "@/lib/scope";
import * as academics from "@/lib/repo/academics";
import * as people from "@/lib/repo/people";
import * as finance from "@/lib/repo/finance";
import { formatMoney, formatDate } from "@/lib/format";
import { Card, PageHeader, EmptyState } from "@/components/ui";
import { StatusBadge } from "@/components/badges";
import { StudentPicker } from "@/components/student-picker";
import { TermPicker } from "@/components/term-picker";
import { GenerateInvoiceClient } from "@/components/generate-invoice-client";

export const metadata = { title: "Generate Invoice" };

export default async function NewInvoicePage({
  searchParams,
}: {
  searchParams: { student?: string; session?: string; term?: string };
}) {
  const user = await requireUser(["SUPER_ADMIN", "ADMIN", "TEACHER", "PARENT"]);
  const current = await getCurrentAcademic();
  const scope = await getScope(user);

  const sessions = academics.listSessions();
  const termsBySession: Record<string, { id: number; name: string }[]> = {};
  for (const s of sessions) {
    termsBySession[String(s.id)] = academics.listTermsForSession(s.id).map((t) => ({ id: t.id, name: t.name }));
  }

  const sessionId = Number(searchParams.session) || current?.session.id || 0;
  const session = sessions.find((s) => s.id === sessionId);
  const terms = session ? academics.listTermsForSession(session.id) : [];
  const termId = Number(searchParams.term) || terms.find((t) => t.isCurrent)?.id || terms[0]?.id || 0;

  const studentId = Number(searchParams.student) || 0;

  // Scoped student list for the picker
  const pickList = people
    .listStudents({ studentIds: scope.studentIds ?? undefined, limit: 1000 })
    .rows.map((s) => ({
      id: s.id,
      name: `${s.firstName} ${s.middleName ?? ""} ${s.lastName}`.trim(),
      code: s.studentCode,
      className: s.className,
      gender: s.gender,
    }));

  const student = studentId ? people.getStudentListRow(studentId) : null;
  const roleError =
    student && scope.studentIds !== null && !scope.studentIds.includes(student.id)
      ? "You can only generate payments for your own students."
      : null;

  // Access control for selected student
  const allowed = !student || roleError === null;
  void allowed;

  const assignment =
    student && sessionId && termId ? academics.getStudentClassAssignment(student.id, sessionId, termId) : null;
  const cls = assignment ? academics.getClassById(assignment.classId) : null;

  const availableFees =
    student && assignment && !roleError
      ? finance.availableFeesForStudent(student.id, assignment.classId, sessionId, termId)
      : [];
  const applicableOthers =
    student && !roleError
      ? finance.applicableOtherPaymentsForStudent(student.id, assignment?.classId ?? null, cls?.classGroupId ?? null, sessionId, termId)
      : [];

  const summary = student ? finance.studentFinancialSummary(student.id, sessionId, termId) : null;
  const previousPayments = student ? finance.paymentsForStudent(student.id).slice(0, 5) : [];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Generate Payment / Invoice"
        subtitle="Student → select fees → review → generate invoice & payment reference"
      >
        <Link
          href="/billing"
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
        >
          ← Back to Billing
        </Link>
      </PageHeader>

      <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
        {/* Step 1-3: student + session/term */}
        <div className="space-y-4">
          <Card title="1 · Select Student" subtitle={`${pickList.length} student(s) available to you`}>
            <div className="p-4">
              <StudentPicker
                students={pickList}
                currentStudentId={studentId || undefined}
                basePath="/billing/new"
                extraParams={{ session: String(sessionId), term: String(termId) }}
              />
            </div>
          </Card>
          <Card title="2 · Session & Term">
            <div className="p-4">
              <TermPicker
                sessions={sessions.map((s) => ({ id: s.id, name: s.name }))}
                termsBySession={termsBySession}
                sessionId={sessionId}
                termId={termId}
                basePath="/billing/new"
                extraParams={studentId ? { student: String(studentId) } : {}}
              />
            </div>
          </Card>
        </div>

        {/* Step 3-6: student details + fees */}
        <div className="space-y-4">
          {!student ? (
            <Card>
              <EmptyState
                title="Select a student to begin"
                message="Pick a student from the list on the left. Their details, class and applicable fees will appear here."
              />
            </Card>
          ) : (
            <>
              <Card title="3 · Student Details" subtitle="Confirmed from the school records">
                <div className="grid gap-4 p-5 sm:grid-cols-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase text-slate-400">Student</p>
                    <p className="text-base font-bold text-slate-900">
                      {student.firstName} {student.middleName ?? ""} {student.lastName}
                    </p>
                    <p className="text-xs text-slate-500">{student.studentCode} · {student.admissionNumber}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase text-slate-400">Class ({terms.find((t) => t.id === termId)?.name ?? ""})</p>
                    <p className="text-base font-bold text-slate-900">{cls?.name ?? "Not assigned"}</p>
                    <p className="text-xs text-slate-500">{cls?.groupName ?? "—"}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase text-slate-400">Parent / Guardian</p>
                    <p className="text-sm font-semibold text-slate-800">{student.parentName ?? "—"}</p>
                    <p className="text-xs text-slate-500">{student.parentPhone ?? ""}</p>
                  </div>
                </div>
                {roleError && (
                  <p className="mx-5 mb-5 rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-700">{roleError}</p>
                )}
              </Card>

              {summary && (
                <Card title="4 · Outstanding Balance & Previous Payments" subtitle="Before this new invoice">
                  <div className="grid grid-cols-3 gap-3 p-5">
                    <div className="rounded-xl bg-slate-50 p-3">
                      <p className="text-[11px] font-semibold uppercase text-slate-400">Total Charges</p>
                      <p className="text-lg font-bold tabular-nums text-slate-800">{formatMoney(summary.totalCharges)}</p>
                    </div>
                    <div className="rounded-xl bg-emerald-50 p-3">
                      <p className="text-[11px] font-semibold uppercase text-emerald-600">Total Paid</p>
                      <p className="text-lg font-bold tabular-nums text-emerald-700">{formatMoney(summary.totalPaid)}</p>
                    </div>
                    <div className="rounded-xl bg-amber-50 p-3">
                      <p className="text-[11px] font-semibold uppercase text-amber-600">Outstanding</p>
                      <p className="text-lg font-bold tabular-nums text-amber-700">{formatMoney(summary.outstanding)}</p>
                    </div>
                  </div>
                  {previousPayments.length > 0 && (
                    <div className="border-t border-slate-100 px-5 py-4">
                      <p className="mb-2 text-[11px] font-semibold uppercase text-slate-400">Recent payments</p>
                      <ul className="space-y-1.5">
                        {previousPayments.map((p) => (
                          <li key={p.id} className="flex items-center justify-between gap-3 text-xs">
                            <span className="text-slate-600">
                              {formatDate(p.paymentDate)} · {p.method}
                              {p.invoiceNumber ? ` · ${p.invoiceNumber}` : ""}
                            </span>
                            <span className="font-semibold tabular-nums text-slate-800">{formatMoney(p.amount)}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </Card>
              )}

              {!roleError && (
                <Card title="5 · Applicable Fees & Payments" subtitle="Select the items to bill, then generate">
                  <div className="p-5">
                    <GenerateInvoiceClient
                      studentId={student.id}
                      sessionId={sessionId}
                      termId={termId}
                      fees={availableFees.map((f) => ({
                        id: f.id,
                        label: f.name,
                        sublabel: `${f.categoryName}${f.dueDate ? ` · due ${formatDate(f.dueDate)}` : ""}`,
                        amount: f.amount,
                        dueDate: f.dueDate,
                        mandatory: Boolean(f.mandatory),
                        kind: "fee" as const,
                      }))}
                      others={applicableOthers.map((o) => ({
                        id: o.id,
                        label: o.name,
                        sublabel: `${o.category}${o.dueDate ? ` · due ${formatDate(o.dueDate)}` : ""}`,
                        amount: o.amount,
                        dueDate: o.dueDate,
                        mandatory: Boolean(o.mandatory),
                        kind: "other" as const,
                      }))}
                    />
                  </div>
                </Card>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
