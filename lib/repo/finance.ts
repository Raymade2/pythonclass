import "server-only";
import { all, get, run, tx, camelize, camelAll, inClause } from "@/lib/db";
import type {
  FeeRow, FeeCategoryRow, OtherPaymentRow, InvoiceListRow, InvoiceDetailRow, InvoiceItemRow,
  PaymentListRow, DebtorRow,
} from "./types";
import { computeInvoiceStatus } from "@/lib/invoice-status";

// ---------------------------------------------------------------------------
// Fee categories
// ---------------------------------------------------------------------------

export function listFeeCategories(): FeeCategoryRow[] {
  return camelAll<FeeCategoryRow>(
    all(`SELECT fc.*, (SELECT COUNT(*) FROM fees f WHERE f.category_id = fc.id) AS fee_count FROM fee_categories fc ORDER BY fc.name`)
  );
}

export function createFeeCategory(name: string, description: string | null): number {
  return run(`INSERT INTO fee_categories (name, description) VALUES (?, ?)`, [name, description]).lastInsertRowid;
}

export function ensureFeeCategory(name: string, description?: string | null): number {
  const existing = camelize<{ id: number }>(get(`SELECT id FROM fee_categories WHERE name = ?`, [name]));
  if (existing) return existing.id;
  return createFeeCategory(name, description ?? null);
}

export function deleteFeeCategory(id: number): void {
  run(`DELETE FROM fee_categories WHERE id = ?`, [id]);
}

// ---------------------------------------------------------------------------
// Fees
// ---------------------------------------------------------------------------

export type FeeFilter = { sessionId?: number; termId?: number; classId?: number; categoryId?: number; q?: string; status?: string };

export function listFees(filter: FeeFilter = {}): FeeRow[] {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filter.sessionId) { where.push(`f.session_id = ?`); params.push(filter.sessionId); }
  if (filter.termId) { where.push(`f.term_id = ?`); params.push(filter.termId); }
  if (filter.classId) { where.push(`f.class_id = ?`); params.push(filter.classId); }
  if (filter.categoryId) { where.push(`f.category_id = ?`); params.push(filter.categoryId); }
  if (filter.status) { where.push(`f.status = ?`); params.push(filter.status); }
  if (filter.q) {
    where.push(`(f.name LIKE ? OR fc.name LIKE ?)`);
    const like = `%${filter.q}%`;
    params.push(like, like);
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  return camelAll<FeeRow>(
    all(
      `SELECT f.*, fc.name AS category_name, c.name AS class_name, ses.name AS session_name, t.name AS term_name
       FROM fees f
       JOIN fee_categories fc ON fc.id = f.category_id
       JOIN classes c ON c.id = f.class_id
       JOIN academic_sessions ses ON ses.id = f.session_id
       JOIN terms t ON t.id = f.term_id
       ${whereSql}
       ORDER BY ses.name DESC, t.id, c.id, f.name`,
      params
    )
  );
}

export function getFeeById(id: number): FeeRow | undefined {
  return listFees().find((f) => f.id === id);
}

