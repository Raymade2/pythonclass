import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import * as people from "@/lib/repo/people";
import { PageHeader, Card } from "@/components/ui";
import { DataForm } from "@/components/data-form";
import { saveStudentAction } from "@/app/actions/students";
import type { FormField } from "@/components/data-form";
import { STUDENT_STATUSES } from "@/lib/constants";
import { toISODateInput } from "@/lib/format";

export const metadata = { title: "Edit Student" };

export default async function EditStudentPage({ params }: { params: { id: string } }) {
  await requireUser(["SUPER_ADMIN", "ADMIN"]);
  const id = Number(params.id);
  if (!Number.isFinite(id)) notFound();
  const s = people.getStudentById(id);
  if (!s) notFound();

  const fields: FormField[] = [
    { name: "studentCode", label: "Student ID", type: "text", required: true, defaultValue: s.studentCode, section: "Student Information" },
    { name: "admissionNumber", label: "Admission Number", type: "text", required: true, defaultValue: s.admissionNumber },
    { name: "firstName", label: "First Name", type: "text", required: true, defaultValue: s.firstName },
    { name: "middleName", label: "Middle Name", type: "text", defaultValue: s.middleName ?? "" },
    { name: "lastName", label: "Last Name", type: "text", required: true, defaultValue: s.lastName },
    {
      name: "gender", label: "Gender", type: "select", required: true, defaultValue: s.gender,
      options: [{ value: "Male", label: "Male" }, { value: "Female", label: "Female" }],
    },
    { name: "dateOfBirth", label: "Date of Birth", type: "date", defaultValue: toISODateInput(s.dateOfBirth) },
    { name: "photoUrl", label: "Passport Photograph (URL)", type: "text", defaultValue: s.photoUrl ?? "" },
    { name: "phone", label: "Phone Number", type: "tel", defaultValue: s.phone ?? "" },
    { name: "email", label: "Email", type: "email", defaultValue: s.email ?? "" },
    { name: "address", label: "Home Address", type: "textarea", defaultValue: s.address ?? "", colSpan: 2 },
    { name: "parentName", label: "Parent / Guardian Name", type: "text", section: "Parent / Guardian Information" },
    {
      name: "parentRelationship", label: "Relationship", type: "select", defaultValue: "Father",
      options: [{ value: "Father", label: "Father" }, { value: "Mother", label: "Mother" }, { value: "Guardian", label: "Guardian" }],
      help: "Leave blank to keep the existing parent record unchanged",
    },
    { name: "parentPhone", label: "Parent Phone", type: "tel" },
    { name: "parentEmail", label: "Parent Email", type: "email" },
    { name: "parentAddress", label: "Parent Address", type: "textarea", colSpan: 2 },
    { name: "admissionDate", label: "Admission Date", type: "date", defaultValue: toISODateInput(s.admissionDate), section: "Academic Information" },
    {
      name: "status", label: "Student Status", type: "select", required: true, defaultValue: s.status,
      options: STUDENT_STATUSES.map((x) => ({ value: x, label: x })),
    },
  ];

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title={`Edit ${s.firstName} ${s.lastName}`} subtitle={s.studentCode}>
        <Link href={`/students/${id}`} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50">
          ← Back to Profile
        </Link>
      </PageHeader>
      <Card className="p-6">
        <DataForm fields={fields} action={saveStudentAction} hidden={{ id, parentId: s.parentId ?? "" }} submitLabel="Save Changes" redirectAfter={`/students/${id}`} />
      </Card>
    </div>
  );
}
