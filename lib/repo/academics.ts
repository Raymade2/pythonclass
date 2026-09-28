import "server-only";
import { all, get, run, camelize, camelAll } from "@/lib/db";
import type { SessionRow, TermRow, ClassGroupRow, ClassListRow, AssignmentRow, TeacherAssignmentRow } from "./types";

// ---------------------------------------------------------------------------
// Sessions & terms
// ---------------------------------------------------------------------------

export function listSessions(): SessionRow[] {
  return camelAll<SessionRow>(all(`SELECT * FROM academic_sessions ORDER BY name DESC`));
}

export function listSessionsWithTerms(): (SessionRow & { terms: TermRow[] })[] {
  const sessions = listSessions();
  const terms = camelAll<TermRow>(all(`SELECT * FROM terms ORDER BY session_id, id`));
  return sessions.map((s) => ({ ...s, terms: terms.filter((t) => t.sessionId === s.id) }));
}

export function getSessionById(id: number): SessionRow | undefined {
  return camelize<SessionRow>(get(`SELECT * FROM academic_sessions WHERE id = ?`, [id]));
}

export function getSessionByName(name: string): SessionRow | undefined {
  return camelize<SessionRow>(get(`SELECT * FROM academic_sessions WHERE name = ?`, [name]));
}

export function createSession(data: { name: string; startDate: string | null; endDate: string | null }): number {
  const r = run(
    `INSERT INTO academic_sessions (name, start_date, end_date, is_current, status) VALUES (?, ?, ?, 0, 'ACTIVE')`,
    [data.name, data.startDate, data.endDate]
  );
  const sessionId = r.lastInsertRowid;
  for (const termName of ["First Term", "Second Term", "Third Term"]) {
    run(`INSERT INTO terms (name, session_id, status) VALUES (?, ?, 'ACTIVE')`, [termName, sessionId]);
  }
  return sessionId;
}

export function updateSession(id: number, data: { name: string; startDate: string | null; endDate: string | null; status: string }): void {
  run(`UPDATE academic_sessions SET name = ?, start_date = ?, end_date = ?, status = ? WHERE id = ?`, [
    data.name,
    data.startDate,
    data.endDate,
    data.status,
    id,
  ]);
}

export function setCurrentSessionTerm(sessionId: number, termId: number): void {
  run(`UPDATE academic_sessions SET is_current = 0`);
  run(`UPDATE academic_sessions SET is_current = 1, status = 'ACTIVE' WHERE id = ?`, [sessionId]);
  run(`UPDATE terms SET is_current = 0`);
  run(`UPDATE terms SET is_current = 1, status = 'ACTIVE' WHERE id = ? AND session_id = ?`, [termId, sessionId]);
}

export function deleteSession(id: number): void {
  run(`DELETE FROM academic_sessions WHERE id = ?`, [id]);
}

export function sessionHasData(id: number): boolean {
  const n =
    get<{ n: number }>(`SELECT COUNT(*) AS n FROM invoices WHERE session_id = ?`, [id])?.n ?? 0;
  return n > 0;
}

export function getTermById(id: number): TermRow | undefined {
  return camelize<TermRow>(get(`SELECT * FROM terms WHERE id = ?`, [id]));
}

export function listTermsForSession(sessionId: number): TermRow[] {
  return camelAll<TermRow>(all(`SELECT * FROM terms WHERE session_id = ? ORDER BY id`, [sessionId]));
}

export function updateTerm(
  id: number,
  data: { name: string; startDate: string | null; endDate: string | null; status: string }
): void {
  run(`UPDATE terms SET name = ?, start_date = ?, end_date = ?, status = ? WHERE id = ?`, [
    data.name,
    data.startDate,
    data.endDate,
    data.status,
    id,
  ]);
}

export type CurrentAcademic = { session: SessionRow; term: TermRow } | null;

