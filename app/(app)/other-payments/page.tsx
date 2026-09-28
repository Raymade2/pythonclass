import { requireUser } from "@/lib/auth";
import { getCurrentAcademic } from "@/lib/scope";
import * as academics from "@/lib/repo/academics";
import * as people from "@/lib/repo/people";
import * as finance from "@/lib/repo/finance";
import { formatMoney, formatDate, toISODateInput } from "@/lib/format";
import { Card, PageHeader, TableWrap, Th, Td, EmptyState, Pagination } from "@/components/ui";
import { StatusBadge } from "@/components/badges";
import { CrudModalButton } from "@/components/crud-modal-button";
import { ConfirmActionButton } from "@/components/confirm-button";
import { FilterForm, FilterSelect, FilterInput } from "@/components/filter-form";
import { saveOtherPaymentAction, deleteOtherPaymentAction } from "@/app/actions/other-payments";
import type { FormField } from "@/components/data-form";

export const metadata = { title: "Other Payments" };

const CATEGORIES = ["Uniform", "School Bus", "Textbooks", "WAEC", "NECO", "BECE", "Excursion", "PTA levy", "Sports", "Graduation", "Examination", "Medical", "Hostel", "Feeding", "Extra Lessons", "Other Charges"];

export default async function OtherPaymentsPage({
  searchParams,
}: {
  searchParams: { session?: string; term?: string; scope?: string; q?: string; page?: string };
}) {
  await requireUser(["SUPER_ADMIN", "ADMIN"]);
  const current = await getCurrentAcademic();
  const sessions = academics.listSessions();

  const sessionId = Number(searchParams.session) || current?.session.id || 0;
  const session = sessions.find((s) => s.id === sessionId);
  const terms = session ? academics.listTermsForSession(session.id) : [];
  const termId = Number(searchParams.term) || terms.find((t) => t.isCurrent)?.id || terms[0]?.id || 0;
  const scope = searchParams.scope ?? "";
  const q = (searchParams.q ?? "").trim();
  const page = Math.max(1, Number(searchParams.page) || 1);
  const perPage = 25;

  const classes = academics.listClasses({ status: "ACTIVE" });
  const groups = academics.listClassGroups();
  const students = people.listStudents({ limit: 2000 }).rows;

  const all = finance.listOtherPayments({
    sessionId,
    termId,
    scope: scope || undefined,
    q: q || undefined,
  });
  const totalPages = Math.max(1, Math.ceil(all.length / perPage));
  const rows = all.slice((page - 1) * perPage, page * perPage);

  const fields = (op?: finance.OtherPaymentRow): FormField[] => [
    { name: "name", label: "Payment Name", type: "text", required: true, placeholder: "e.g. School Bus Fee", defaultValue: op?.name, section: "Payment Details" },
    {
      name: "category", label: "Category", type: "select", required: true, defaultValue: op?.category ?? "Uniform",
      options: CATEGORIES.map((c) => ({ value: c, label: c })),
    },
    { name: "amount", label: "Amount (₦)", type: "number", required: true, min: 1, defaultValue: op?.amount },
    {
      name: "scope", label: "Applies To", type: "select", required: true, defaultValue: op?.scope ?? "SCHOOL",
      options: [
        { value: "SCHOOL", label: "Entire School" },
        { value: "GROUP", label: "Class Group" },
        { value: "CLASS", label: "Class" },
        { value: "STUDENT", label: "Individual Student" },
      ],
      help: "The students this charge applies to when generating invoices",
    },
    {
      name: "classGroupId", label: "Class Group (if applies to group)", type: "select", defaultValue: op?.classGroupId ? String(op.classGroupId) : "",
      options: groups.map((g) => ({ value: String(g.id), label: g.name })),
    },
    {
      name: "classId", label: "Class (if applies to class)", type: "select", defaultValue: op?.classId ? String(op.classId) : "",
      options: classes.map((c) => ({ value: String(c.id), label: c.name })),
    },
    {
      name: "studentId", label: "Student (if applies to student)", type: "select", defaultValue: op?.studentId ? String(op.studentId) : "",
      options: students.slice(0, 800).map((s) => ({ value: String(s.id), label: `${s.firstName} ${s.lastName} (${s.studentCode})` })),
    },
    {
      name: "sessionId", label: "Academic Session", type: "select", required: true, defaultValue: op?.sessionId ? String(op.sessionId) : String(sessionId),
      options: sessions.map((s) => ({ value: String(s.id), label: s.name })),
      section: "Session & Term",
    },
    {
      name: "termId", label: "Term", type: "select", required: true, defaultValue: op?.termId ? String(op.termId) : String(termId),
      options: terms.map((t) => ({ value: String(t.id), label: t.name })),
    },
    { name: "dueDate", label: "Due Date", type: "date", defaultValue: op?.dueDate ? toISODateInput(op.dueDate) : "", section: "Additional Information" },
    { name: "description", label: "Description", type: "textarea", defaultValue: op?.description ?? "", colSpan: 2 },
    { name: "mandatory", label: "Mandatory charge", type: "checkbox", defaultValue: op ? Boolean(op.mandatory) : false },
    {
      name: "status", label: "Status", type: "select", required: true, defaultValue: op?.status ?? "ACTIVE",
      options: [{ value: "ACTIVE", label: "Active" }, { value: "INACTIVE", label: "Inactive" }],
    },
  ];

  const scopeLabel: Record<string, string> = {
    SCHOOL: "Entire School",
    GROUP: "Class Group",
    CLASS: "Class",
    STUDENT: "Student",
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Other Payments" subtitle="Non-school-fee charges: uniforms, bus, textbooks, WAEC/NECO, excursions and more">
        <CrudModalButton label="Add Other Payment" title="Create Other Payment" subtitle="Assign charges to a student, class, class group or the entire school" fields={fields()} action={saveOtherPaymentAction} submitLabel="Create Payment" />
      </PageHeader>

      <FilterForm basePath="/other-payments">
        <FilterSelect name="session" label="Session" defaultValue={String(sessionId)} allLabel="—" options={sessions.map((s) => ({ value: String(s.id), label: s.name }))} />
        <FilterSelect name="term" label="Term" defaultValue={String(termId)} allLabel="—" options={terms.map((t) => ({ value: String(t.id), label: t.name }))} />
        <FilterSelect name="scope" label="Applies To" defaultValue={scope} options={Object.entries(scopeLabel).map(([v, l]) => ({ value: v, label: l }))} />
        <FilterInput name="q" label="Search" defaultValue={q} placeholder="Name or category…" />
      </FilterForm>

      <Card>
        {rows.length === 0 ? (
          <EmptyState title="No other payments found" message="Create charges like uniforms, bus fees or exam registrations." />
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <Th>Payment</Th>
                <Th>Category</Th>
                <Th>Applies To</Th>
                <Th className="num">Amount</Th>
                <Th>Session / Term</Th>
                <Th>Due Date</Th>
                <Th>Status</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((op) => (
                <tr key={op.id} className="hover:bg-slate-50/60">
                  <Td className="font-semibold text-slate-800">
                    {op.name}
                    {op.mandatory ? <span className="ml-1.5 rounded bg-brand-50 px-1.5 py-0.5 text-[10px] font-bold text-brand-700">REQ</span> : null}
                  </Td>
                  <Td className="text-xs text-slate-500">{op.category}</Td>
                  <Td>
                    <span className="text-xs font-medium text-slate-700">{scopeLabel[op.scope] ?? op.scope}</span>
                    <span className="block text-[11px] text-slate-400">
                      {op.scope === "STUDENT" ? op.studentName : op.scope === "CLASS" ? op.className : op.scope === "GROUP" ? op.groupName : "All students"}
                    </span>
                  </Td>
                  <Td className="num font-semibold">{formatMoney(op.amount)}</Td>
                  <Td className="whitespace-nowrap text-xs">{op.sessionName} · {op.termName}</Td>
                  <Td className="whitespace-nowrap text-xs">{formatDate(op.dueDate)}</Td>
                  <Td><StatusBadge status={op.status} /></Td>
                  <Td className="text-right">
                    <div className="flex justify-end gap-1.5">
                      <CrudModalButton label="Edit" variant="ghost" icon="pencil" title={`Edit ${op.name}`} fields={fields(op)} action={saveOtherPaymentAction} hidden={{ id: op.id }} submitLabel="Save Changes" />
                      <ConfirmActionButton
                        action={deleteOtherPaymentAction}
                        payload={{ id: op.id }}
                        label="Del"
                        confirmTitle={`Delete ${op.name}?`}
                        confirmMessage="Existing invoices keep their line items."
                        confirmLabel="Delete"
                        className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50"
                      />
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}
        <Pagination page={page} totalPages={totalPages} baseParams={{ session: String(sessionId), term: String(termId), scope, q }} />
      </Card>
    </div>
  );
}
