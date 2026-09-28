import "server-only";
import { all, get, run, camelize, camelAll } from "@/lib/db";
import type { NotificationRow, School, UserRow, UserWithLinks, AuditLogRow } from "./types";

// ---------------------------------------------------------------------------
// School profile
// ---------------------------------------------------------------------------

export function getSchool(): School {
  const row = get<Record<string, unknown>>(
    `SELECT id, name, short_name, address, phone, email, motto, logo_url FROM school WHERE id = 1`
  );
  return camelize<School>(row) ?? {
    id: 1,
    name: "Sure Foundation Group of Schools",
    shortName: "SFGS",
    address: "Km 5, Foundation Avenue, GRA, Ikeja, Lagos State, Nigeria",
    phone: "+234 803 000 0000",
    email: "info@surefoundationschools.edu.ng",
    motto: "Built on Sure Foundation",
    logoUrl: null,
  };
}

export function updateSchool(data: Partial<School>): void {
  run(
    `UPDATE school SET name = ?, address = ?, phone = ?, email = ?, motto = ?, logo_url = ?, short_name = ? WHERE id = 1`,
    [data.name, data.address, data.phone, data.email, data.motto, data.logoUrl, data.shortName]
  );
}

// ---------------------------------------------------------------------------
// Auth & users
// ---------------------------------------------------------------------------

export function getUserByIdentifier(identifier: string): UserWithLinks | undefined {
  const row = get<Record<string, unknown>>(
    `SELECT u.*, t.first_name AS t_first, t.last_name AS t_last, p.name AS p_name, p.phone AS p_phone
     FROM users u
     LEFT JOIN teachers t ON t.id = u.teacher_id
     LEFT JOIN parents p ON p.id = u.parent_id
     WHERE LOWER(u.email) = LOWER(?) OR LOWER(u.username) = LOWER(?)`,
    [identifier, identifier]
  );
  if (!row) return undefined;
  const user = camelize<UserWithLinks>(row)!;
  user.teacher =
    row.t_first !== null && row.t_first !== undefined
      ? { id: user.teacherId!, firstName: String(row.t_first), lastName: String(row.t_last) }
      : null;
  user.parent =
    row.p_name !== null && row.p_name !== undefined
      ? { id: user.parentId!, name: String(row.p_name), phone: String(row.p_phone ?? "") }
      : null;
  return user;
}

export function getUserById(id: number): UserWithLinks | undefined {
  const row = get<Record<string, unknown>>(
    `SELECT u.*, t.first_name AS t_first, t.last_name AS t_last, p.name AS p_name, p.phone AS p_phone
     FROM users u
     LEFT JOIN teachers t ON t.id = u.teacher_id
     LEFT JOIN parents p ON p.id = u.parent_id
     WHERE u.id = ?`,
    [id]
  );
  if (!row) return undefined;
  const user = camelize<UserWithLinks>(row)!;
  user.teacher =
    row.t_first !== null && row.t_first !== undefined
      ? { id: user.teacherId!, firstName: String(row.t_first), lastName: String(row.t_last) }
      : null;
  user.parent =
    row.p_name !== null && row.p_name !== undefined
      ? { id: user.parentId!, name: String(row.p_name), phone: String(row.p_phone ?? "") }
      : null;
  return user;
}

export function listUsers(): UserRow[] {
  return camelAll<UserRow>(
    all(`SELECT id, name, email, phone, username, role, status, teacher_id, parent_id, last_login_at, created_at
         FROM users ORDER BY role, name`)
  );
}

export function createUser(data: {
  name: string;
  email: string;
  phone: string | null;
  username: string;
  passwordHash: string;
  role: string;
  teacherId: number | null;
  parentId: number | null;
}): number {
  const r = run(
    `INSERT INTO users (name, email, phone, username, password_hash, role, status, teacher_id, parent_id)
     VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?)`,
    [data.name, data.email, data.phone, data.username, data.passwordHash, data.role, data.teacherId, data.parentId]
  );
  return r.lastInsertRowid;
}

export function updateUser(
  id: number,
  data: { name: string; email: string; phone: string | null; username: string; role: string; teacherId: number | null; parentId: number | null }
): void {
  run(
    `UPDATE users SET name = ?, email = ?, phone = ?, username = ?, role = ?, teacher_id = ?, parent_id = ?, updated_at = datetime('now') WHERE id = ?`,
    [data.name, data.email, data.phone, data.username, data.role, data.teacherId, data.parentId, id]
  );
}

export function updateUserPassword(id: number, hash: string): void {
  run(`UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?`, [hash, id]);
}

export function setUserStatus(id: number, status: string): void {
  run(`UPDATE users SET status = ?, updated_at = datetime('now') WHERE id = ?`, [status, id]);
}

export function deleteUser(id: number): void {
  run(`DELETE FROM users WHERE id = ?`, [id]);
}

export function countUsers(where: string, params: unknown[] = []): number {
  return get<{ n: number }>(`SELECT COUNT(*) AS n FROM users WHERE ${where}`, params)?.n ?? 0;
}

