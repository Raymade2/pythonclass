import "server-only";
import { all, get, run, camelize, camelAll, inClause } from "@/lib/db";
import type { StudentListRow, StudentRow, TeacherListRow, TeacherRow, ParentRow } from "./types";

// ---------------------------------------------------------------------------
// Parents
// ---------------------------------------------------------------------------

export function findParentByPhone(phone: string): ParentRow | undefined {
  return camelize<ParentRow>(get(`SELECT * FROM parents WHERE phone = ?`, [phone]));
}

export function getParentById(id: number): ParentRow | undefined {
  return camelize<ParentRow>(get(`SELECT * FROM parents WHERE id = ?`, [id]));
}

export function createParent(data: {
  name: string;
  relationship: string;
  phone: string;
  email: string | null;
  address: string | null;
}): number {
  return run(
    `INSERT INTO parents (name, relationship, phone, email, address) VALUES (?, ?, ?, ?, ?)`,
    [data.name, data.relationship, data.phone, data.email, data.address]
  ).lastInsertRowid;
}

export function updateParent(id: number, data: {
  name: string;
  relationship: string;
  phone: string;
  email: string | null;
  address: string | null;
}): void {
  run(`UPDATE parents SET name = ?, relationship = ?, phone = ?, email = ?, address = ? WHERE id = ?`, [
    data.name,
    data.relationship,
    data.phone,
    data.email,
    data.address,
    id,
  ]);
}

// ---------------------------------------------------------------------------
// Students
// ---------------------------------------------------------------------------

export type StudentFilter = {
  q?: string;
  status?: string;
  gender?: string;
  classId?: number;
  sessionId?: number;
  termId?: number;
  classGroupId?: number;
  studentIds?: number[];
  limit?: number;
  offset?: number;
};

function studentWhere(filter: StudentFilter): { whereSql: string; params: unknown[]; joinSql: string } {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filter.q) {
    where.push(
      `(s.first_name || ' ' || s.last_name LIKE ? OR s.last_name || ' ' || s.first_name LIKE ? OR s.student_code LIKE ? OR s.admission_number LIKE ? OR EXISTS (SELECT 1 FROM parents p WHERE p.id = s.parent_id AND (p.name LIKE ? OR p.phone LIKE ?)))`
    );
    const like = `%${filter.q}%`;
    params.push(like, like, like, like, like, like);
  }
  if (filter.status) {
    where.push(`s.status = ?`);
    params.push(filter.status);
  }
  if (filter.gender) {
    where.push(`s.gender = ?`);
    params.push(filter.gender);
  }
  if (filter.classId) {
    where.push(`sca.class_id = ?`);
    params.push(filter.classId);
  }
  if (filter.classGroupId) {
    where.push(`c.class_group_id = ?`);
    params.push(filter.classGroupId);
  }
  if (filter.studentIds) {
    if (filter.studentIds.length === 0) {
      where.push(`1 = 0`);
    } else {
      where.push(`s.id IN ${inClause(filter.studentIds.length)}`);
      params.push(...filter.studentIds);
    }
  }
  const needsJoin = Boolean(filter.classId || filter.classGroupId);
  const joinSql = needsJoin
    ? filter.sessionId
      ? `JOIN student_class_assignments sca ON sca.student_id = s.id AND sca.session_id = ? ${filter.termId ? "AND sca.term_id = ?" : ""} JOIN classes c ON c.id = sca.class_id`
      : `JOIN student_class_assignments sca ON sca.student_id = s.id JOIN classes c ON c.id = sca.class_id`
    : "";
  const joinParams = needsJoin && filter.sessionId ? (filter.termId ? [filter.sessionId, filter.termId] : [filter.sessionId]) : [];
  return { whereSql: where.length ? `WHERE ${where.join(" AND ")}` : "", params, joinSql, joinParams };
}