export function createFee(data: {
  name: string; categoryId: number; amount: number; classId: number; sessionId: number; termId: number;
  dueDate: string | null; description: string | null; mandatory: boolean; status: string;
}): number {
  return run(
    `INSERT INTO fees (name, category_id, amount, class_id, session_id, term_id, due_date, description, mandatory, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [data.name, data.categoryId, data.amount, data.classId, data.sessionId, data.termId, data.dueDate,
     data.description, data.mandatory, data.status]
  ).lastInsertRowid;
}

export function updateFee(
  id: number,
  data: {
    name: string; categoryId: number; amount: number; classId: number; sessionId: number; termId: number;
    dueDate: string | null; description: string | null; mandatory: boolean; status: string;
  }
): void {
  run(
    `UPDATE fees SET name = ?, category_id = ?, amount = ?, class_id = ?, session_id = ?, term_id = ?, due_date = ?,
       description = ?, mandatory = ?, status = ?, updated_at = datetime('now') WHERE id = ?`,
    [data.name, data.categoryId, data.amount, data.classId, data.sessionId, data.termId, data.dueDate,
     data.description, data.mandatory, data.status, id]
  );
}

export function deleteFee(id: number): void {
  run(`DELETE FROM fees WHERE id = ?`, [id]);
}

export function classFeeTotal(classId: number, sessionId: number, termId: number): number {
  return (
    get<{ n: number }>(
      `SELECT COALESCE(SUM(amount), 0) AS n FROM fees WHERE class_id = ? AND session_id = ? AND term_id = ? AND status = 'ACTIVE'`,
      [classId, sessionId, termId]
    )?.n ?? 0
  );
}

/** Active fee items for a class/session/term that the student has NOT yet been invoiced for. */
export function availableFeesForStudent(studentId: number, classId: number, sessionId: number, termId: number): FeeRow[] {
  return camelAll<FeeRow>(
    all(
      `SELECT f.*, fc.name AS category_name, c.name AS class_name, ses.name AS session_name, t.name AS term_name
       FROM fees f
       JOIN fee_categories fc ON fc.id = f.category_id
       JOIN classes c ON c.id = f.class_id
       JOIN academic_sessions ses ON ses.id = f.session_id
       JOIN terms t ON t.id = f.term_id
       WHERE f.class_id = ? AND f.session_id = ? AND f.term_id = ? AND f.status = 'ACTIVE'
         AND f.id NOT IN (
           SELECT ii.fee_id FROM invoice_items ii
           JOIN invoices i ON i.id = ii.invoice_id
           WHERE i.student_id = ? AND i.session_id = ? AND i.term_id = ? AND i.status != 'CANCELLED' AND ii.fee_id IS NOT NULL
         )
       ORDER BY f.mandatory DESC, f.name`,
      [classId, sessionId, termId, studentId, sessionId, termId]
    )
  );
}

// ---------------------------------------------------------------------------
// Other payments
// ---------------------------------------------------------------------------

export type OtherPaymentFilter = { sessionId?: number; termId?: number; scope?: string; q?: string };

export function listOtherPayments(filter: OtherPaymentFilter = {}): OtherPaymentRow[] {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filter.sessionId) { where.push(`op.session_id = ?`); params.push(filter.sessionId); }
  if (filter.termId) { where.push(`op.term_id = ?`); params.push(filter.termId); }
  if (filter.scope) { where.push(`op.scope = ?`); params.push(filter.scope); }
  if (filter.q) {
    where.push(`(op.name LIKE ? OR op.category LIKE ?)`);
    const like = `%${filter.q}%`;
    params.push(like, like);
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  return camelAll<OtherPaymentRow>(
    all(
      `SELECT op.*,
        (s.first_name || ' ' || s.last_name) AS student_name,
        c.name AS class_name, g.name AS group_name,
        ses.name AS session_name, t.name AS term_name
       FROM other_payments op
       LEFT JOIN students s ON s.id = op.student_id
       LEFT JOIN classes c ON c.id = op.class_id
       LEFT JOIN class_groups g ON g.id = op.class_group_id
       JOIN academic_sessions ses ON ses.id = op.session_id
       JOIN terms t ON t.id = op.term_id
       ${whereSql}
       ORDER BY op.created_at DESC, op.id DESC`,
      params
    )
  );
}

export function createOtherPayment(data: {
  name: string; category: string; amount: number; scope: string; studentId: number | null;
  classId: number | null; classGroupId: number | null; sessionId: number; termId: number;
  dueDate: string | null; description: string | null; mandatory: boolean; status: string;
}): number {
  return run(
    `INSERT INTO other_payments (name, category, amount, scope, student_id, class_id, class_group_id, session_id, term_id, due_date, description, mandatory, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [data.name, data.category, data.amount, data.scope, data.studentId, data.classId, data.classGroupId,
     data.sessionId, data.termId, data.dueDate, data.description, data.mandatory, data.status]
  ).lastInsertRowid;
}

export function updateOtherPayment(
  id: number,
  data: {
    name: string; category: string; amount: number; scope: string; studentId: number | null;
    classId: number | null; classGroupId: number | null; sessionId: number; termId: number;
    dueDate: string | null; description: string | null; mandatory: boolean; status: string;
  }
): void {
  run(
    `UPDATE other_payments SET name = ?, category = ?, amount = ?, scope = ?, student_id = ?, class_id = ?, class_group_id = ?,
       session_id = ?, term_id = ?, due_date = ?, description = ?, mandatory = ?, status = ?, updated_at = datetime('now')
     WHERE id = ?`,
    [data.name, data.category, data.amount, data.scope, data.studentId, data.classId, data.classGroupId,
     data.sessionId, data.termId, data.dueDate, data.description, data.mandatory, data.status, id]
  );
}

export function deleteOtherPayment(id: number): void {
  run(`DELETE FROM other_payments WHERE id = ?`, [id]);
}

export function applicableOtherPaymentsForStudent(
  studentId: number,
  classId: number | null,
  classGroupId: number | null,
  sessionId: number,
  termId: number
): OtherPaymentRow[] {
  return camelAll<OtherPaymentRow>(
    all(
      `SELECT op.*,
        (s.first_name || ' ' || s.last_name) AS student_name,
        c.name AS class_name, g.name AS group_name,
        ses.name AS session_name, t.name AS term_name
       FROM other_payments op
       LEFT JOIN students s ON s.id = op.student_id
       LEFT JOIN classes c ON c.id = op.class_id
       LEFT JOIN class_groups g ON g.id = op.class_group_id
       JOIN academic_sessions ses ON ses.id = op.session_id
       JOIN terms t ON t.id = op.term_id
       WHERE op.status = 'ACTIVE' AND op.session_id = ? AND op.term_id = ?
         AND (op.scope = 'SCHOOL' OR (op.scope = 'STUDENT' AND op.student_id = ?)
              ${classId ? "OR (op.scope = 'CLASS' AND op.class_id = " + Number(classId) + ")" : ""}
              ${classGroupId ? "OR (op.scope = 'GROUP' AND op.class_group_id = " + Number(classGroupId) + ")" : ""})
         AND op.id NOT IN (
           SELECT ii.other_payment_id FROM invoice_items ii
           JOIN invoices i ON i.id = ii.invoice_id
           WHERE i.student_id = ? AND i.session_id = ? AND i.term_id = ? AND i.status != 'CANCELLED' AND ii.other_payment_id IS NOT NULL
         )
       ORDER BY op.mandatory DESC, op.name`,
      [sessionId, termId, studentId, studentId, sessionId, termId]
    )
  );
}

// ---------------------------------------------------------------------------
// Invoice query builder
// ---------------------------------------------------------------------------

export type InvoiceFilter = {
  q?: string;
  sessionId?: number;
  termId?: number;
  classId?: number;
  classGroupId?: number;
  status?: string;
  studentIds?: number[];
  from?: string;
  to?: string;
  includeCancelled?: boolean;
};

function invoiceFilterSql(f: InvoiceFilter): { whereSql: string; params: unknown[] } {
  const where: string[] = [];
  const params: unknown[] = [];
  if (!f.includeCancelled && !f.status) where.push(`i.status != 'CANCELLED'`);
  if (f.sessionId) { where.push(`i.session_id = ?`); params.push(f.sessionId); }
  if (f.termId) { where.push(`i.term_id = ?`); params.push(f.termId); }
  if (f.status) { where.push(`i.status = ?`); params.push(f.status); }
  if (f.classId) {
    where.push(`EXISTS (SELECT 1 FROM student_class_assignments sca WHERE sca.student_id = i.student_id AND sca.session_id = i.session_id AND sca.term_id = i.term_id AND sca.class_id = ?)`);
    params.push(f.classId);
  }
  if (f.classGroupId) {
    where.push(`EXISTS (SELECT 1 FROM student_class_assignments sca JOIN classes c ON c.id = sca.class_id WHERE sca.student_id = i.student_id AND sca.session_id = i.session_id AND sca.term_id = i.term_id AND c.class_group_id = ?)`);
    params.push(f.classGroupId);
  }
  if (f.studentIds) {
    if (f.studentIds.length === 0) where.push(`1 = 0`);
    else { where.push(`i.student_id IN ${inClause(f.studentIds.length)}`); params.push(...f.studentIds); }
  }
  if (f.from) { where.push(`date(i.created_at) >= date(?)`); params.push(f.from); }
  if (f.to) { where.push(`date(i.created_at) <= date(?)`); params.push(f.to); }
  if (f.q) {
    where.push(`(i.invoice_number LIKE ? OR s.first_name || ' ' || s.last_name LIKE ? OR s.last_name || ' ' || s.first_name LIKE ? OR s.student_code LIKE ? OR s.admission_number LIKE ?)`);
    const like = `%${f.q}%`;
    params.push(like, like, like, like, like);
  }
  return { whereSql: where.length ? `WHERE ${where.join(" AND ")}` : "", params };
}

const INVOICE_SELECT = `
  SELECT i.*,
    s.first_name, s.middle_name, s.last_name, s.student_code, s.admission_number, s.phone AS student_phone,
    s.email AS student_email, s.address AS student_address, s.date_of_birth, s.gender,
    p.name AS parent_name, p.phone AS parent_phone, p.relationship AS parent_relationship,
    ses.name AS session_name, t.name AS term_name,
    (SELECT c.name FROM student_class_assignments sca JOIN classes c ON c.id = sca.class_id
      WHERE sca.student_id = i.student_id AND sca.session_id = i.session_id AND sca.term_id = i.term_id LIMIT 1) AS class_name,
    (SELECT c.id FROM student_class_assignments sca JOIN classes c ON c.id = sca.class_id
      WHERE sca.student_id = i.student_id AND sca.session_id = i.session_id AND sca.term_id = i.term_id LIMIT 1) AS class_id
  FROM invoices i
  JOIN students s ON s.id = i.student_id
  LEFT JOIN parents p ON p.id = s.parent_id
  JOIN academic_sessions ses ON ses.id = i.session_id
  JOIN terms t ON t.id = i.term_id`;

export function listInvoices(f: InvoiceFilter, limit = 50, offset = 0): { rows: InvoiceListRow[]; total: number } {
  const { whereSql, params } = invoiceFilterSql(f);
  const total = get<{ n: number }>(`SELECT COUNT(*) AS n FROM invoices i JOIN students s ON s.id = i.student_id ${whereSql}`, params)?.n ?? 0;
  const rows = camelAll<InvoiceListRow>(all(`${INVOICE_SELECT} ${whereSql} ORDER BY i.created_at DESC, i.id DESC LIMIT ? OFFSET ?`, [...params, limit, offset]));
  return { rows, total };
}

export function listAllInvoices(f: InvoiceFilter): InvoiceListRow[] {
  const { whereSql, params } = invoiceFilterSql(f);
  return camelAll<InvoiceListRow>(all(`${INVOICE_SELECT} ${whereSql} ORDER BY i.created_at DESC, i.id DESC`, params));
}

export function getInvoiceDetail(id: number): InvoiceDetailRow | undefined {
  const row = camelAll<InvoiceListRow>(all(`${INVOICE_SELECT} WHERE i.id = ?`, [id]))[0];
  if (!row) return undefined;
  const items = camelAll<InvoiceItemRow>(all(`SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY id`, [id]));
  const payments = paymentsForInvoice(id);
  return { ...row, items, payments } as unknown as InvoiceDetailRow;
}

export function getInvoiceById(id: number): InvoiceListRow | undefined {
  return camelAll<InvoiceListRow>(all(`${INVOICE_SELECT} WHERE i.id = ?`, [id]))[0];
}

export function invoicesForStudent(studentId: number, sessionId?: number, termId?: number): InvoiceListRow[] {
  return listAllInvoices({ studentIds: [studentId], sessionId, termId, includeCancelled: true });
}

// ---------------------------------------------------------------------------
// Invoice numbers & creation
// ---------------------------------------------------------------------------

export function nextInvoiceNumber(sessionName: string): string {
  const year = sessionName.split("/")[0] || String(new Date().getFullYear());
  const prefix = `SFGS-${year}-`;
  const last = get<{ invoice_number: string }>(
    `SELECT invoice_number FROM invoices WHERE invoice_number LIKE ? ORDER BY invoice_number DESC LIMIT 1`,
    [`${prefix}%`]
  );
  const seq = last ? Number(last.invoice_number.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(seq).padStart(6, "0")}`;
}

export function nextReceiptNumber(): string {
  const year = new Date().getFullYear();
  const prefix = `RCP-${year}-`;
  const last = get<{ receipt_number: string }>(
    `SELECT receipt_number FROM payments WHERE receipt_number LIKE ? ORDER BY receipt_number DESC LIMIT 1`,
    [`${prefix}%`]
  );
  const seq = last ? Number(last.receipt_number.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(seq).padStart(5, "0")}`;
}

export function nextPaymentReference(): string {
  const year = new Date().getFullYear();
  const prefix = `PAY-${year}-`;
  const last = get<{ reference: string }>(
    `SELECT reference FROM payments WHERE reference LIKE ? ORDER BY reference DESC LIMIT 1`,
    [`${prefix}%`]
  );
  const seq = last ? Number(last.reference.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(seq).padStart(6, "0")}`;
}

export function newTransactionReference(): string {
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `SFGS-TX-${Date.now()}-${rand}`;
}

export type InvoiceItemInput = { description: string; amount: number; quantity?: number; feeId?: number | null; otherPaymentId?: number | null };

export function createInvoice(data: {
  studentId: number;
  sessionId: number;
  termId: number;
  sessionName: string;
  dueDate: string | null;
  notes: string | null;
  generatedByUserId: number | null;
  generatedByName: string | null;
  items: InvoiceItemInput[];
}): { id: number; invoiceNumber: string } {
  if (data.items.length === 0) throw new Error("Select at least one payment item");
  const total = data.items.reduce((s, it) => s + it.amount * (it.quantity ?? 1), 0);
  const invoiceNumber = nextInvoiceNumber(data.sessionName);
  const status = computeInvoiceStatus(total, 0, data.dueDate ? new Date(data.dueDate) : null);

  return tx(() => {
    const id = run(
      `INSERT INTO invoices (invoice_number, student_id, session_id, term_id, total_amount, amount_paid, balance, due_date, status, notes, generated_by_user_id, generated_by_name)
       VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?)`,
      [invoiceNumber, data.studentId, data.sessionId, data.termId, total, total, data.dueDate, status, data.notes, data.generatedByUserId, data.generatedByName]
    ).lastInsertRowid;
    for (const it of data.items) {
      run(
        `INSERT INTO invoice_items (invoice_id, description, amount, quantity, fee_id, other_payment_id) VALUES (?, ?, ?, ?, ?, ?)`,
        [id, it.description, it.amount, it.quantity ?? 1, it.feeId ?? null, it.otherPaymentId ?? null]
      );
    }
    return { id, invoiceNumber };
  });
}

export function cancelInvoice(id: number): void {
  run(`UPDATE invoices SET status = 'CANCELLED', updated_at = datetime('now') WHERE id = ?`, [id]);
}

/** Idempotently recompute invoice amount_paid / balance / status from successful payments. */
export function refreshInvoice(invoiceId: number): { amountPaid: number; balance: number; status: string; total: number } | null {
  const inv = get<{ id: number; total_amount: number; due_date: string | null; status: string }>(
    `SELECT id, total_amount, due_date, status FROM invoices WHERE id = ?`,
    [invoiceId]
  );
  if (!inv) return null;
  const paid =
    get<{ n: number }>(`SELECT COALESCE(SUM(amount), 0) AS n FROM payments WHERE invoice_id = ? AND status = 'SUCCESSFUL'`, [invoiceId])?.n ?? 0;
  const status = inv.status === "CANCELLED" ? "CANCELLED" : computeInvoiceStatus(inv.total_amount, paid, inv.due_date ? new Date(inv.due_date) : null);
  run(
    `UPDATE invoices SET amount_paid = ?, balance = MAX(total_amount - ?, 0), status = ?, updated_at = datetime('now') WHERE id = ?`,
    [paid, paid, status, invoiceId]
  );
  return { amountPaid: paid, balance: Math.max(inv.total_amount - paid, 0), status, total: inv.total_amount };
}

/** Refresh all invoice statuses (e.g. after due dates pass). */
export function refreshAllInvoiceStatuses(): void {
  const rows = all<{ id: number; total_amount: number; amount_paid: number; due_date: string | null; status: string }>(
    `SELECT id, total_amount, amount_paid, due_date, status FROM invoices WHERE status != 'CANCELLED'`
  );
  for (const inv of rows) {
    const status = computeInvoiceStatus(inv.total_amount, inv.amount_paid, inv.due_date ? new Date(inv.due_date) : null);
    if (status !== inv.status) {
      run(`UPDATE invoices SET status = ?, updated_at = datetime('now') WHERE id = ?`, [status, inv.id]);
    }
  }
}

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------

export type PaymentFilter = {
  q?: string;
  sessionId?: number;
  termId?: number;
  classId?: number;
  classGroupId?: number;
  method?: string;
  status?: string;
  from?: string;
  to?: string;
  studentIds?: number[];
  invoiceId?: number;
};

function paymentFilterSql(f: PaymentFilter): { whereSql: string; params: unknown[] } {
  const where: string[] = [`1 = 1`];
  const params: unknown[] = [];
  if (f.sessionId) { where.push(`i.session_id = ?`); params.push(f.sessionId); }
  if (f.termId) { where.push(`i.term_id = ?`); params.push(f.termId); }
  if (f.invoiceId) { where.push(`p.invoice_id = ?`); params.push(f.invoiceId); }
  if (f.method) { where.push(`p.method = ?`); params.push(f.method); }
  if (f.status) { where.push(`p.status = ?`); params.push(f.status); }
  if (f.from) { where.push(`date(p.payment_date) >= date(?)`); params.push(f.from); }
  if (f.to) { where.push(`date(p.payment_date) <= date(?)`); params.push(f.to); }
  if (f.classId) {
    where.push(`EXISTS (SELECT 1 FROM student_class_assignments sca WHERE sca.student_id = i.student_id AND sca.session_id = i.session_id AND sca.term_id = i.term_id AND sca.class_id = ?)`);
    params.push(f.classId);
  }
  if (f.classGroupId) {
    where.push(`EXISTS (SELECT 1 FROM student_class_assignments sca JOIN classes c ON c.id = sca.class_id WHERE sca.student_id = i.student_id AND sca.session_id = i.session_id AND sca.term_id = i.term_id AND c.class_group_id = ?)`);
    params.push(f.classGroupId);
  }
  if (f.studentIds) {
    if (f.studentIds.length === 0) where.push(`1 = 0`);
    else { where.push(`p.student_id IN ${inClause(f.studentIds.length)}`); params.push(...f.studentIds); }
  }
  if (f.q) {
    where.push(`(p.reference LIKE ? OR p.receipt_number LIKE ? OR p.transaction_reference LIKE ? OR s.first_name || ' ' || s.last_name LIKE ? OR s.last_name || ' ' || s.first_name LIKE ? OR s.student_code LIKE ?)`);
    const like = `%${f.q}%`;
    params.push(like, like, like, like, like, like);
  }
  return { whereSql: `WHERE ${where.join(" AND ")}`, params };
}

const PAYMENT_SELECT = `
  SELECT p.*,
    s.first_name, s.last_name, s.student_code,
    i.invoice_number, i.session_id, i.term_id,
    ses.name AS session_name, t.name AS term_name,
    (SELECT c.name FROM student_class_assignments sca JOIN classes c ON c.id = sca.class_id
      WHERE sca.student_id = i.student_id AND sca.session_id = i.session_id AND sca.term_id = i.term_id LIMIT 1) AS class_name
  FROM payments p
  JOIN students s ON s.id = p.student_id
  LEFT JOIN invoices i ON i.id = p.invoice_id
  LEFT JOIN academic_sessions ses ON ses.id = i.session_id
  LEFT JOIN terms t ON t.id = i.term_id`;

export function listPayments(f: PaymentFilter, limit = 50, offset = 0): { rows: PaymentListRow[]; total: number } {
  const { whereSql, params } = paymentFilterSql(f);
  const total =
    get<{ n: number }>(
      `SELECT COUNT(*) AS n FROM payments p JOIN students s ON s.id = p.student_id LEFT JOIN invoices i ON i.id = p.invoice_id ${whereSql}`,
      params
    )?.n ?? 0;
  const rows = camelAll<PaymentListRow>(all(`${PAYMENT_SELECT} ${whereSql} ORDER BY p.payment_date DESC, p.id DESC LIMIT ? OFFSET ?`, [...params, limit, offset]));
  return { rows, total };
}

export function listAllPayments(f: PaymentFilter): PaymentListRow[] {
  const { whereSql, params } = paymentFilterSql(f);
  return camelAll<PaymentListRow>(all(`${PAYMENT_SELECT} ${whereSql} ORDER BY p.payment_date DESC, p.id DESC`, params));
}

export function paymentsForInvoice(invoiceId: number): PaymentListRow[] {
  return listAllPayments({ invoiceId }).sort((a, b) => (a.paymentDate < b.paymentDate ? -1 : 1));
}

export function paymentsForStudent(studentId: number): PaymentListRow[] {
  return listAllPayments({ studentIds: [studentId] });
}

export function getPaymentForReceipt(id: number): (PaymentListRow & { invoiceTotal: number; invoiceBalance: number; invoiceStatus: string; studentMiddleName: string | null; admissionNumber: string; parentName: string | null; parentPhone: string | null }) | undefined {
  return camelAll(
    all(
      `SELECT p.*,
        s.first_name, s.middle_name, s.last_name, s.student_code, s.admission_number,
        p2.name AS parent_name, p2.phone AS parent_phone,
        i.invoice_number, i.session_id, i.term_id, i.total_amount AS invoice_total, i.balance AS invoice_balance, i.status AS invoice_status,
        ses.name AS session_name, t.name AS term_name,
        (SELECT c.name FROM student_class_assignments sca JOIN classes c ON c.id = sca.class_id
          WHERE sca.student_id = i.student_id AND sca.session_id = i.session_id AND sca.term_id = i.term_id LIMIT 1) AS class_name
      FROM payments p
      JOIN students s ON s.id = p.student_id
      LEFT JOIN parents p2 ON p2.id = s.parent_id
      LEFT JOIN invoices i ON i.id = p.invoice_id
      LEFT JOIN academic_sessions ses ON ses.id = i.session_id
      LEFT JOIN terms t ON t.id = i.term_id
      WHERE p.id = ?`,
      [id]
    )
  )[0] as never;
}

export function countPendingOnlinePayments(): number {
  return get<{ n: number }>(`SELECT COUNT(*) AS n FROM payments WHERE status = 'PENDING' AND method = 'Online'`)?.n ?? 0;
}

export function getPaymentById(id: number): PaymentListRow | undefined {
  return camelAll<PaymentListRow>(all(`${PAYMENT_SELECT} WHERE p.id = ?`, [id]))[0];
}

export function getPaymentByTxRef(txRef: string): PaymentListRow | undefined {
  return camelAll<PaymentListRow>(all(`${PAYMENT_SELECT} WHERE p.transaction_reference = ?`, [txRef]))[0];
}

export function transactionReferenceExists(txRef: string, exceptId?: number): boolean {
  return (
    get<{ n: number }>(`SELECT COUNT(*) AS n FROM payments WHERE transaction_reference = ? AND id != ?`, [txRef, exceptId ?? -1])?.n ?? 0
  ) > 0;
}

export function recordSuccessfulPayment(data: {
  invoiceId: number;
  studentId: number;
  amount: number;
  method: string;
  channel: string | null;
  transactionReference: string | null;
  paymentDate: string;
  recordedByUserId: number | null;
  recordedByName: string | null;
  notes: string | null;
}): { paymentId: number; reference: string; receiptNumber: string } {
  const reference = nextPaymentReference();
  const receiptNumber = nextReceiptNumber();
  return tx(() => {
    const paymentId = run(
      `INSERT INTO payments (reference, receipt_number, invoice_id, student_id, amount, method, channel, transaction_reference, payment_date, recorded_by_user_id, recorded_by_name, notes, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'SUCCESSFUL')`,
      [reference, receiptNumber, data.invoiceId, data.studentId, data.amount, data.method, data.channel,
       data.transactionReference, data.paymentDate, data.recordedByUserId, data.recordedByName, data.notes]
    ).lastInsertRowid;
    refreshInvoice(data.invoiceId);
    return { paymentId, reference, receiptNumber };
  });
}

export function createPendingPayment(data: {
  invoiceId: number;
  studentId: number;
  amount: number;
  method: string;
  channel: string;
  transactionReference: string;
  recordedByUserId: number | null;
  recordedByName: string | null;
}): { paymentId: number; reference: string; transactionReference: string } {
  const reference = nextPaymentReference();
  const paymentId = run(
    `INSERT INTO payments (reference, invoice_id, student_id, amount, method, channel, transaction_reference, recorded_by_user_id, recorded_by_name, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')`,
    [reference, data.invoiceId, data.studentId, data.amount, data.method, data.channel, data.transactionReference, data.recordedByUserId, data.recordedByName]
  ).lastInsertRowid;
  return { paymentId, reference, transactionReference: data.transactionReference };
}

