"use server";

import { revalidatePath } from "next/cache";
import { authUser, clientIp } from "@/lib/auth";
import * as people from "@/lib/repo/people";
import * as academics from "@/lib/repo/academics";
import { str, optStr, num, optNum, optDateStr, oneOf, fail, ok, logAudit, notify, adminUserIds, type ActionResult } from "@/lib/server-utils";
import { GENDERS, STUDENT_STATUSES } from "@/lib/constants";

const ADMIN = ["SUPER_ADMIN", "ADMIN"];

export async function saveStudentAction(fd: FormData): Promise<ActionResult> {
  try {
    const user = await authUser(ADMIN);
    const id = optNum(fd, "id");
    const firstName = str(fd, "firstName", { required: true, max: 60 });
    const middleName = optStr(fd, "middleName", 60);
    const lastName = str(fd, "lastName", { required: true, max: 60 });
    const gender = oneOf(fd, "gender", GENDERS, "Male");
    const dateOfBirth = optDateStr(fd, "dateOfBirth");
    const phone = optStr(fd, "phone", 25);
    const email = optStr(fd, "email", 120)?.toLowerCase() ?? null;
    const address = optStr(fd, "address", 300);
    const photoUrl = optStr(fd, "photoUrl", 500);
    const admissionDate = optDateStr(fd, "admissionDate");
    const status = oneOf(fd, "status", STUDENT_STATUSES, "ACTIVE");

    // Parent / guardian
    const parentName = optStr(fd, "parentName", 120);
    const parentRelationship = optStr(fd, "parentRelationship", 40) ?? "Parent";
    const parentPhone = optStr(fd, "parentPhone", 25);
    const parentEmail = optStr(fd, "parentEmail", 120)?.toLowerCase() ?? null;
    const parentAddress = optStr(fd, "parentAddress", 300);
    const existingParentId = optNum(fd, "parentId");

    let parentId = existingParentId ?? null;
    if (parentName && parentPhone) {
      let parent = people.findParentByPhone(parentPhone);
      if (!parent) {
        parentId = people.createParent({
          name: parentName, relationship: parentRelationship, phone: parentPhone, email: parentEmail, address: parentAddress,
        });
      } else {
        people.updateParent(parent.id, {
          name: parentName, relationship: parentRelationship, phone: parentPhone, email: parentEmail, address: parentAddress,
        });
        parentId = parent.id;
      }
    }

    if (id) {
      const before = people.getStudentById(id);
      const studentCode = str(fd, "studentCode", { max: 40 }) || before!.studentCode;
      const admissionNumber = str(fd, "admissionNumber", { max: 40 }) || before!.admissionNumber;
      if (people.studentCodeExists(studentCode, id)) throw new Error("Student ID / admission number already belongs to another student");
      people.updateStudent(id, {
        studentCode, admissionNumber, firstName, middleName, lastName, gender, dateOfBirth, photoUrl,
        phone, email, address, parentId, admissionDate: before!.admissionDate, status,
      });
      await logAudit({
        user, action: "Updated student record", entity: "Student", entityId: id,
        oldValue: { name: `${before!.firstName} ${before!.lastName}`, status: before!.status },
        newValue: { name: `${firstName} ${lastName}`, status }, ip: await clientIp(),
      });
      revalidatePath("/students");
      revalidatePath(`/students/${id}`);
      return ok("Student updated successfully", id);
    }

    const sessionName = optStr(fd, "sessionName", 20) ?? undefined;
    const codes = people.nextAdmissionNumbers(sessionName);
    const studentCode = str(fd, "studentCode", { max: 40 }) || codes.studentCode;
    const admissionNumber = str(fd, "admissionNumber", { max: 40 }) || codes.admissionNumber;
    if (people.studentCodeExists(studentCode)) throw new Error("Student ID / admission number already exists");

    const createdId = people.createStudent({
      studentCode, admissionNumber, firstName, middleName, lastName, gender, dateOfBirth, photoUrl,
      phone, email, address, parentId, admissionDate, status,
    });

    await notify(await adminUserIds(), {
      title: "New student enrolled",
      message: `${firstName} ${lastName} (${studentCode}) was enrolled.`,
      type: "success",
      link: `/students/${createdId}`,
    });
    await logAudit({
      user, action: "Enrolled new student", entity: "Student", entityId: createdId,
      newValue: { name: `${firstName} ${lastName}`, studentCode }, ip: await clientIp(),
    });
    revalidatePath("/students");
    return ok(`Student ${firstName} ${lastName} enrolled successfully`, createdId);
  } catch (e) {
    return fail(e);
  }
}

