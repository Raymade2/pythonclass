import "server-only";
import type { AppUser } from "./auth";
import * as core from "@/lib/repo/core";
import * as people from "@/lib/repo/people";
import { all } from "@/lib/db";

export type ActionResult = { ok: boolean; message: string; id?: number };

// ---------------------------------------------------------------------------
// FormData parsing helpers with validation
// ---------------------------------------------------------------------------

export function str(fd: FormData, key: string, opts?: { required?: boolean; max?: number }): string {
  const v = (fd.get(key) ?? "").toString().trim();
  if (opts?.required && !v) throw new Error(`${label(key)} is required`);
  if (opts?.max && v.length > opts.max) throw new Error(`${label(key)} is too long`);
  return v;
}

export function optStr(fd: FormData, key: string, max = 300): string | null {
  const v = (fd.get(key) ?? "").toString().trim();
  if (!v) return null;
  return v.slice(0, max);
}

export function num(fd: FormData, key: string, opts?: { required?: boolean; min?: number; max?: number }): number {
  const raw = (fd.get(key) ?? "").toString().trim();
  if (!raw) {
    if (opts?.required) throw new Error(`${label(key)} is required`);
    return 0;
  }
  const n = Number(raw.replace(/,/g, ""));
  if (Number.isNaN(n)) throw new Error(`${label(key)} must be a number`);
  if (opts?.min !== undefined && n < opts.min) throw new Error(`${label(key)} must be at least ${opts.min}`);
  if (opts?.max !== undefined && n > opts.max) throw new Error(`${label(key)} must be at most ${opts.max}`);
  return Math.round(n);
}

export function optNum(fd: FormData, key: string): number | null {
  const raw = (fd.get(key) ?? "").toString().trim();
  if (!raw) return null;
  const n = Number(raw.replace(/,/g, ""));
  return Number.isNaN(n) ? null : Math.round(n);
}

export function optDate(fd: FormData, key: string): Date | null {
  const raw = (fd.get(key) ?? "").toString().trim();
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function optDateStr(fd: FormData, key: string): string | null {
  const d = optDate(fd, key);
  return d ? d.toISOString() : null;
}

export function bool(fd: FormData, key: string): boolean {
  const v = fd.get(key);
  return v === "on" || v === "true" || v === "1";
}

export function oneOf<T extends string>(fd: FormData, key: string, allowed: readonly T[], fallback: T): T {
  const v = (fd.get(key) ?? "").toString() as T;
  return allowed.includes(v) ? v : fallback;
}

function label(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/_/g, " ")
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}

export function fail(error: unknown): ActionResult {
  const message = error instanceof Error ? error.message : "Something went wrong";
  return { ok: false, message };
}

export function ok(message: string, id?: number): ActionResult {
  return { ok: true, message, id };
}

// ---------------------------------------------------------------------------
// Audit logging & notifications (thin wrappers over the repo)
// ---------------------------------------------------------------------------

export async function logAudit(params: {
  user: Pick<AppUser, "id" | "name"> | null;
  action: string;
  entity?: string;
  entityId?: string | number;
  oldValue?: unknown;
  newValue?: unknown;
  ip?: string;
}): Promise<void> {
  core.createAuditLog({
    userId: params.user?.id ?? null,
    userName: params.user?.name ?? "System",
    action: params.action,
    entity: params.entity,
    entityId: params.entityId,
    oldValue: params.oldValue,
    newValue: params.newValue,
    ip: params.ip,
  });
}

export async function notify(
  userIds: number[],
  n: { title: string; message: string; type?: string; link?: string }
): Promise<void> {
  core.createNotifications(userIds, n);
}

export async function parentUserIdsForStudent(studentId: number): Promise<number[]> {
  const s = people.getStudentById(studentId);
  if (!s?.parentId) return [];
  return all<{ id: number }>(`SELECT id FROM users WHERE parent_id = ? AND status = 'ACTIVE'`, [s.parentId]).map((r) => r.id);
}

export async function adminUserIds(): Promise<number[]> {
  return core.userIdsByRole(["SUPER_ADMIN", "ADMIN"]);
}