/** Confirm a pending payment exactly once (duplicate-safe). */
export function completePendingPayment(paymentId: number): { receiptNumber: string; invoiceId: number } {
  return tx(() => {
    const p = get<{ id: number; status: string; invoice_id: number }>(`SELECT id, status, invoice_id FROM payments WHERE id = ?`, [paymentId]);
    if (!p) throw new Error("Payment not found");
    if (p.status === "SUCCESSFUL") throw new Error("This payment has already been processed");
    if (p.status !== "PENDING") throw new Error("This payment can no longer be completed");
    const receiptNumber = nextReceiptNumber();
    run(`UPDATE payments SET status = 'SUCCESSFUL', receipt_number = ?, payment_date = datetime('now'), updated_at = datetime('now') WHERE id = ?`, [receiptNumber, paymentId]);
    refreshInvoice(p.invoice_id);
    return { receiptNumber, invoiceId: p.invoice_id };
  });
}

export function failPendingPayment(paymentId: number, reason: string): void {
  run(`UPDATE payments SET status = 'FAILED', notes = COALESCE(notes, '') || ?, updated_at = datetime('now') WHERE id = ? AND status = 'PENDING'`, [reason, paymentId]);
}

// ---------------------------------------------------------------------------
// Aggregates: dashboard / debtors / class performance
// ---------------------------------------------------------------------------