export function listStudents(
  filter: StudentFilter
): { rows: StudentListRow[]; total: number } {
  const { whereSql, params, joinSql, joinParams } = studentWhere(filter);
  // Current class sub-select (for the selected session/term)
  const classSub = filter.sessionId
    ? `(SELECT c2.name FROM student_class_assignments sca2 JOIN classes c2 ON c2.id = sca2.class_id
        WHERE sca2.student_id = s.id AND sca2.session_id = ? ${filter.termId ? "AND sca2.term_id = ?" : ""} LIMIT 1)`
    : `(SELECT c2.name FROM student_class_assignments sca2 JOIN classes c2 ON c2.id = sca2.class_id
        WHERE sca2.student_id = s.id ORDER BY sca2.session_id DESC, sca2.term_id DESC LIMIT 1)`;
  const classSubParams = filter.sessionId ? (filter.termId ? [filter.sessionId, filter.termId] : [filter.sessionId]) : [];

  const base = `FROM students s
    LEFT JOIN parents p ON p.id = s.parent_id
    ${joinSql}
    ${whereSql}`;

  const total =
    get<{ n: number }>(`SELECT COUNT(DISTINCT s.id) AS n ${base}`, [...joinParams, ...params])?.n ?? 0;

  const rows = camelAll<StudentListRow>(
    all(
      `SELECT DISTINCT s.*, p.name AS parent_name, p.phone AS parent_phone, p.relationship AS parent_relationship,
        ${classSub} AS class_name,
        (SELECT sca3.class_id FROM student_class_assignments sca3 WHERE sca3.student_id = s.id ${
          filter.sessionId ? "AND sca3.session_id = ?" : ""
        } ${filter.termId ? "AND sca3.term_id = ?" : ""} ORDER BY sca3.id DESC LIMIT 1) AS class_id
      ${base}
      ORDER BY s.last_name, s.first_name
      LIMIT ? OFFSET ?`,
      [...classSubParams, ...(filter.sessionId ? classSubParams : []), ...joinParams, ...params, filter.limit ?? 50, filter.offset ?? 0]
    )
  );
  return { rows, total };
}

export function getStudentById(id: number): StudentRow | undefined {
  return camelize<StudentRow>(get(`SELECT * FROM students WHERE id = ?`, [id]));
}

export function getStudentListRow(id: number): StudentListRow | undefined {
  return camelAll<StudentListRow>(
    all(
      `SELECT s.*, p.name AS parent_name, p.phone AS parent_phone, p.relationship AS parent_relationship,
        (SELECT c2.name FROM student_class_assignments sca2 JOIN classes c2 ON c2.id = sca2.class_id
          WHERE sca2.student_id = s.id ORDER BY sca2.session_id DESC, sca2.term_id DESC LIMIT 1) AS class_name,
        (SELECT sca3.class_id FROM student_class_assignments sca3 WHERE sca3.student_id = s.id
          ORDER BY sca3.session_id DESC, sca3.term_id DESC LIMIT 1) AS class_id
      FROM students s LEFT JOIN parents p ON p.id = s.parent_id
      WHERE s.id = ?`,
      [id]
    )
  )[0];
}

export function countStudents(status?: string): number {
  return get<{ n: number }>(
    `SELECT COUNT(*) AS n FROM students ${status ? "WHERE status = ?" : ""}`,
    status ? [status] : []
  )?.n ?? 0;
}

export function nextAdmissionNumbers(sessionName?: string): { studentCode: string; admissionNumber: string } {
  const year = (sessionName?.split("/")[0]) || String(new Date().getFullYear());
  const n = get<{ n: number }>(`SELECT COUNT(*) AS n FROM students`)?.n ?? 0;
  const seq = String(n + 1).padStart(5, "0");
  return { studentCode: `SFGS/${year}/${seq}`, admissionNumber: `SFGS/ADM/${year}/${seq}` };
}

export function createStudent(data: {
  studentCode: string;
  admissionNumber: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  gender: string;
  dateOfBirth: string | null;
  photoUrl: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  parentId: number | null;
  admissionDate: string | null;
  status: string;
}): number {
  return run(
    `INSERT INTO students (student_code, admission_number, first_name, middle_name, last_name, gender, date_of_birth,
       photo_url, phone, email, address, parent_id, admission_date, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, date('now')), ?)`,
    [
      data.studentCode,
      data.admissionNumber,
      data.firstName,
      data.middleName,
      data.lastName,
      data.gender,
      data.dateOfBirth,
      data.photoUrl,
      data.phone,
      data.email,
      data.address,
      data.parentId,
      data.admissionDate,
      data.status,
    ]
  ).lastInsertRowid;
}

export function updateStudent(
  id: number,
  data: {
    studentCode: string;
    admissionNumber: string;
    firstName: string;
    middleName: string | null;
    lastName: string;
    gender: string;
    dateOfBirth: string | null;
    photoUrl: string | null;
    phone: string | null;
    email: string | null;
    address: string | null;
    parentId: number | null;
    admissionDate: string | null;
    status: string;
  }
): void {
  run(
    `UPDATE students SET student_code = ?, admission_number = ?, first_name = ?, middle_name = ?, last_name = ?, gender = ?,
       date_of_birth = ?, photo_url = ?, phone = ?, email = ?, address = ?, parent_id = ?, admission_date = COALESCE(admission_date, ?), status = ?,
       updated_at = datetime('now')
     WHERE id = ?`,
    [
      data.studentCode,
      data.admissionNumber,
      data.firstName,
      data.middleName,
      data.lastName,
      data.gender,
      data.dateOfBirth,
      data.photoUrl,
      data.phone,
      data.email,
      data.address,
      data.parentId,
      data.admissionDate,
      data.status,
      id,
    ]
  );
}