export function userIdsByRole(roles: string[]): number[] {
  if (roles.length === 0) return [];
  const qs = roles.map(() => "?").join(",");
  return all<{ id: number }>(`SELECT id FROM users WHERE role IN (${qs}) AND status = 'ACTIVE'`, roles).map((r) => r.id);
}

export function touchLastLogin(id: number): void {
  run(`UPDATE users SET last_login_at = datetime('now') WHERE id = ?`, [id]);
}

// ---------------------------------------------------------------------------
// Auth sessions
// ---------------------------------------------------------------------------

export function createAuthSession(id: string, userId: number, expiresAt: Date): void {
  run(`INSERT INTO auth_sessions (id, user_id, expires_at) VALUES (?, ?, ?)`, [id, userId, expiresAt.toISOString()]);
}

export function getAuthSession(id: string): UserWithLinks | undefined {
  const row = get<Record<string, unknown>>(
    `SELECT u.*, t.first_name AS t_first, t.last_name AS t_last, p.name AS p_name, p.phone AS p_phone, a.expires_at AS a_expires
     FROM auth_sessions a
     JOIN users u ON u.id = a.user_id
     LEFT JOIN teachers t ON t.id = u.teacher_id
     LEFT JOIN parents p ON p.id = u.parent_id
     WHERE a.id = ?`,
    [id]
  );
  if (!row) return undefined;
  if (new Date(String(row.a_expires)) < new Date()) return undefined;
  const user = camelize<UserWithLinks>(row)!;
  user.teacher =
    row.t_first !== null && row.t_first !== undefined
      ? { id: user.teacherId!, firstName: String(row.t_first), lastName: String(row.t_last) }
      : null;
  user.parent =
    row.p_name !== null && row.p_name !== undefined
      ? { id: user.parentId!, name: String(row.p_name), phone: String(row.p_phone ?? "") }
      : null;
  return user;
}

export function deleteAuthSession(id: string): void {
  run(`DELETE FROM auth_sessions WHERE id = ?`, [id]);
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export function createNotifications(
  userIds: number[],
  n: { title: string; message: string; type?: string; link?: string }
): void {
  const ids = [...new Set(userIds)].filter((x) => Number.isFinite(x));
  if (ids.length === 0) return;
  const stmt = `INSERT INTO notifications (user_id, title, message, type, link) VALUES (?, ?, ?, ?, ?)`;
  for (const uid of ids) run(stmt, [uid, n.title, n.message, n.type ?? "info", n.link ?? null]);
}

export function listNotifications(userId: number, limit = 50): NotificationRow[] {
  return camelAll<NotificationRow>(
    all(
      `SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT ?`,
      [userId, limit]
    )
  );
}

export function countUnread(userId: number): number {
  return get<{ n: number }>(`SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND read_status = 0`, [userId])?.n ?? 0;
}

export function markAllNotificationsRead(userId: number): void {
  run(`UPDATE notifications SET read_status = 1 WHERE user_id = ?`, [userId]);
}

export function markNotificationRead(id: number, userId: number): void {
  run(`UPDATE notifications SET read_status = 1 WHERE id = ? AND user_id = ?`, [id, userId]);
}

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------

export function createAuditLog(data: {
  userId: number | null;
  userName: string | null;
  action: string;
  entity?: string | null;
  entityId?: string | number | null;
  oldValue?: unknown;
  newValue?: unknown;
  ip?: string | null;
}): void {
  try {
    run(
      `INSERT INTO audit_logs (user_id, user_name, action, entity, entity_id, old_value, new_value, ip)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.userId,
        data.userName,
        data.action,
        data.entity ?? null,
        data.entityId !== undefined && data.entityId !== null ? String(data.entityId) : null,
        data.oldValue === undefined || data.oldValue === null ? null : JSON.stringify(data.oldValue),
        data.newValue === undefined || data.newValue === null ? null : JSON.stringify(data.newValue),
        data.ip ?? null,
      ]
    );
  } catch (e) {
    console.error("audit log failed", e);
  }
}

export function listAuditLogs(filters: {
  q?: string;
  userId?: number;
  entity?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}): { rows: AuditLogRow[]; total: number } {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filters.q) {
    where.push(`(action LIKE ? OR user_name LIKE ? OR entity LIKE ? OR entity_id LIKE ?)`);
    const like = `%${filters.q}%`;
    params.push(like, like, like, like);
  }
  if (filters.userId) {
    where.push(`user_id = ?`);
    params.push(filters.userId);
  }
  if (filters.entity) {
    where.push(`entity = ?`);
    params.push(filters.entity);
  }
  if (filters.from) {
    where.push(`date(created_at) >= date(?)`);
    params.push(filters.from);
  }
  if (filters.to) {
    where.push(`date(created_at) <= date(?)`);
    params.push(filters.to);
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const total = get<{ n: number }>(`SELECT COUNT(*) AS n FROM audit_logs ${whereSql}`, params)?.n ?? 0;
  const rows = camelAll<AuditLogRow>(
    all(
      `SELECT * FROM audit_logs ${whereSql} ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`,
      [...params, filters.limit ?? 50, filters.offset ?? 0]
    )
  );
  return { rows, total };
}