export type InvoiceAggregates = { expected: number; collected: number; outstanding: number; debtors: number; invoices: number };

export function invoiceAggregates(f: InvoiceFilter): InvoiceAggregates {
  const { whereSql, params } = invoiceFilterSql(f);
  const row = get<{
    expected: number; collected: number; outstanding: number; debtors: number; invoices: number;
  }>(
    `SELECT COALESCE(SUM(i.total_amount), 0) AS expected,
            COALESCE(SUM(i.amount_paid), 0) AS collected,
            COALESCE(SUM(i.balance), 0) AS outstanding,
            COUNT(DISTINCT CASE WHEN i.balance > 0 THEN i.student_id END) AS debtors,
            COUNT(*) AS invoices
     FROM invoices i JOIN students s ON s.id = i.student_id ${whereSql}`,
    params
  );
  return {
    expected: row?.expected ?? 0,
    collected: row?.collected ?? 0,
    outstanding: row?.outstanding ?? 0,
    debtors: row?.debtors ?? 0,
    invoices: row?.invoices ?? 0,
  };
}

export function paymentsToday(f: PaymentFilter = {}): number {
  const { whereSql, params } = paymentFilterSql({ ...f, status: "SUCCESSFUL" });
  return (
    get<{ n: number }>(
      `SELECT COALESCE(SUM(p.amount), 0) AS n FROM payments p JOIN students s ON s.id = p.student_id LEFT JOIN invoices i ON i.id = p.invoice_id ${whereSql} AND date(p.payment_date) = date('now')`,
      params
    )?.n ?? 0
  );
}