export async function setStudentStatusAction(fd: FormData): Promise<ActionResult> {
  try {
    const user = await authUser(ADMIN);
    const id = num(fd, "id", { required: true });
    const status = oneOf(fd, "status", STUDENT_STATUSES, "ACTIVE");
    const before = people.getStudentById(id);
    people.setStudentStatus(id, status);
    await logAudit({
      user, action: `Changed student status to ${status}`, entity: "Student", entityId: id,
      oldValue: before?.status, newValue: status, ip: await clientIp(),
    });
    revalidatePath("/students");
    revalidatePath(`/students/${id}`);
    return ok(`Student status updated to ${status.toLowerCase()}`);
  } catch (e) {
    return fail(e);
  }
}

export async function assignStudentClassAction(fd: FormData): Promise<ActionResult> {
  try {
    const user = await authUser(["SUPER_ADMIN", "ADMIN", "TEACHER"]);
    const studentId = num(fd, "studentId", { required: true });
    const classId = num(fd, "classId", { required: true });
    const sessionId = num(fd, "sessionId", { required: true });
    const termId = num(fd, "termId", { required: true });

    const student = people.getStudentById(studentId);
    const cls = academics.getClassById(classId);
    if (!student || !cls) throw new Error("Student or class not found");

    const enrolled = academics.countStudentsInClass(classId, sessionId, termId);
    const existing = academics.getStudentClassAssignment(studentId, sessionId, termId);
    if (existing && existing.classId === classId) {
      throw new Error(`${student.firstName} is already in ${cls.name} for this term`);
    }
    if (!existing && enrolled >= cls.capacity) {
      throw new Error(`${cls.name} has reached its capacity of ${cls.capacity} students`);
    }

    academics.upsertStudentAssignment(studentId, classId, sessionId, termId, user.name);
    await logAudit({
      user, action: existing ? `Transferred student to ${cls.name}` : `Assigned student to ${cls.name}`,
      entity: "StudentClassAssignment", entityId: studentId,
      oldValue: existing ? `class #${existing.classId}` : null, newValue: `class #${classId}`, ip: await clientIp(),
    });
    revalidatePath("/assignments/students");
    revalidatePath("/students");
    revalidatePath(`/students/${studentId}`);
    return ok(`${student.firstName} ${student.lastName} ${existing ? "moved to" : "assigned to"} ${cls.name} successfully`);
  } catch (e) {
    return fail(e);
  }
}

export async function bulkAssignStudentsAction(fd: FormData): Promise<ActionResult> {
  try {
    const user = await authUser(ADMIN);
    const classId = num(fd, "classId", { required: true });
    const sessionId = num(fd, "sessionId", { required: true });
    const termId = num(fd, "termId", { required: true });
    const studentIds = fd
      .getAll("studentIds")
      .map((v) => Number(v))
      .filter((n) => Number.isFinite(n));
    if (studentIds.length === 0) throw new Error("Select at least one student to assign");

    const cls = academics.getClassById(classId);
    if (!cls) throw new Error("Class not found");

    let created = 0;
    let moved = 0;
    let skipped = 0;
    for (const sid of studentIds) {
      const existing = academics.getStudentClassAssignment(sid, sessionId, termId);
      if (existing && existing.classId === classId) {
        skipped++;
        continue;
      }
      academics.upsertStudentAssignment(sid, classId, sessionId, termId, user.name);
      if (existing) moved++;
      else created++;
    }
    const total = created + moved;
    await logAudit({
      user, action: `Bulk assigned ${total} student(s) to ${cls.name}`, entity: "Class", entityId: classId,
      newValue: { created, moved, skipped }, ip: await clientIp(),
    });
    revalidatePath("/assignments/students");
    revalidatePath("/students");
    if (total === 0) return ok("All selected students were already in this class for the selected term");
    return ok(`${total} student(s) successfully assigned to ${cls.name}`);
  } catch (e) {
    return fail(e);
  }
}