export function getCurrentAcademic(): CurrentAcademic {
  const session = camelize<SessionRow>(
    get(`SELECT * FROM academic_sessions WHERE is_current = 1 ORDER BY id DESC LIMIT 1`)
  );
  if (session) {
    const term = camelize<TermRow>(
      get(`SELECT * FROM terms WHERE session_id = ? AND is_current = 1 LIMIT 1`, [session.id])
    ) ?? camelize<TermRow>(get(`SELECT * FROM terms WHERE session_id = ? ORDER BY id LIMIT 1`, [session.id]));
    if (term) return { session, term };
  }
  const anySession = camelize<SessionRow>(get(`SELECT * FROM academic_sessions ORDER BY name DESC LIMIT 1`));
  if (!anySession) return null;
  const anyTerm = camelize<TermRow>(get(`SELECT * FROM terms WHERE session_id = ? ORDER BY id LIMIT 1`, [anySession.id]));
  if (!anyTerm) return null;
  return { session: anySession, term: anyTerm };
}

// ---------------------------------------------------------------------------
// Class groups
// ---------------------------------------------------------------------------

export function listClassGroups(): ClassGroupRow[] {
  return camelAll<ClassGroupRow>(all(`SELECT * FROM class_groups ORDER BY id`));
}

export function listClassGroupsWithCounts(): (ClassGroupRow & { classCount: number })[] {
  return camelAll(
    all(
      `SELECT g.*, (SELECT COUNT(*) FROM classes c WHERE c.class_group_id = g.id) AS class_count
       FROM class_groups g ORDER BY g.id`
    )
  );
}

export function getClassGroupByName(name: string): ClassGroupRow | undefined {
  return camelize<ClassGroupRow>(get(`SELECT * FROM class_groups WHERE name = ?`, [name]));
}

export function createClassGroup(data: { name: string; description: string | null }): number {
  return run(`INSERT INTO class_groups (name, description, status) VALUES (?, ?, 'ACTIVE')`, [
    data.name,
    data.description,
  ]).lastInsertRowid;
}

export function updateClassGroup(id: number, data: { name: string; description: string | null; status: string }): void {
  run(`UPDATE class_groups SET name = ?, description = ?, status = ? WHERE id = ?`, [
    data.name,
    data.description,
    data.status,
    id,
  ]);
}

export function deleteClassGroup(id: number): void {
  run(`DELETE FROM class_groups WHERE id = ?`, [id]);
}

export function countClassesInGroup(id: number): number {
  return get<{ n: number }>(`SELECT COUNT(*) AS n FROM classes WHERE class_group_id = ?`, [id])?.n ?? 0;
}

// ---------------------------------------------------------------------------
// Classes
// ---------------------------------------------------------------------------

export type ClassFilter = { sessionId?: number; termId?: number; status?: string; q?: string; classGroupId?: number };

export function listClasses(filter: ClassFilter = {}): ClassListRow[] {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filter.status) {
    where.push(`c.status = ?`);
    params.push(filter.status);
  }
  if (filter.classGroupId) {
    where.push(`c.class_group_id = ?`);
    params.push(filter.classGroupId);
  }
  if (filter.q) {
    where.push(`(c.name LIKE ? OR c.code LIKE ?)`);
    const like = `%${filter.q}%`;
    params.push(like, like);
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  return camelAll<ClassListRow>(
    all(
      `SELECT c.*, g.name AS group_name,
        (t.first_name || ' ' || t.last_name) AS teacher_name,
        (SELECT COUNT(*) FROM student_class_assignments sca
          WHERE sca.class_id = c.id AND sca.session_id = ? AND sca.term_id = ?) AS student_count,
        (SELECT COALESCE(SUM(f.amount), 0) FROM fees f
          WHERE f.class_id = c.id AND f.session_id = ? AND f.term_id = ? AND f.status = 'ACTIVE') AS fee_total
      FROM classes c
      LEFT JOIN class_groups g ON g.id = c.class_group_id
      LEFT JOIN teachers t ON t.id = c.class_teacher_id
      ${whereSql}
      ORDER BY c.id`,
      [
        filter.sessionId ?? 0,
        filter.termId ?? 0,
        filter.sessionId ?? 0,
        filter.termId ?? 0,
        ...params,
      ]
    )
  );
}

export function getClassById(id: number): ClassListRow | undefined {
  return camelAll<ClassListRow>(
    all(
      `SELECT c.*, g.name AS group_name,
        (t.first_name || ' ' || t.last_name) AS teacher_name,
        0 AS student_count, 0 AS fee_total
      FROM classes c
      LEFT JOIN class_groups g ON g.id = c.class_group_id
      LEFT JOIN teachers t ON t.id = c.class_teacher_id
      WHERE c.id = ?`,
      [id]
    )
  )[0];
}

