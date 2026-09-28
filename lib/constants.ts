export const APP_NAME = "Sure Foundation School Fee Management System";
export const SCHOOL_NAME = "Sure Foundation Group of Schools";
export const SCHOOL_SHORT = "SFGS";

export const ROLES = ["SUPER_ADMIN", "ADMIN", "TEACHER", "PARENT"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super Administrator",
  ADMIN: "School Administrator",
  TEACHER: "Teacher",
  PARENT: "Student / Parent",
};

export const PAYMENT_METHODS = ["Cash", "Bank Transfer", "POS", "Cheque", "Online", "Other"] as const;
export const OFFLINE_METHODS = ["Cash", "Bank Transfer", "POS", "Cheque", "Other"] as const;

export const INVOICE_STATUSES = [
  "UNPAID",
  "PARTIALLY_PAID",
  "FULLY_PAID",
  "OVERDUE",
  "CANCELLED",
] as const;

export const TERM_NAMES = ["First Term", "Second Term", "Third Term"] as const;

export const STUDENT_STATUSES = ["ACTIVE", "INACTIVE", "GRADUATED", "TRANSFERRED"] as const;

export const GENDERS = ["Male", "Female"] as const;

export function roleLabel(role: string): string {
  return ROLE_LABELS[role] ?? role;
}
