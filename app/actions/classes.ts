"use server";

import { revalidatePath } from "next/cache";
import { authUser, clientIp } from "@/lib/auth";
import * as academics from "@/lib/repo/academics";
import { str, optStr, num, optNum, bool, fail, ok, logAudit, type ActionResult } from "@/lib/server-utils";

const ADMIN = ["SUPER_ADMIN", "ADMIN"];

// ---------------------------------------------------------------------------
// Class groups
// ---------------------------------------------------------------------------

export async function saveClassGroupAction(fd: FormData): Promise<ActionResult> {
  try {
    const user = await authUser(ADMIN);
    const id = optNum(fd, "id");
    const name = str(fd, "name", { required: true, max: 80 });
    const description = optStr(fd, "description", 400);
    const status = str(fd, "status", { max: 20 }) || "ACTIVE";

    const existing = academics.getClassGroupByName(name);
    if (existing && existing.id !== id) throw new Error("A class group with this name already exists");

    if (id) {
      academics.updateClassGroup(id, { name, description, status });
      await logAudit({ user, action: "Updated class group", entity: "ClassGroup", entityId: id, newValue: { name, status }, ip: await clientIp() });
      revalidatePath("/class-groups");
      return ok("Class group updated successfully");
    }
    const createdId = academics.createClassGroup({ name, description });
    await logAudit({ user, action: "Created class group", entity: "ClassGroup", entityId: createdId, newValue: { name }, ip: await clientIp() });
    revalidatePath("/class-groups");
    return ok("Class group created successfully", createdId);
  } catch (e) {
    return fail(e);
  }
}

export async function deleteClassGroupAction(fd: FormData): Promise<ActionResult> {
  try {
    const user = await authUser(["SUPER_ADMIN"]);
    const id = num(fd, "id", { required: true });
    const inUse = academics.countClassesInGroup(id);
    if (inUse > 0) throw new Error(`Cannot delete: ${inUse} class(es) belong to this group. Reassign them first.`);
    academics.deleteClassGroup(id);
    await logAudit({ user, action: "Deleted class group", entity: "ClassGroup", entityId: id, ip: await clientIp() });
    revalidatePath("/class-groups");
    return ok("Class group deleted");
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------------------
// Classes
// ---------------------------------------------------------------------------

export async function saveClassAction(fd: FormData): Promise<ActionResult> {
  try {
    const user = await authUser(ADMIN);
    const id = optNum(fd, "id");
    const name = str(fd, "name", { required: true, max: 80 });
    const code = str(fd, "code", { required: true, max: 20 }).toUpperCase();
    const section = optStr(fd, "section", 40);
    const classGroupId = optNum(fd, "classGroupId");
    const sessionId = optNum(fd, "sessionId");
    const classTeacherId = optNum(fd, "classTeacherId");
    const capacity = num(fd, "capacity", { min: 1, max: 500 }) || 30;
    const status = str(fd, "status", { max: 20 }) || "ACTIVE";

    const dupName = academics.getClassByName(name);
    if (dupName && dupName.id !== id) throw new Error("A class with this name already exists");
    const dupCode = academics.getClassByCode(code);
    if (dupCode && dupCode.id !== id) throw new Error("A class with this code already exists");

    if (id) {
      academics.updateClass(id, { name, code, section, classGroupId, sessionId, classTeacherId, capacity, status });
      await logAudit({ user, action: "Updated class", entity: "Class", entityId: id, newValue: { name, code, status }, ip: await clientIp() });
      revalidatePath("/classes");
      return ok("Class updated successfully", id);
    }
    const createdId = academics.createClass({ name, code, section, classGroupId, sessionId, classTeacherId, capacity });
    await logAudit({ user, action: "Created class", entity: "Class", entityId: createdId, newValue: { name, code, capacity }, ip: await clientIp() });
    revalidatePath("/classes");
    return ok("Class created successfully", createdId);
  } catch (e) {
    return fail(e);
  }
}

export async function deleteClassAction(fd: FormData): Promise<ActionResult> {
  try {
    const user = await authUser(ADMIN);
    const id = num(fd, "id", { required: true });
    const hard = bool(fd, "hard");
    const deps = academics.classDependencyCounts(id);
    if (deps.students + deps.fees + deps.teachers > 0) {
      if (hard) {
        throw new Error("This class has student assignments, fees or teacher assignments. Deactivate it instead.");
      }
      academics.deactivateClass(id);
      await logAudit({ user, action: "Deactivated class (has existing records)", entity: "Class", entityId: id, ip: await clientIp() });
      revalidatePath("/classes");
      return ok("Class has existing records — it was deactivated instead of deleted");
    }
    academics.deleteClass(id);
    await logAudit({ user, action: "Deleted class", entity: "Class", entityId: id, ip: await clientIp() });
    revalidatePath("/classes");
    return ok("Class deleted successfully");
  } catch (e) {
    return fail(e);
  }
}