export function setStudentStatus(id: number, status: string): void {
  run(`UPDATE students SET status = ?, updated_at = datetime('now') WHERE id = ?`, [status, id]);
}

export function studentCodeExists(code: string, exceptId?: number): boolean {
  const row = get<{ n: number }>(
    `SELECT COUNT(*) AS n FROM students WHERE (student_code = ? OR admission_number = ?) AND id != ?`,
    [code, code, exceptId ?? -1]
  );
  return (row?.n ?? 0) > 0;
}

export function studentsForParent(parentId: number): StudentListRow[] {
  return camelAll<StudentListRow>(
    all(
      `SELECT s.*, p.name AS parent_name, p.phone AS parent_phone, p.relationship AS parent_relationship,
        (SELECT c2.name FROM student_class_assignments sca2 JOIN classes c2 ON c2.id = sca2.class_id
          WHERE sca2.student_id = s.id ORDER BY sca2.session_id DESC, sca2.term_id DESC LIMIT 1) AS class_name,
        (SELECT sca3.class_id FROM student_class_assignments sca3 WHERE sca3.student_id = s.id
          ORDER BY sca3.session_id DESC, sca3.term_id DESC LIMIT 1) AS class_id
      FROM students s LEFT JOIN parents p ON p.id = s.parent_id
      WHERE s.parent_id = ? ORDER BY s.first_name`,
      [parentId]
    )
  );
}

export function studentIdsForClasses(classIds: number[], sessionId?: number): number[] {
  if (classIds.length === 0) return [];
  const sessionFilter = sessionId ? `AND session_id = ?` : "";
  const params: unknown[] = [...classIds];
  if (sessionId) params.push(sessionId);
  return all<{ student_id: number }>(
    `SELECT DISTINCT student_id FROM student_class_assignments WHERE class_id IN ${inClause(classIds.length)} ${sessionFilter}`,
    params
  ).map((r) => r.student_id);
}

// ---------------------------------------------------------------------------
// Teachers
// ---------------------------------------------------------------------------

export type TeacherFilter = { q?: string; status?: string };

export function listTeachers(filter: TeacherFilter = {}): TeacherListRow[] {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filter.status) {
    where.push(`t.status = ?`);
    params.push(filter.status);
  }
  if (filter.q) {
    where.push(`(t.first_name || ' ' || t.last_name LIKE ? OR t.last_name LIKE ? OR t.teacher_code LIKE ? OR t.email LIKE ? OR t.phone LIKE ?)`);
    const like = `%${filter.q}%`;
    params.push(like, like, like, like, like);
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  return camelAll<TeacherListRow>(
    all(
      `SELECT t.*,
        (SELECT COUNT(DISTINCT class_id) FROM teacher_class_assignments tca WHERE tca.teacher_id = t.id) AS class_count,
        EXISTS(SELECT 1 FROM users u WHERE u.teacher_id = t.id) AS has_account
      FROM teachers t ${whereSql} ORDER BY t.last_name, t.first_name`,
      params
    )
  );
}

export function getTeacherById(id: number): TeacherRow | undefined {
  return camelize<TeacherRow>(get(`SELECT * FROM teachers WHERE id = ?`, [id]));
}

export function nextTeacherCode(): string {
  const n = get<{ n: number }>(`SELECT COUNT(*) AS n FROM teachers`)?.n ?? 0;
  return `TCH-${String(n + 1).padStart(4, "0")}`;
}

export function teacherCodeExists(code: string, exceptId?: number): boolean {
  const row = get<{ n: number }>(`SELECT COUNT(*) AS n FROM teachers WHERE teacher_code = ? AND id != ?`, [code, exceptId ?? -1]);
  return (row?.n ?? 0) > 0;
}

