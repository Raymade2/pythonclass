import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getCurrentAcademic } from "@/lib/scope";
import * as people from "@/lib/repo/people";
import * as academics from "@/lib/repo/academics";
import { toISODateInput } from "@/lib/format";
import { PageHeader, Card } from "@/components/ui";
import { DataForm } from "@/components/data-form";
import { saveStudentAction } from "@/app/actions/students";
import type { FormField } from "@/components/data-form";
import { STUDENT_STATUSES } from "@/lib/constants";

export const metadata = { title: "Enrol Student" };

export default async function NewStudentPage() {
  await requireUser(["SUPER_ADMIN", "ADMIN"]);
  const current = await getCurrentAcademic();
  const codes = people.nextAdmissionNumbers(current?.session.name);

  const fields: FormField[] = [
    { name: "studentCode", label: "Student ID", type: "text", required: true, defaultValue: codes.studentCode, section: "Student Information", help: "Auto-generated — you can override it" },
    { name: "admissionNumber", label: "Admission Number", type: "text", required: true, defaultValue: codes.admissionNumber },
    { name: "firstName", label: "First Name", type: "text", required: true },
    { name: "middleName", label: "Middle Name", type: "text" },
    { name: "lastName", label: "Last Name", type: "text", required: true },
    {
      name: "gender", label: "Gender", type: "select", required: true, defaultValue: "Male",
      options: [{ value: "Male", label: "Male" }, { value: "Female", label: "Female" }],
    },
    { name: "dateOfBirth", label: "Date of Birth", type: "date" },
    { name: "photoUrl", label: "Passport Photograph (URL)", type: "text", placeholder: "https://…" },
    { name: "phone", label: "Phone Number", type: "tel", placeholder: "+234 …" },
    { name: "email", label: "Email", type: "email" },
    { name: "address", label: "Home Address", type: "textarea", colSpan: 2 },
    { name: "parentName", label: "Parent / Guardian Name", type: "text", required: true, section: "Parent / Guardian Information" },
    {
      name: "parentRelationship", label: "Relationship", type: "select", required: true, defaultValue: "Father",
      options: [
        { value: "Father", label: "Father" }, { value: "Mother", label: "Mother" },
        { value: "Guardian", label: "Guardian" },
      ],
    },
    { name: "parentPhone", label: "Parent Phone", type: "tel", required: true, placeholder: "+234 …", help: "Used for payment reminders" },
    { name: "parentEmail", label: "Parent Email", type: "email" },
    { name: "parentAddress", label: "Parent Address", type: "textarea", colSpan: 2 },
    { name: "admissionDate", label: "Admission Date", type: "date", defaultValue: toISODateInput(new Date()), section: "Academic Information" },
    {
      name: "status", label: "Student Status", type: "select", required: true, defaultValue: "ACTIVE",
      options: STUDENT_STATUSES.map((s) => ({ value: s, label: s })),
    },
  ];

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Enrol New Student" subtitle="Complete the form to enrol a student. IDs are generated automatically.">
        <Link href="/students" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50">
          ← Back to Students
        </Link>
      </PageHeader>

      <Card className="p-6">
        <DataForm
          fields={fields}
          action={saveStudentAction}
          submitLabel="Enrol Student"
          hidden={{ sessionName: current?.session.name ?? "" }}
          redirectAfter="/students/{id}"
        />
      </Card>

      <p className="mt-4 text-center text-xs text-slate-400">
        Tip: after enrolment, assign the student to a class from the Student-Class Assignment module.
      </p>
    </div>
  );
}