export function getClassByName(name: string) {
  return camelize(get(`SELECT * FROM classes WHERE name = ?`, [name]));
}

export function getClassByCode(code: string) {
  return camelize(get(`SELECT * FROM classes WHERE code = ?`, [code]));
}

export function createClass(data: {
  name: string;
  code: string;
  section: string | null;
  classGroupId: number | null;
  sessionId: number | null;
  classTeacherId: number | null;
  capacity: number;
}): number {
  return run(
    `INSERT INTO classes (name, code, section, class_group_id, session_id, class_teacher_id, capacity, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE')`,
    [data.name, data.code, data.section, data.classGroupId, data.sessionId, data.classTeacherId, data.capacity]
  ).lastInsertRowid;
}

export function updateClass(
  id: number,
  data: {
    name: string;
    code: string;
    section: string | null;
    classGroupId: number | null;
    sessionId: number | null;
    classTeacherId: number | null;
    capacity: number;
    status: string;
  }
): void {
  run(
    `UPDATE classes SET name = ?, code = ?, section = ?, class_group_id = ?, session_id = ?, class_teacher_id = ?, capacity = ?, status = ?, updated_at = datetime('now') WHERE id = ?`,
    [data.name, data.code, data.section, data.classGroupId, data.sessionId, data.classTeacherId, data.capacity, data.status, id]
  );
}

export function classDependencyCounts(id: number): { students: number; fees: number; teachers: number } {
  return {
    students: get<{ n: number }>(`SELECT COUNT(*) AS n FROM student_class_assignments WHERE class_id = ?`, [id])?.n ?? 0,
    fees: get<{ n: number }>(`SELECT COUNT(*) AS n FROM fees WHERE class_id = ?`, [id])?.n ?? 0,
    teachers: get<{ n: number }>(`SELECT COUNT(*) AS n FROM teacher_class_assignments WHERE class_id = ?`, [id])?.n ?? 0,
  };
}

export function deleteClass(id: number): void {
  run(`DELETE FROM classes WHERE id = ?`, [id]);
}

export function deactivateClass(id: number): void {
  run(`UPDATE classes SET status = 'INACTIVE', updated_at = datetime('now') WHERE id = ?`, [id]);
}

// ---------------------------------------------------------------------------
// Student-class assignments
// ---------------------------------------------------------------------------

export function countStudentsInClass(classId: number, sessionId: number, termId: number): number {
  return (
    get<{ n: number }>(
      `SELECT COUNT(*) AS n FROM student_class_assignments WHERE class_id = ? AND session_id = ? AND term_id = ?`,
      [classId, sessionId, termId]
    )?.n ?? 0
  );
}

export function getStudentClassAssignment(studentId: number, sessionId: number, termId: number) {
  return camelize(
    get(
      `SELECT * FROM student_class_assignments WHERE student_id = ? AND session_id = ? AND term_id = ?`,
      [studentId, sessionId, termId]
    )
  );
}

export function upsertStudentAssignment(
  studentId: number,
  classId: number,
  sessionId: number,
  termId: number,
  byName: string
): void {
  const existing = getStudentClassAssignment(studentId, sessionId, termId);
  if (existing) {
    run(`UPDATE student_class_assignments SET class_id = ?, assigned_at = datetime('now'), assigned_by_name = ? WHERE id = ?`, [
      classId,
      byName,
      existing.id,
    ]);
  } else {
    run(
      `INSERT INTO student_class_assignments (student_id, class_id, session_id, term_id, assigned_by_name) VALUES (?, ?, ?, ?, ?)`,
      [studentId, classId, sessionId, termId, byName]
    );
  }
}

