# SFGS School Fee Management System

A full-featured fee/invoice management app for a school (St. Finbarr's Grammar School demo), built with **Next.js 14 (App Router) + TypeScript + Tailwind CSS + SQLite** (`node:sqlite`, no ORM).

## Quick start

```bash
npm install
npm run db:seed     # creates data/sfgs.db with demo data
npm run dev         # http://localhost:3000
```

Other scripts: `npm run db:reset` (delete the DB file), `npm run build && npm start`.

## Demo logins

| Role | Email | Password | Notes |
|---|---|---|---|
| Super Admin | `superadmin@sfgs.edu.ng` | `Admin@123` | everything |
| Admin (Bursar) | `admin@sfgs.edu.ng` | `Admin@123` | everything except user management/audit logs |
| Teacher | `teacher@sfgs.edu.ng` | `Teacher@123` | class teacher of Primary 5 — sees only own students |
| Parent | `parent@sfgs.edu.ng` | `Parent@123` | 2 children in Primary 5 — sees own children only |

## Features

- **Dashboard** — collection stats, 30-day trend chart, recent payments, top debtors
- **Students** — CRUD, admission numbers, status, per-student fee history; scoped by teacher/parent
- **Teachers** — CRUD, subject qualifications; **Assignments** — class teachers/subjects per term, bulk student assignment to classes
- **Classes & class groups** — Nursery/Primary/College structure with capacities
- **Fees** — fee categories per class group; **Other payments** — optional charges scoped to school/class group/class/student (excursions, uniforms, …)
- **Billing** — per-student invoice wizard (pick fees + other payments), bulk invoice generation per class, partial payments, cancel, reminders
- **Payments** — record cash/transfer/POS payments, online payments via Paystack (demo gateway fallback), receipts with RCP numbers, duplicate-reference protection
- **Debtors** — outstanding balances by class/student; **Reports** — financial (daily/weekly/monthly/termly/annual), student lists, class performance
- **Exports** — CSV (6 datasets, filtered) and PDF for key reports/receipts
- **Users** — account management, password resets, suspend (can't suspend self); **Settings** — school profile, academic sessions/terms, set current term
- **Audit logs** (super admin), **notifications** (parent + admin), **global search**

## Role scoping

- `SUPER_ADMIN` / `ADMIN`: full access. Teachers: only students in their assigned classes. Parents: only their children.
- Out-of-scope records return 404; unauthorized pages redirect to login.
- `/api/export` is admin-only (401 otherwise). Audit logs are super-admin-only.

## Architecture

```
lib/db.ts          node:sqlite connection + query helpers (camelCase mapping)
lib/ddl.ts         schema
lib/repo/*.ts      data access (core / academics / people / finance)
lib/auth.ts        bcrypt sessions, getCurrentUser, requireUser([...roles])
lib/scope.ts       teacher/parent → student-id scoping
app/actions/*.ts   server actions (form handling + validation + audit + notify)
app/(app)/…        authenticated pages (dashboard, students, billing, …)
app/api/export     CSV export
app/api/payments/callback   Paystack verification (+ demo mode)
components/…       UI kit, tables, modals, toasts, charts, pickers, export buttons
scripts/seed.mjs   demo data (114 students, 24 teachers, 218 invoices, 265 payments)
```

## Paystack online payments

Set `PAYSTACK_SECRET_KEY` in `.env` for real verification; without it the app runs in demo mode (`/pay/[id]` offers a simulated gateway). Amounts are verified in kobo; duplicate callbacks are ignored.

## Notes

- SQLite file lives at `data/sfgs.db` (git-ignored). Delete + reseed anytime.
- Passwords are bcrypt-hashed; sessions are httpOnly cookies.
- Money is stored in whole naira; formatting via `lib/format.ts`.
