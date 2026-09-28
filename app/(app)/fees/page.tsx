import { requireUser } from "@/lib/auth";
import { getCurrentAcademic } from "@/lib/scope";
import * as academics from "@/lib/repo/academics";
import * as finance from "@/lib/repo/finance";
import { formatMoney, formatDate, toISODateInput } from "@/lib/format";
import { Card, PageHeader, TableWrap, Th, Td, EmptyState } from "@/components/ui";
import { StatusBadge } from "@/components/badges";
import { CrudModalButton } from "@/components/crud-modal-button";
import { ConfirmActionButton } from "@/components/confirm-button";
import { FilterForm, FilterSelect, FilterInput } from "@/components/filter-form";
import { saveFeeAction, deleteFeeAction, saveFeeCategoryAction, deleteFeeCategoryAction } from "@/app/actions/fees";
import type { FormField } from "@/components/data-form";

export const metadata = { title: "School Fees" };

const CATEGORY_OPTIONS = ["Tuition Fee", "Development Levy", "ICT Fee", "Examination Fee", "Library Fee", "Sports Fee", "Music Fee", "Science Laboratory Fee", "Hostel Fee", "Feeding Fee", "Transport Fee", "Other"];

export default async function FeesPage({
  searchParams,
}: {
  searchParams: { session?: string; term?: string; class?: string; q?: string };
}) {
  await requireUser(["SUPER_ADMIN", "ADMIN"]);
  const current = await getCurrentAcademic();
  const sessions = academics.listSessions();

  const sessionId = Number(searchParams.session) || current?.session.id || 0;
  const session = sessions.find((s) => s.id === sessionId);
  const terms = session ? academics.listTermsForSession(session.id) : [];
  const termId = Number(searchParams.term) || terms.find((t) => t.isCurrent)?.id || terms[0]?.id || 0;
  const classId = Number(searchParams.class) || 0;
  const q = (searchParams.q ?? "").trim();

  const classes = academics.listClasses({ status: "ACTIVE" });
  const groups = academics.listClassGroups();
  const fees = finance.listFees({
    sessionId,
    termId,
    classId: classId || undefined,
    q: q || undefined,
  });
  const categories = finance.listFeeCategories();

  // Group fees by class for the structure view
  const byClass = new Map<string, typeof fees>();
  for (const f of fees) {
    const key = `${String(f.classId).padStart(4, "0")}|${f.className}`;
    if (!byClass.has(key)) byClass.set(key, []);
    byClass.get(key)!.push(f);
  }
  const classEntries = [...byClass.entries()].sort(([a], [b]) => a.localeCompare(b));

  const fields = (f?: finance.FeeRow): FormField[] => [
    { name: "name", label: "Fee Item Name", type: "text", required: true, placeholder: "e.g. Tuition Fee", defaultValue: f?.name, section: "Fee Details" },
    {
      name: "categoryName", label: "Fee Category", type: "select", required: true, defaultValue: f?.categoryName ?? "Tuition Fee",
      options: CATEGORY_OPTIONS.map((c) => ({ value: c, label: c })),
    },
    { name: "amount", label: "Amount (₦)", type: "number", required: true, min: 1, defaultValue: f?.amount, placeholder: "100000" },
    {
      name: "classId", label: "Class", type: "select", required: true, defaultValue: f?.classId ? String(f.classId) : classId ? String(classId) : "",
      options: classes.map((c) => ({ value: String(c.id), label: c.name })),
    },
    {
      name: "sessionId", label: "Academic Session", type: "select", required: true, defaultValue: f?.sessionId ? String(f.sessionId) : String(sessionId),
      options: sessions.map((s) => ({ value: String(s.id), label: s.name })),
    },
    {
      name: "termId", label: "Term", type: "select", required: true, defaultValue: f?.termId ? String(f.termId) : String(termId),
      options: terms.map((t) => ({ value: String(t.id), label: t.name })),
    },
    { name: "dueDate", label: "Due Date", type: "date", defaultValue: f?.dueDate ? toISODateInput(f.dueDate) : "", section: "Additional Information" },
    { name: "description", label: "Description", type: "textarea", defaultValue: f?.description ?? "", colSpan: 2 },
    { name: "mandatory", label: "Mandatory fee item", type: "checkbox", defaultValue: f ? Boolean(f.mandatory) : true, help: "Mandatory items are included in bulk invoice generation" },
    {
      name: "status", label: "Status", type: "select", required: true, defaultValue: f?.status ?? "ACTIVE",
      options: [{ value: "ACTIVE", label: "Active" }, { value: "INACTIVE", label: "Inactive" }],
    },
  ];

  const categoryFields: FormField[] = [
    { name: "name", label: "Category Name", type: "text", required: true, placeholder: "e.g. Sports Fee" },
    { name: "description", label: "Description", type: "textarea", colSpan: 2 },
  ];

  return (
    <div className="space-y-5">
      <PageHeader title="School Fees" subtitle="Configure fee structures per class, session and term">
        <CrudModalButton label="Add Fee Category" variant="ghost" title="New Fee Category" fields={categoryFields} action={saveFeeCategoryAction} submitLabel="Create Category" />
        <CrudModalButton label="Add Fee Item" title="Create Fee Item" subtitle="Fees apply to a specific class, session and term" fields={fields()} action={saveFeeAction} submitLabel="Create Fee Item" />
      </PageHeader>

      <FilterForm basePath="/fees">
        <FilterSelect name="session" label="Session" defaultValue={String(sessionId)} allLabel="—" options={sessions.map((s) => ({ value: String(s.id), label: s.name }))} />
        <FilterSelect name="term" label="Term" defaultValue={String(termId)} allLabel="—" options={terms.map((t) => ({ value: String(t.id), label: t.name }))} />
        <FilterSelect name="class" label="Class" defaultValue={classId ? String(classId) : ""} options={classes.map((c) => ({ value: String(c.id), label: c.name }))} />
        <FilterInput name="q" label="Search" defaultValue={q} placeholder="Fee item or category…" />
      </FilterForm>

      {classEntries.length === 0 ? (
        <Card>
          <EmptyState title="No fee items found" message="Create fee items so invoices can be generated for students." />
        </Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {classEntries.map(([key, items]) => {
            const [classKey, className] = key.split("|");
            const total = items.reduce((s, f) => s + f.amount, 0);
            const group = groups.find((g) => g.id === classes.find((c) => String(c.id) === classKey)?.classGroupId);
            return (
              <Card key={key} title={className} subtitle={`${group?.name ?? ""} · ${items[0].sessionName} — ${items[0].termName}`}>
                <TableWrap>
                  <thead>
                    <tr>
                      <Th>Fee Item</Th>
                      <Th>Category</Th>
                      <Th>Due Date</Th>
                      <Th className="num">Amount</Th>
                      <Th className="text-right">Actions</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((f) => (
                      <tr key={f.id} className="hover:bg-slate-50/60">
                        <Td className="font-medium text-slate-800">
                          {f.name}
                          {f.mandatory ? (
                            <span className="ml-1.5 rounded bg-brand-50 px-1.5 py-0.5 text-[10px] font-bold text-brand-700">REQ</span>
                          ) : null}
                        </Td>
                        <Td className="text-xs text-slate-500">{f.categoryName}</Td>
                        <Td className="whitespace-nowrap text-xs">{formatDate(f.dueDate)}</Td>
                        <Td className="num font-semibold">{formatMoney(f.amount)}</Td>
                        <Td className="text-right">
                          <div className="flex justify-end gap-1.5">
                            <CrudModalButton label="Edit" variant="ghost" icon="pencil" title={`Edit ${f.name}`} fields={fields(f)} action={saveFeeAction} hidden={{ id: f.id }} submitLabel="Save Changes" />
                            <ConfirmActionButton
                              action={deleteFeeAction}
                              payload={{ id: f.id }}
                              label="Del"
                              confirmTitle={`Delete ${f.name}?`}
                              confirmMessage="Existing invoices keep their line items; new invoices will no longer include this fee."
                              confirmLabel="Delete"
                              className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50"
                            />
                          </div>
                        </Td>
                      </tr>
                    ))}
                    <tr className="bg-slate-50/80 font-semibold">
                      <Td className="border-t-2 border-slate-200">Total per student</Td>
                      <Td className="border-t-2 border-slate-200" />
                      <Td className="border-t-2 border-slate-200" />
                      <Td className="num border-t-2 border-slate-200 text-brand-800">{formatMoney(total)}</Td>
                      <Td className="border-t-2 border-slate-200" />
                    </tr>
                  </tbody>
                </TableWrap>
              </Card>
            );
          })}
        </div>
      )}

      <Card title="Fee Categories" subtitle={`${categories.length} category(ies)`}>
        <div className="flex flex-wrap gap-2 p-4">
          {categories.map((c) => (
            <span key={c.id} className="group inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 py-1 pl-3 pr-2 text-xs font-medium text-slate-700">
              {c.name}
              <span className="rounded-full bg-white px-1.5 text-[10px] text-slate-400">{c.feeCount}</span>
              {c.feeCount === 0 && (
                <ConfirmActionButton
                  action={deleteFeeCategoryAction}
                  payload={{ id: c.id }}
                  label="×"
                  confirmTitle={`Delete ${c.name}?`}
                  confirmMessage="This category is not used by any fee item."
                  confirmLabel="Delete"
                  className="rounded-full px-1 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                />
              )}
            </span>
          ))}
        </div>
      </Card>
    </div>
  );
}