export function listStudentAssignments(filters: {
  sessionId: number;
  termId: number;
  classId?: number;
  q?: string;
  limit?: number;
  offset?: number;
}): { rows: AssignmentRow[]; total: number } {
  const where = [`sca.session_id = ?`, `sca.term_id = ?`];
  const params: unknown[] = [filters.sessionId, filters.termId];
  if (filters.classId) {
    where.push(`sca.class_id = ?`);
    params.push(filters.classId);
  }
  if (filters.q) {
    where.push(`(s.first_name || ' ' || s.last_name LIKE ? OR s.student_code LIKE ? OR s.admission_number LIKE ?)`);
    const like = `%${filters.q}%`;
    params.push(like, like, like);
  }
  const whereSql = `WHERE ${where.join(" AND ")}`;
  const total =
    get<{ n: number }>(
      `SELECT COUNT(*) AS n FROM student_class_assignments sca JOIN students s ON s.id = sca.student_id ${whereSql}`,
      params
    )?.n ?? 0;
  const rows = camelAll<AssignmentRow>(
    all(
      `SELECT sca.*, s.first_name, s.middle_name, s.last_name, s.student_code, s.admission_number, s.status AS student_status,
              c.name AS class_name, c.code AS class_code
       FROM student_class_assignments sca
       JOIN students s ON s.id = sca.student_id
       JOIN classes c ON c.id = sca.class_id
       ${whereSql}
       ORDER BY c.id, s.last_name, s.first_name
       LIMIT ? OFFSET ?`,
      [...params, filters.limit ?? 100, filters.offset ?? 0]
    )
  );
  return { rows, total };
}

export function listStudentAssignmentHistory(studentId: number): AssignmentRow[] {
  return camelAll<AssignmentRow>(
    all(
      `SELECT sca.*, s.first_name, s.middle_name, s.last_name, s.student_code, s.admission_number,
              c.name AS class_name, c.code AS class_code, ses.name AS session_name, t.name AS term_name
       FROM student_class_assignments sca
       JOIN students s ON s.id = sca.student_id
       JOIN classes c ON c.id = sca.class_id
       JOIN academic_sessions ses ON ses.id = sca.session_id
       JOIN terms t ON t.id = sca.term_id
       WHERE sca.student_id = ?
       ORDER BY sca.session_id DESC, sca.term_id DESC`,
      [studentId]
    )
  );
}

// ---------------------------------------------------------------------------
// Teacher-class assignments
// ---------------------------------------------------------------------------

export function listTeacherAssignments(filters: {
  sessionId?: number;
  termId?: number;
  classId?: number;
  teacherId?: number;
}): TeacherAssignmentRow[] {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filters.sessionId) {
    where.push(`tca.session_id = ?`);
    params.push(filters.sessionId);
  }
  if (filters.termId) {
    where.push(`tca.term_id = ?`);
    params.push(filters.termId);
  }
  if (filters.classId) {
    where.push(`tca.class_id = ?`);
    params.push(filters.classId);
  }
  if (filters.teacherId) {
    where.push(`tca.teacher_id = ?`);
    params.push(filters.teacherId);
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  return camelAll<TeacherAssignmentRow>(
    all(
      `SELECT tca.id, tca.teacher_id, tca.class_id, tca.session_id, tca.term_id, tca.role, tca.subject, tca.assigned_at,
              t.teacher_code, t.first_name, t.last_name, c.name AS class_name, c.code AS class_code,
              ses.name AS session_name, tm.name AS term_name
       FROM teacher_class_assignments tca
       JOIN teachers t ON t.id = tca.teacher_id
       JOIN classes c ON c.id = tca.class_id
       JOIN academic_sessions ses ON ses.id = tca.session_id
       JOIN terms tm ON tm.id = tca.term_id
       ${whereSql}
       ORDER BY tca.session_id DESC, tca.term_id DESC, c.id, tca.role, t.last_name`,
      params
    )
  );
}

export function createTeacherAssignment(data: {
  teacherId: number;
  classId: number;
  sessionId: number;
  termId: number;
  role: string;
  subject: string | null;
}): number {
  return run(
    `INSERT INTO teacher_class_assignments (teacher_id, class_id, session_id, term_id, role, subject) VALUES (?, ?, ?, ?, ?, ?)`,
    [data.teacherId, data.classId, data.sessionId, data.termId, data.role, data.subject]
  ).lastInsertRowid;
}

export function deleteTeacherAssignment(id: number): void {
  run(`DELETE FROM teacher_class_assignments WHERE id = ?`, [id]);
}

export function teacherClassIds(teacherId: number, sessionId: number): number[] {
  return all<{ class_id: number }>(
    `SELECT DISTINCT class_id FROM teacher_class_assignments WHERE teacher_id = ? AND session_id = ?`,
    [teacherId, sessionId]
  ).map((r) => r.class_id);
}