export function createTeacher(data: {
  teacherCode: string;
  firstName: string;
  lastName: string;
  gender: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  qualification: string | null;
  specialization: string | null;
  dateEmployed: string | null;
  photoUrl: string | null;
  status: string;
}): number {
  return run(
    `INSERT INTO teachers (teacher_code, first_name, last_name, gender, phone, email, address, qualification, specialization, date_employed, photo_url, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.teacherCode, data.firstName, data.lastName, data.gender, data.phone, data.email, data.address,
      data.qualification, data.specialization, data.dateEmployed, data.photoUrl, data.status,
    ]
  ).lastInsertRowid;
}

export function updateTeacher(
  id: number,
  data: {
    firstName: string;
    lastName: string;
    gender: string | null;
    phone: string | null;
    email: string | null;
    address: string | null;
    qualification: string | null;
    specialization: string | null;
    dateEmployed: string | null;
    photoUrl: string | null;
    status: string;
  }
): void {
  run(
    `UPDATE teachers SET first_name = ?, last_name = ?, gender = ?, phone = ?, email = ?, address = ?, qualification = ?,
       specialization = ?, date_employed = ?, photo_url = ?, status = ?, updated_at = datetime('now') WHERE id = ?`,
    [
      data.firstName, data.lastName, data.gender, data.phone, data.email, data.address, data.qualification,
      data.specialization, data.dateEmployed, data.photoUrl, data.status, id,
    ]
  );
}

export function setTeacherStatus(id: number, status: string): void {
  run(`UPDATE teachers SET status = ?, updated_at = datetime('now') WHERE id = ?`, [status, id]);
}

// ---------------------------------------------------------------------------
// Global search
// ---------------------------------------------------------------------------

export type GlobalSearchResults = {
  students: StudentListRow[];
  teachers: TeacherListRow[];
  invoices: { id: number; invoiceNumber: string; studentName: string; status: string }[];
  payments: { id: number; reference: string; receiptNumber: string | null; studentName: string; amount: number }[];
  classes: { id: number; name: string; code: string }[];
};

export function globalSearch(q: string, opts: { studentIds?: number[] | null }): GlobalSearchResults {
  const like = `%${q}%`;
  const studentScope = opts.studentIds ? `AND s.id IN ${inClause(opts.studentIds.length)}` : "";
  const studentParams = opts.studentIds ?? [];

  const students = camelAll<StudentListRow>(
    all(
      `SELECT s.*, p.name AS parent_name, p.phone AS parent_phone, p.relationship AS parent_relationship,
        (SELECT c2.name FROM student_class_assignments sca2 JOIN classes c2 ON c2.id = sca2.class_id
          WHERE sca2.student_id = s.id ORDER BY sca2.session_id DESC, sca2.term_id DESC LIMIT 1) AS class_name
      FROM students s LEFT JOIN parents p ON p.id = s.parent_id
      WHERE (s.first_name || ' ' || s.last_name LIKE ? OR s.last_name || ' ' || s.first_name LIKE ?
             OR s.student_code LIKE ? OR s.admission_number LIKE ?
             OR EXISTS (SELECT 1 FROM parents p2 WHERE p2.id = s.parent_id AND p2.phone LIKE ?))
      ${studentScope}
      ORDER BY s.last_name LIMIT 10`,
      [like, like, like, like, like, ...studentParams]
    )
  );

  const teachers = camelAll<TeacherListRow>(
    all(
      `SELECT t.*, 0 AS class_count, 0 AS has_account FROM teachers t
       WHERE t.first_name || ' ' || t.last_name LIKE ? OR t.teacher_code LIKE ? OR t.phone LIKE ?
       ORDER BY t.last_name LIMIT 10`,
      [like, like, like]
    )
  );

  const invoices = all(
    `SELECT i.id, i.invoice_number, i.status, s.first_name || ' ' || s.last_name AS student_name
     FROM invoices i JOIN students s ON s.id = i.student_id
     WHERE i.invoice_number LIKE ?
     ${opts.studentIds ? `AND s.id IN ${inClause(opts.studentIds.length)}` : ""}
     ORDER BY i.id DESC LIMIT 10`,
    [like, ...(opts.studentIds ?? [])]
  );

  const payments = all(
    `SELECT p.id, p.reference, p.receipt_number, p.amount, s.first_name || ' ' || s.last_name AS student_name
     FROM payments p JOIN students s ON s.id = p.student_id
     WHERE (p.reference LIKE ? OR p.receipt_number LIKE ? OR p.transaction_reference LIKE ?)
     ${opts.studentIds ? `AND s.id IN ${inClause(opts.studentIds.length)}` : ""}
     ORDER BY p.id DESC LIMIT 10`,
    [like, like, like, ...(opts.studentIds ?? [])]
  );

  const classes = all(`SELECT id, name, code FROM classes WHERE name LIKE ? OR code LIKE ? LIMIT 10`, [like, like]);

  return {
    students,
    teachers: teachers as unknown as TeacherListRow[],
    invoices: invoices as GlobalSearchResults["invoices"],
    payments: payments as GlobalSearchResults["payments"],
    classes: classes as GlobalSearchResults["classes"],
  };
}
