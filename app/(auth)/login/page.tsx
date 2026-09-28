import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getSchool } from "@/lib/repo/core";
import { SchoolLogo } from "@/components/school-logo";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign In" };

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");
  const school = getSchool();

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      {/* Brand panel */}
      <div className="relative flex flex-col justify-between overflow-hidden bg-gradient-to-br from-brand-950 via-brand-900 to-[#0d1f5c] px-8 py-10 text-white lg:w-[46%] lg:px-14 lg:py-14">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-gold-400/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-16 h-80 w-80 rounded-full bg-brand-400/10 blur-2xl" />

        <div className="relative">
          <div className="flex items-center gap-4">
            <SchoolLogo size={64} />
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-gold-300">Sure Foundation</p>
              <h1 className="text-2xl font-bold leading-tight">Group of Schools</h1>
            </div>
          </div>
          <p className="mt-3 text-sm italic text-white/60">“{school.motto}”</p>

          <h2 className="mt-12 max-w-md text-3xl font-bold leading-snug lg:text-4xl">
            School Fee <span className="text-gold-300">Management</span> made simple.
          </h2>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-white/70">
            Everything your school needs to manage classes, enrol students, configure fees, generate invoices,
            collect payments, track debtors and report on your financial position — all in one secure system.
          </p>

          <ul className="mt-10 grid max-w-md gap-3 text-sm text-white/85 sm:grid-cols-2">
            {[
              "Fee structures per class & term",
              "Partial payments supported",
              "Instant receipts & invoicing",
              "Debtors tracking & reminders",
              "Role-based access control",
              "Secure online payments",
            ].map((f) => (
              <li key={f} className="flex items-center gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gold-400/20 text-[10px] font-bold text-gold-300">
                  ✓
                </span>
                {f}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative mt-10 text-xs text-white/40">
          © {new Date().getFullYear()} {school.name} · {school.address}
        </p>
      </div>

      {/* Login form panel */}
      <div className="flex flex-1 items-center justify-center bg-slate-50 px-6 py-12">
        <div className="w-full max-w-md">
          <div className="rounded-2xl border border-slate-200 bg-white p-7 shadow-card sm:p-9">
            <h2 className="text-xl font-bold text-slate-900">Welcome back</h2>
            <p className="mt-1 text-sm text-slate-500">Sign in to your school account to continue.</p>
            <LoginForm />
          </div>

          <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-white/60 p-4">
            <p className="mb-2 text-center text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Demo accounts (click to fill)
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {[
                { label: "Super Admin", email: "superadmin@sfgs.edu.ng", password: "Admin@123" },
                { label: "Administrator", email: "admin@sfgs.edu.ng", password: "Admin@123" },
                { label: "Teacher", email: "teacher@sfgs.edu.ng", password: "Teacher@123" },
                { label: "Parent", email: "parent@sfgs.edu.ng", password: "Parent@123" },
              ].map((a) => (
                <DemoAccountButton key={a.email} {...a} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DemoAccountButton({ label, email, password }: { label: string; email: string; password: string }) {
  return (
    <form action="/login" className="contents">
      <button
        type="submit"
        name="demo"
        value={`${email}|${password}`}
        className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left transition hover:border-brand-300 hover:bg-brand-50/50"
      >
        <span className="block text-xs font-bold text-slate-700">{label}</span>
        <span className="block truncate text-[11px] text-slate-400">{email}</span>
      </button>
    </form>
  );
}
