// Pure business-logic helpers shared by server and seed code (no DB imports).

export type InvoiceStatus =
  | "UNPAID"
  | "PARTIALLY_PAID"
  | "FULLY_PAID"
  | "OVERDUE"
  | "CANCELLED";

export function isPastDate(d: Date | string | null | undefined): boolean {
  if (!d) return false;
  const date = typeof d === "string" ? new Date(d) : d;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const due = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return due.getTime() < today.getTime();
}

/**
 * Payment status rules:
 *   paid = 0                    -> UNPAID
 *   0 < paid < total            -> PARTIALLY_PAID
 *   paid >= total               -> FULLY_PAID
 *   due date passed & balance>0 -> OVERDUE
 */
export function computeInvoiceStatus(
  total: number,
  paid: number,
  dueDate: Date | string | null,
  cancelled = false
): InvoiceStatus {
  if (cancelled) return "CANCELLED";
  if (paid <= 0) return isPastDate(dueDate) ? "OVERDUE" : "UNPAID";
  if (paid >= total) return "FULLY_PAID";
  return isPastDate(dueDate) ? "OVERDUE" : "PARTIALLY_PAID";
}
