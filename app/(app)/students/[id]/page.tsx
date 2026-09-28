import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Mail, Phone, MapPin, CalendarDays, User, Wallet, ReceiptText, Coins, AlertTriangle, ArrowLeftRight, BadgeCheck,
} from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getCurrentAcademic, getScope } from "@/lib/scope";
import * as people from "@/lib/repo/people";
import * as academics from "@/lib/repo/academics";
import * as finance from "@/lib/repo/finance";
import { formatDate, formatMoney, toISODateInput } from "@/lib/format";
import { Card, PageHeader, TableWrap, Th, Td, EmptyState, StatCard } from "@/components/ui";
import { StatusBadge, Avatar } from "@/components/badges";
import { CrudModalButton } from "@/components/crud-modal-button";
import { ConfirmActionButton } from "@/components/confirm-button";
import { sendPaymentReminderAction } from "@/app/actions/payments";
import { assignStudentClassAction, setStudentStatusAction } from "@/app/actions/students";
import type { FormField } from "@/components/data-form";

export const metadata = { title: "Student Profile" };

export default async function StudentProfilePage({ params }: { params: { id: string } }) {
  const user = await requireUser(["SUPER_ADMIN", "ADMIN", "TEACHER"]);
  const id = Number(params.id);
  if (!Number.isFinite(id)) notFound();

  const student = people.getStudentListRow(id);
  if (!student) notFound();

  // Access control
  const scope = await getScope(user);
  if (scope.studentIds !== null && !scope.studentIds.includes(id)) notFound();

  const current = await getCurrentAcademic();
  const sessions = academics.listSessions();
  const classes = academics.listClasses({ status: "ACTIVE" });
  const history = people.getStudentById(id);

  const summary = finance.studentFinancialSummary(id, current?.session.id, current?.term.id);
  const allTime = finance.studentFinancialSummary(id);
  const invoices = finance.invoicesForStudent(id);
  const payments = finance.paymentsForStudent(id);
  const assignmentHistory = academics.listStudentAssignmentHistory(id);

  const isAdminUser = user.role === "SUPER_ADMIN" || user.role === "ADMIN";

  const transferFields: FormField[] = [
    {
      name: "sessionId", label: "Academic Session", type: "select", required: true, defaultValue: current ? String(current.session.id) : "",
      options: sessions.map((s) => ({ value: String(s.id), label: s.name })),
    },
    {
      name: "classId", label: "New Class", type: "select", required: true,
      options: classes.map((c) => ({ value: String(c.id), label: c.name })),
      help: "Use this to promote, transfer or correct a student's class for the selected session",
    },
  ];

  const statusFields: FormField[] = [
    {
      name: "status", label: "Student Status", type: "select", required: true, defaultValue: student.status,
      options: [
        { value: "ACTIVE", label: "Active" }, { value: "INACTIVE", label: "Inactive" },
        { value: "GRADUATED", label: "Graduated" }, { value: "TRANSFERRED", label: "Transferred" },
      ],
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title={`${student.firstName} ${student.middleName ?? ""} ${student.lastName}`}
        subtitle={`Student ID: ${student.studentCode} · ${student.className ?? "No class"} · ${current?.session.name ?? ""} ${current?.term.name ?? ""}`}
      >
        <Link
          href="/students"
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
        >
          ← All Students
        </Link>
        {isAdminUser && (
          <>
            <Link
              href={`/students/${id}/edit`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              Edit Profile
            </Link>
            <CrudModalButton
              label="Promote / Transfer"
              variant="ghost"
              icon="none"
              title="Change Class Assignment"
              subtitle="Creates or updates the class assignment for the selected session's current term"
              fields={transferFields}
              action={assignStudentClassAction}
              hidden={{ studentId: id, termId: current?.term.id ?? 0 }}
              submitLabel="Assign to Class"
            />
            <ConfirmActionButton
              action={setStudentStatusAction}
              payload={{ id, status: student.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" }}
              label={student.status === "ACTIVE" ? "Deactivate" : "Reactivate"}
              confirmTitle={student.status === "ACTIVE" ? "Deactivate this student?" : "Reactivate this student?"}
              confirmMessage={
                student.status === "ACTIVE"
                  ? "The student will be marked inactive. Their records and payment history are preserved."
                  : "The student will be marked active again."
              }
              confirmLabel={student.status === "ACTIVE" ? "Deactivate" : "Reactivate"}
              className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50"
            />
          </>
        )}
      </PageHeader>

      <div className="grid gap-4 xl:grid-cols-3">
        {/* Profile card */}
        <Card className="xl:col-span-1" title="Student Profile">
          <div className="space-y-4 p-5">
            <div className="flex items-center gap-4">
              {student.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={student.photoUrl} alt="" className="h-16 w-16 rounded-full border-2 border-brand-100 object-cover" />
              ) : (
                <Avatar name={`${student.firstName} ${student.lastName}`} size="lg" />
              )}
              <div>
                <p className="text-lg font-bold text-slate-900">
                  {student.firstName} {student.lastName}
                </p>
                <p className="text-xs text-slate-500">{student.admissionNumber}</p>
                <div className="mt-1.5 flex gap-1.5">
                  <StatusBadge status={student.status} />
                  <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                    {student.gender}
                  </span>
                </div>
              </div>
            </div>

            <dl className="space-y-2.5 border-t border-slate-100 pt-4 text-sm">
              <div className="flex items-start gap-2.5">
                <GradCap />
                <div>
                  <dt className="text-[11px] font-semibold uppercase text-slate-400">Class</dt>
                  <dd className="text-slate-700">{student.className ?? "Not assigned"}</dd>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                <div>
                  <dt className="text-[11px] font-semibold uppercase text-slate-400">Date of Birth</dt>
                  <dd className="text-slate-700">{formatDate(student.dateOfBirth)}</dd>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                <div>
                  <dt className="text-[11px] font-semibold uppercase text-slate-400">Admission Date</dt>
                  <dd className="text-slate-700">{formatDate(student.admissionDate)}</dd>
                </div>
              </div>
              {student.phone && (
                <div className="flex items-start gap-2.5">
                  <Phone className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                  <div>
                    <dt className="text-[11px] font-semibold uppercase text-slate-400">Phone</dt>
                    <dd className="text-slate-700">{student.phone}</dd>
                  </div>
                </div>
              )}
              {student.email && (
                <div className="flex items-start gap-2.5">
                  <Mail className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                  <div>
                    <dt className="text-[11px] font-semibold uppercase text-slate-400">Email</dt>
                    <dd className="text-slate-700">{student.email}</dd>
                  </div>
                </div>
              )}
              {student.address && (
                <div className="flex items-start gap-2.5">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                  <div>
                    <dt className="text-[11px] font-semibold uppercase text-slate-400">Address</dt>
                    <dd className="text-slate-700">{student.address}</dd>
                  </div>
                </div>
              )}
            </dl>

            {student.parentName && (
              <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4">
                <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-400">
                  <User className="h-3.5 w-3.5" /> Parent / Guardian
                </p>
                <p className="text-sm font-semibold text-slate-800">
                  {student.parentName} <span className="text-xs font-normal text-slate-400">({student.parentRelationship})</span>
                </p>
                <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
                  <Phone className="h-3 w-3" /> {student.parentPhone}
                </p>
                {isAdminUser && summary.outstanding > 0 && (
                  <div className="mt-3">
                    <ConfirmActionButton
                      action={sendPaymentReminderAction}
                      payload={{ studentId: id }}
                      label="Send Payment Reminder"
                      confirmTitle="Send payment reminder?"
                      confirmMessage={`A reminder about the outstanding balance of ${formatMoney(summary.outstanding)} will be sent to the parent's portal notifications.`}
                      confirmLabel="Send Reminder"
                      danger={false}
                      className="inline-flex items-center gap-1 rounded-lg bg-gold-500 px-2.5 py-1.5 text-xs font-bold text-brand-950 transition hover:bg-gold-400"
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </Card>

        {/* Financial profile */}
        <div className="space-y-4 xl:col-span-2">
          <Card
            title="Financial Summary"
            subtitle={`${current?.session.name ?? ""} · ${current?.term.name ?? ""}`}
            action={
              (isAdminUser || user.role === "TEACHER") && (
                <Link
                  href={`/billing/new?student=${id}`}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-700"
                >
                  <ReceiptText className="h-3.5 w-3.5" /> Generate Payment
                </Link>
              )
            }
          >
            <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4">
              <StatCard label="Total Charges" value={formatMoney(summary.totalCharges)} icon={<Coins className="h-5 w-5" />} tone="slate" />
              <StatCard label="Total Paid" value={formatMoney(summary.totalPaid)} icon={<Wallet className="h-5 w-5" />} tone="green" />
              <StatCard label="Outstanding" value={formatMoney(summary.outstanding)} icon={<AlertTriangle className="h-5 w-5" />} tone={summary.outstanding > 0 ? "red" : "green"} />
              <StatCard label="Invoices" value={String(summary.invoiceCount)} icon={<ReceiptText className="h-5 w-5" />} tone="blue" />
            </div>
            {allTime.outstanding !== summary.outstanding && (
              <p className="border-t border-slate-100 px-4 py-2.5 text-[11px] text-slate-400">
                All-time: charged {formatMoney(allTime.totalCharges)} · paid {formatMoney(allTime.totalPaid)} · outstanding {formatMoney(allTime.outstanding)}
              </p>
            )}
          </Card>

          <Card title="Invoices & Bills">
            {invoices.length === 0 ? (
              <EmptyState title="No invoices yet" message="Generate a payment invoice to bill this student." />
            ) : (
              <TableWrap>
                <thead>
                  <tr>
                    <Th>Invoice</Th>
                    <Th>Session / Term</Th>
                    <Th className="num">Total</Th>
                    <Th className="num">Paid</Th>
                    <Th className="num">Balance</Th>
                    <Th>Due Date</Th>
                    <Th>Status</Th>
                    <Th className="text-right"></Th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50/60">
                      <Td>
                        <Link href={`/billing/${inv.id}`} className="font-semibold text-brand-700 hover:underline">{inv.invoiceNumber}</Link>
                      </Td>
                      <Td className="whitespace-nowrap text-xs">{inv.sessionName} · {inv.termName}</Td>
                      <Td className="num">{formatMoney(inv.totalAmount)}</Td>
                      <Td className="num text-emerald-600">{formatMoney(inv.amountPaid)}</Td>
                      <Td className="num font-semibold">{formatMoney(inv.balance)}</Td>
                      <Td className="whitespace-nowrap text-xs">{formatDate(inv.dueDate)}</Td>
                      <Td><StatusBadge status={inv.status} /></Td>
                      <Td className="text-right">
                        <Link href={`/billing/${inv.id}`} className="text-xs font-semibold text-brand-600 hover:underline">View →</Link>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </TableWrap>
            )}
          </Card>

          <Card title="Payment History">
            {payments.length === 0 ? (
              <EmptyState title="No payments yet" />
            ) : (
              <TableWrap>
                <thead>
                  <tr>
                    <Th>Date</Th>
                    <Th>Description</Th>
                    <Th className="num">Amount</Th>
                    <Th>Method</Th>
                    <Th>Receipt</Th>
                    <Th>Status</Th>
                    <Th className="text-right"></Th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/60">
                      <Td className="whitespace-nowrap text-xs">{formatDate(p.paymentDate)}</Td>
                      <Td className="text-xs">
                        {p.invoiceNumber ? `Payment on ${p.invoiceNumber}` : "Direct payment"}
                      </Td>
                      <Td className="num font-semibold">{formatMoney(p.amount)}</Td>
                      <Td className="text-xs">{p.method}</Td>
                      <Td>
                        {p.status === "SUCCESSFUL" && p.receiptNumber ? (
                          <Link href={`/receipts/${p.id}`} className="text-xs font-semibold text-brand-600 hover:underline">{p.receiptNumber}</Link>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </Td>
                      <Td><StatusBadge status={p.status} /></Td>
                      <Td className="text-right">
                        {p.status === "SUCCESSFUL" && (
                          <Link href={`/receipts/${p.id}`} className="text-xs font-semibold text-brand-600 hover:underline">Receipt →</Link>
                        )}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </TableWrap>
            )}
          </Card>

          <Card title="Class Assignment History">
            {assignmentHistory.length === 0 ? (
              <EmptyState title="No class assignments yet" />
            ) : (
              <TableWrap>
                <thead>
                  <tr>
                    <Th>Session</Th>
                    <Th>Term</Th>
                    <Th>Class</Th>
                    <Th>Assigned On</Th>
                    <Th>Assigned By</Th>
                  </tr>
                </thead>
                <tbody>
                  {assignmentHistory.map((a) => (
                    <tr key={a.id} className="hover:bg-slate-50/60">
                      <Td className="text-xs font-medium">{(a as unknown as { sessionName?: string }).sessionName ?? "—"}</Td>
                      <Td className="text-xs">{(a as unknown as { termName?: string }).termName ?? "—"}</Td>
                      <Td className="font-medium text-slate-800">{a.className}</Td>
                      <Td className="whitespace-nowrap text-xs">{formatDate(a.assignedAt)}</Td>
                      <Td className="text-xs text-slate-500">{a.assignedByName ?? "—"}</Td>
                    </tr>
                  ))}
                </tbody>
              </TableWrap>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function GradCap() {
  return <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />;
}