export function paymentsThisMonth(f: PaymentFilter = {}): number {
  const { whereSql, params } = paymentFilterSql({ ...f, status: "SUCCESSFUL" });
  return (
    get<{ n: number }>(
      `SELECT COALESCE(SUM(p.amount), 0) AS n FROM payments p JOIN students s ON s.id = p.student_id LEFT JOIN invoices i ON i.id = p.invoice_id ${whereSql} AND strftime('%Y-%m', p.payment_date) = strftime('%Y-%m', 'now')`,
      params
    )?.n ?? 0
  );
}

export function dailyPaymentTotals(from: string, to: string, f: PaymentFilter = {}): { day: string; total: number }[] {
  const { whereSql, params } = paymentFilterSql({ ...f, status: "SUCCESSFUL" });
  return all<{ day: string; total: number }>(
    `SELECT date(p.payment_date) AS day, COALESCE(SUM(p.amount), 0) AS total
     FROM payments p JOIN students s ON s.id = p.student_id LEFT JOIN invoices i ON i.id = p.invoice_id
     ${whereSql} AND date(p.payment_date) BETWEEN date(?) AND date(?)
     GROUP BY day ORDER BY day`,
    [...params, from, to]
  );
}

export function methodTotals(f: PaymentFilter = {}): { method: string; total: number }[] {
  const { whereSql, params } = paymentFilterSql({ ...f, status: "SUCCESSFUL" });
  return all<{ method: string; total: number }>(
    `SELECT p.method AS method, COALESCE(SUM(p.amount), 0) AS total
     FROM payments p JOIN students s ON s.id = p.student_id LEFT JOIN invoices i ON i.id = p.invoice_id
     ${whereSql} GROUP BY p.method ORDER BY total DESC`
  , params);
}

