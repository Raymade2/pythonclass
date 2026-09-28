import { requireUser } from "@/lib/auth";
import * as core from "@/lib/repo/core";
import * as academics from "@/lib/repo/academics";
import { formatDate } from "@/lib/format";
import { Card, PageHeader, TableWrap, Th, Td } from "@/components/ui";
import { StatusBadge } from "@/components/badges";
import { DataForm } from "@/components/data-form";
import { CrudModalButton } from "@/components/crud-modal-button";
import { ConfirmActionButton } from "@/components/confirm-button";
import {
  updateSchoolAction, createSessionAction, updateSessionAction, setCurrentSessionTermAction,
  updateTermAction, deleteSessionAction,
} from "@/app/actions/settings";
import type { FormField } from "@/components/data-form";
import { toISODateInput } from "@/lib/format";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requireUser(["SUPER_ADMIN", "ADMIN"]);
  const isSuper = user.role === "SUPER_ADMIN";
  const school = core.getSchool();
  const sessions = academics.listSessionsWithTerms();

  const paystackConfigured = Boolean(process.env.PAYSTACK_SECRET_KEY);
  const flutterwaveConfigured = Boolean(process.env.FLUTTERWAVE_SECRET_KEY);

  const schoolFields: FormField[] = [
    { name: "name", label: "School Name", type: "text", required: true, defaultValue: school.name, colSpan: 2 },
    { name: "shortName", label: "Short Name", type: "text", defaultValue: school.shortName },
    { name: "motto", label: "Motto", type: "text", defaultValue: school.motto },
    { name: "address", label: "Address", type: "textarea", required: true, defaultValue: school.address, colSpan: 2 },
    { name: "phone", label: "Phone", type: "tel", required: true, defaultValue: school.phone },
    { name: "email", label: "Email", type: "email", required: true, defaultValue: school.email },
    { name: "logoUrl", label: "Logo URL (optional)", type: "text", defaultValue: school.logoUrl ?? "", colSpan: 2 },
  ];

  const sessionFields = (s?: academics.SessionRow & { terms?: academics.TermRow[] }): FormField[] => [
    { name: "name", label: "Session Name (e.g. 2027/2028)", type: "text", required: true, defaultValue: s?.name, help: "Must be in the format YYYY/YYYY" },
    { name: "startDate", label: "Start Date", type: "date", defaultValue: s?.startDate ? toISODateInput(s.startDate) : "" },
    { name: "endDate", label: "End Date", type: "date", defaultValue: s?.endDate ? toISODateInput(s.endDate) : "" },
    ...(s
      ? [{
          name: "status", label: "Status", type: "select", required: true, defaultValue: s.status,
          options: [{ value: "ACTIVE", label: "Active" }, { value: "INACTIVE", label: "Inactive" }],
        } as FormField]
      : []),
  ];

  return (
    <div className="space-y-5">
      <PageHeader title="Settings" subtitle="School profile, academic sessions & terms, and system configuration" />

      {/* School profile (super admin) */}
      {isSuper ? (
        <Card title="School Profile" subtitle="Displayed on the login page, invoices, receipts and reports">
          <div className="p-5">
            <DataForm fields={schoolFields} action={updateSchoolAction} submitLabel="Save School Profile" />
          </div>
        </Card>
      ) : (
        <Card title="School Profile" subtitle="Only the Super Administrator can edit the school profile">
          <dl className="grid gap-4 p-5 sm:grid-cols-2">
            <div><dt className="text-[11px] font-semibold uppercase text-slate-400">Name</dt><dd className="font-semibold text-slate-800">{school.name}</dd></div>
            <div><dt className="text-[11px] font-semibold uppercase text-slate-400">Motto</dt><dd className="text-slate-700">{school.motto}</dd></div>
            <div><dt className="text-[11px] font-semibold uppercase text-slate-400">Address</dt><dd className="text-slate-700">{school.address}</dd></div>
            <div><dt className="text-[11px] font-semibold uppercase text-slate-400">Contact</dt><dd className="text-slate-700">{school.phone} · {school.email}</dd></div>
          </dl>
        </Card>
      )}

      {/* Sessions & terms */}
      <Card
        title="Academic Sessions & Terms"
        subtitle="Fees, invoices and assignments are linked to sessions and terms"
        action={
          <CrudModalButton
            label="Add Session"
            title="Create Academic Session"
            subtitle="Three terms are created automatically"
            fields={sessionFields()}
            action={createSessionAction}
            submitLabel="Create Session"
          />
        }
      >
        <div className="space-y-4 p-5">
          {sessions.map((s) => (
            <div key={s.id} className={`rounded-2xl border p-4 ${s.isCurrent ? "border-brand-300 bg-brand-50/40" : "border-slate-200"}`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-800">{s.name}</h3>
                    {s.isCurrent ? (
                      <span className="rounded-full bg-brand-600 px-2 py-0.5 text-[10px] font-bold text-white">CURRENT SESSION</span>
                    ) : (
                      <StatusBadge status={s.status} />
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {formatDate(s.startDate)} — {formatDate(s.endDate)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <CrudModalButton label="Edit" variant="ghost" icon="pencil" title={`Edit ${s.name}`} fields={sessionFields(s)} action={updateSessionAction} hidden={{ id: s.id }} submitLabel="Save" />
                  {isSuper && !s.isCurrent && (
                    <ConfirmActionButton
                      action={deleteSessionAction}
                      payload={{ id: s.id }}
                      label="Delete"
                      confirmTitle={`Delete ${s.name}?`}
                      confirmMessage="Sessions with invoices or records cannot be deleted."
                      confirmLabel="Delete"
                      className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50"
                    />
                  )}
                </div>
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                {s.terms.map((t) => (
                  <div key={t.id} className={`rounded-xl border p-3 ${t.isCurrent ? "border-gold-400 bg-gold-50/60" : "border-slate-200 bg-white"}`}>
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-bold text-slate-800">{t.name}</p>
                      {t.isCurrent && <span className="rounded-full bg-gold-500 px-2 py-0.5 text-[9px] font-bold text-brand-950">CURRENT TERM</span>}
                    </div>
                    <p className="mt-0.5 text-[11px] text-slate-400">{formatDate(t.startDate)} — {formatDate(t.endDate)}</p>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-[11px] text-slate-400"><StatusBadge status={t.status} /></span>
                      {!t.isCurrent && (
                        <form action="" className="inline">
                          <ConfirmActionButton
                            action={setCurrentSessionTermAction}
                            payload={{ sessionId: s.id, termId: t.id }}
                            label="Set as current"
                            confirmTitle={`Set ${s.name} · ${t.name} as current?`}
                            confirmMessage="All dashboards, filters and new records will default to this session and term."
                            confirmLabel="Set Current"
                            danger={false}
                            className="text-[11px] font-bold text-brand-600 hover:text-brand-800"
                          />
                        </form>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Payment gateways */}
      <Card title="Payment Gateways" subtitle="Online payment integrations — configured via server environment variables">
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-200 p-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-800">Paystack</h4>
              <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${paystackConfigured ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                {paystackConfigured ? "● Configured" : "○ Not configured"}
              </span>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-slate-500">
              Set <code className="rounded bg-slate-100 px-1 py-0.5 text-[10px]">PAYSTACK_SECRET_KEY</code> in the server environment to enable live Paystack checkout. Secret keys are never exposed to the frontend.
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 p-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-800">Flutterwave</h4>
              <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${flutterwaveConfigured ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                {flutterwaveConfigured ? "● Configured" : "○ Not configured"}
              </span>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-slate-500">
              Set <code className="rounded bg-slate-100 px-1 py-0.5 text-[10px]">FLUTTERWAVE_SECRET_KEY</code> to route online payments through Flutterwave. Without gateway keys the built-in demo gateway simulator is used.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
