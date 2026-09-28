"use server";

import { revalidatePath } from "next/cache";
import { authUser, clientIp } from "@/lib/auth";
import * as people from "@/lib/repo/people";
import * as academics from "@/lib/repo/academics";
import { str, optStr, num, optNum, optDateStr, fail, ok, logAudit, type ActionResult } from "@/lib/server-utils";

const ADMIN = ["SUPER_ADMIN", "ADMIN"];

export async function saveTeacherAction(fd: FormData): Promise<ActionResult> {
  try {
    const user = await authUser(ADMIN);
    const id = optNum(fd, "id");
    const firstName = str(fd, "firstName", { required: true, max: 60 });
    const lastName = str(fd, "lastName", { required: true, max: 60 });
    const gender = optStr(fd, "gender", 10);
    const phone = optStr(fd, "phone", 25);
    const email = optStr(fd, "email", 120)?.toLowerCase() ?? null;
    const address = optStr(fd, "address", 300);
    const qualification = optStr(fd, "qualification", 120);
    const specialization = optStr(fd, "specialization", 120);
    const dateEmployed = optDateStr(fd, "dateEmployed");
    const photoUrl = optStr(fd, "photoUrl", 500);
    const status = str(fd, "status", { max: 20 }) || "ACTIVE";

    if (id) {
      people.updateTeacher(id, { firstName, lastName, gender, phone, email, address, qualification, specialization, dateEmployed, photoUrl, status });
      await logAudit({ user, action: "Updated teacher record", entity: "Teacher", entityId: id, newValue: { firstName, lastName, status }, ip: await clientIp() });
      revalidatePath("/teachers");
      return ok("Teacher updated successfully", id);
    }

    const teacherCode = str(fd, "teacherCode", { max: 20 }) || people.nextTeacherCode();
    if (people.teacherCodeExists(teacherCode)) throw new Error("Teacher ID already exists");

    const createdId = people.createTeacher({
      teacherCode, firstName, lastName, gender, phone, email, address, qualification, specialization, dateEmployed, photoUrl, status,
    });
    await logAudit({ user, action: "Enrolled new teacher", entity: "Teacher", entityId: createdId, newValue: { firstName, lastName, teacherCode }, ip: await clientIp() });
    revalidatePath("/teachers");
    return ok(`Teacher ${firstName} ${lastName} enrolled successfully`, createdId);
  } catch (e) {
    return fail(e);
  }
}

export async function setTeacherStatusAction(fd: FormData): Promise<ActionResult> {
  try {
    const user = await authUser(ADMIN);
    const id = num(fd, "id", { required: true });
    const status = str(fd, "status", { max: 20 }) || "INACTIVE";
    const before = people.getTeacherById(id);
    people.setTeacherStatus(id, status);
    if (status === "INACTIVE") {
      const { run } = await import("@/lib/db");
      run(`UPDATE users SET status = 'SUSPENDED', updated_at = datetime('now') WHERE teacher_id = ?`, [id]);
    }
    await logAudit({ user, action: `Changed teacher status to ${status}`, entity: "Teacher", entityId: id, oldValue: before?.status, newValue: status, ip: await clientIp() });
    revalidatePath("/teachers");
    return ok(`Teacher status updated to ${status.toLowerCase()}`);
  } catch (e) {
    return fail(e);
  }
}

export async function assignTeacherClassAction(fd: FormData): Promise<ActionResult> {
  try {
    const user = await authUser(ADMIN);
    const teacherId = num(fd, "teacherId", { required: true });
    const classId = num(fd, "classId", { required: true });
    const sessionId = num(fd, "sessionId", { required: true });
    const termId = num(fd, "termId", { required: true });
    const role = str(fd, "role", { max: 30 }) === "SUBJECT_TEACHER" ? "SUBJECT_TEACHER" : "CLASS_TEACHER";
    const subject = optStr(fd, "subject", 80);

    const teacher = people.getTeacherById(teacherId);
    const cls = academics.getClassById(classId);
    if (!teacher || !cls) throw new Error("Teacher or class not found");
    if (teacher.status !== "ACTIVE") throw new Error("Cannot assign an inactive teacher");

    const existing = academics.listTeacherAssignments({ teacherId, classId, sessionId, termId, });
    if (existing.some((a) => a.role === role)) {
      throw new Error(`${teacher.firstName} is already assigned to ${cls.name} for this term`);
    }

    if (role === "CLASS_TEACHER") {
      const current = await import("@/lib/repo/academics");
      const classTeacher = current.listTeacherAssignments({ classId, sessionId, termId }).filter((a) => a.role === "CLASS_TEACHER");
      if (classTeacher.length > 0) {
        throw new Error(`${cls.name} already has a class teacher. Remove the current one or use the subject teacher role.`);
      }
      const { run } = await import("@/lib/db");
      run(`UPDATE classes SET class_teacher_id = ?, updated_at = datetime('now') WHERE id = ?`, [teacherId, classId]);
    }

    const createdId = academics.createTeacherAssignment({ teacherId, classId, sessionId, termId, role, subject });
    await logAudit({ user, action: `Assigned teacher to ${cls.name}`, entity: "TeacherClassAssignment", entityId: createdId, newValue: { teacherId, classId, role }, ip: await clientIp() });
    revalidatePath("/assignments/teachers");
    return ok(`${teacher.firstName} ${teacher.lastName} assigned to ${cls.name} successfully`);
  } catch (e) {
    return fail(e);
  }
}

export async function removeTeacherAssignmentAction(fd: FormData): Promise<ActionResult> {
  try {
    const user = await authUser(ADMIN);
    const id = num(fd, "id", { required: true });
    const rows = academics.listTeacherAssignments({});
    const target = rows.find((r) => r.id === id);
    academics.deleteTeacherAssignment(id);
    if (target?.role === "CLASS_TEACHER") {
      const { run } = await import("@/lib/db");
      run(`UPDATE classes SET class_teacher_id = NULL WHERE id = ? AND class_teacher_id = ?`, [target.classId, target.teacherId]);
    }
    await logAudit({ user, action: `Removed teacher assignment from ${target?.className ?? "class"}`, entity: "TeacherClassAssignment", entityId: id, oldValue: target, ip: await clientIp() });
    revalidatePath("/assignments/teachers");
    return ok("Teacher assignment removed");
  } catch (e) {
    return fail(e);
  }
}