export function recentPayments(limit: number, f: PaymentFilter = {}): PaymentListRow[] {
  const { rows } = listPayments({ ...f, status: "SUCCESSFUL" }, limit, 0);
  return rows;
}

export type ClassPerformanceRow = {
  classId: number;
  className: string;
  classCode: string;
  groupName: string | null;
  expected: number;
  paid: number;
  outstanding: number;
  studentCount: number;
};

export function classPerformance(
  sessionId: number,
  termId: number,
  opts: { classId?: number; classGroupId?: number } = {}
): ClassPerformanceRow[] {
  const where: string[] = [`c.status = 'ACTIVE'`];
  const params: unknown[] = [];
  if (opts.classId) { where.push(`c.id = ?`); params.push(opts.classId); }
  if (opts.classGroupId) { where.push(`c.class_group_id = ?`); params.push(opts.classGroupId); }
  return all<ClassPerformanceRow & { group_name: string | null; student_count: number }>(
    `SELECT c.id AS class_id, c.name AS class_name, c.code AS class_code, g.name AS group_name,
      (SELECT COUNT(*) FROM student_class_assignments sca2 WHERE sca2.class_id = c.id AND sca2.session_id = ? AND sca2.term_id = ?) AS student_count,
      COALESCE((SELECT SUM(i2.total_amount) FROM invoices i2
        WHERE i2.status != 'CANCELLED' AND i2.session_id = ? AND i2.term_id = ?
        AND EXISTS (SELECT 1 FROM student_class_assignments sca3 WHERE sca3.student_id = i2.student_id AND sca3.class_id = c.id AND sca3.session_id = i2.session_id AND sca3.term_id = i2.term_id)), 0) AS expected,
      COALESCE((SELECT SUM(i3.amount_paid) FROM invoices i3
        WHERE i3.status != 'CANCELLED' AND i3.session_id = ? AND i3.term_id = ?
        AND EXISTS (SELECT 1 FROM student_class_assignments sca4 WHERE sca4.student_id = i3.student_id AND sca4.class_id = c.id AND sca4.session_id = i3.session_id AND sca4.term_id = i3.term_id)), 0) AS paid,
      COALESCE((SELECT SUM(i4.balance) FROM invoices i4
        WHERE i4.status != 'CANCELLED' AND i4.session_id = ? AND i4.term_id = ?
        AND EXISTS (SELECT 1 FROM student_class_assignments sca5 WHERE sca5.student_id = i4.student_id AND sca5.class_id = c.id AND sca5.session_id = i4.session_id AND sca5.term_id = i4.term_id)), 0) AS outstanding
     FROM classes c
     LEFT JOIN class_groups g ON g.id = c.class_group_id
     WHERE ${where.join(" AND ")}
     ORDER BY c.id`,
    [sessionId, termId, sessionId, termId, sessionId, termId, sessionId, termId, ...params]
  ).map((r) => ({
    classId: r.class_id,
    className: r.class_name,
    classCode: r.class_code,
    groupName: r.group_name,
    studentCount: r.student_count,
    expected: r.expected,
    paid: r.paid,
    outstanding: r.outstanding,
  }));
}

export type DebtorFilter = InvoiceFilter & { minOutstanding?: number; dueBefore?: string };

export function debtorRows(f: DebtorFilter, limit?: number, offset = 0): { rows: DebtorRow[]; total: number } {
  const { whereSql, params } = invoiceFilterSql({ ...f, status: undefined });
  // force balance > 0
  const balanceCond = `AND i.balance > 0`;
  const base = `
    FROM invoices i
    JOIN students s ON s.id = i.student_id
    LEFT JOIN parents p ON p.id = s.parent_id
    ${whereSql} ${balanceCond}`;
  const total =
    get<{ n: number }>(
      `SELECT COUNT(DISTINCT s.id) AS n ${base}`,
      params
    )?.n ?? 0;
  const rows = camelAll<DebtorRow>(
    all(
      `SELECT s.id AS student_id, s.first_name, s.middle_name, s.last_name, s.student_code, s.admission_number, s.status AS student_status,
        p.name AS parent_name, p.phone AS parent_phone,
        (SELECT c.id FROM student_class_assignments sca JOIN classes c ON c.id = sca.class_id
          WHERE sca.student_id = s.id AND sca.session_id = i.session_id AND sca.term_id = i.term_id LIMIT 1) AS class_id,
        (SELECT c.name FROM student_class_assignments sca2 JOIN classes c ON c.id = sca2.class_id
          WHERE sca2.student_id = s.id AND sca2.session_id = i.session_id AND sca2.term_id = i.term_id LIMIT 1) AS class_name,
        (SELECT c.class_group_id FROM student_class_assignments sca3 JOIN classes c ON c.id = sca3.class_id
          WHERE sca3.student_id = s.id AND sca3.session_id = i.session_id AND sca3.term_id = i.term_id LIMIT 1) AS class_group_id,
        (SELECT g.name FROM student_class_assignments sca4 JOIN classes c ON c.id = sca4.class_id JOIN class_groups g ON g.id = c.class_group_id
          WHERE sca4.student_id = s.id AND sca4.session_id = i.session_id AND sca4.term_id = i.term_id LIMIT 1) AS group_name,
        SUM(i.total_amount) AS total_bill,
        SUM(i.amount_paid) AS total_paid,
        SUM(i.balance) AS outstanding,
        MIN(i.due_date) AS due_date,
        COUNT(i.id) AS invoice_count
      ${base}
      GROUP BY s.id
      HAVING SUM(i.balance) > 0
      ORDER BY outstanding DESC
      ${limit ? `LIMIT ? OFFSET ?` : ""}`,
      limit ? [...params, limit, offset] : params
    )
  );
  return { rows, total };
}

export function studentFinancialSummary(studentId: number, sessionId?: number, termId?: number): {
  totalCharges: number;
  totalPaid: number;
  outstanding: number;
  invoiceCount: number;
} {
  const row = get<{ charges: number; paid: number; outstanding: number; n: number }>(
    `SELECT COALESCE(SUM(total_amount), 0) AS charges,
            COALESCE(SUM(amount_paid), 0) AS paid,
            COALESCE(SUM(balance), 0) AS outstanding,
            COUNT(*) AS n
     FROM invoices
     WHERE student_id = ? AND status != 'CANCELLED'
     ${sessionId ? "AND session_id = ?" : ""} ${termId ? "AND term_id = ?" : ""}`,
    [studentId, ...(sessionId ? [sessionId] : []), ...(termId ? [termId] : [])]
  );
  return {
    totalCharges: row?.charges ?? 0,
    totalPaid: row?.paid ?? 0,
    outstanding: row?.outstanding ?? 0,
    invoiceCount: row?.n ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Expected fees from fee structures (before invoices are generated)
// ---------------------------------------------------------------------------

export function expectedFeesFromStructures(sessionId: number, termId: number, opts: { classId?: number; classGroupId?: number } = {}): number {
  const where: string[] = [`f.status = 'ACTIVE'`, `f.session_id = ?`, `f.term_id = ?`];
  const params: unknown[] = [sessionId, termId];
  if (opts.classId) { where.push(`f.class_id = ?`); params.push(opts.classId); }
  if (opts.classGroupId) { where.push(`c.class_group_id = ?`); params.push(opts.classGroupId); }
  return (
    get<{ n: number }>(
      `SELECT COALESCE(SUM(f.amount * (SELECT COUNT(*) FROM student_class_assignments sca
         WHERE sca.class_id = f.class_id AND sca.session_id = f.session_id AND sca.term_id = f.term_id)), 0) AS n
       FROM fees f JOIN classes c ON c.id = f.class_id
       WHERE ${where.join(" AND ")}`,
      params
    )?.n ?? 0
  );
}
