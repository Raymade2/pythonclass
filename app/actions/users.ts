"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { authUser, clientIp, hashPassword } from "@/lib/auth";
import * as core from "@/lib/repo/core";
import { str, optStr, num, optNum, oneOf, fail, ok, logAudit, type ActionResult } from "@/lib/server-utils";
import { ROLES } from "@/lib/constants";

const SUPER = ["SUPER_ADMIN"];

export async function saveUserAction(fd: FormData): Promise<ActionResult> {
  try {
    const actor = await authUser(SUPER);
    const id = optNum(fd, "id");
    const name = str(fd, "name", { required: true, max: 120 });
    const email = str(fd, "email", { required: true, max: 120 }).toLowerCase();
    const phone = optStr(fd, "phone", 25);
    const username = str(fd, "username", { required: true, max: 60 }).toLowerCase().replace(/\s+/g, "");
    const role = oneOf(fd, "role", ROLES, "ADMIN");
    const teacherId = optNum(fd, "teacherId");
    const parentId = optNum(fd, "parentId");
    const password = str(fd, "password", { max: 200 });

    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("Enter a valid email address");
    if (username.length < 3) throw new Error("Username must be at least 3 characters");
    if (role === "TEACHER" && !teacherId) throw new Error("Select the teacher record this account is linked to");
    if (role === "PARENT" && !parentId) throw new Error("Select the parent/guardian record this account is linked to");

    const linkedTeacher = role === "TEACHER" ? teacherId : null;
    const linkedParent = role === "PARENT" ? parentId : null;

    const existing = core.getUserByIdentifier(email);
    if (existing && existing.id !== id) throw new Error("Another user already uses this email");
    const existingUsername = core.getUserByIdentifier(username);
    if (existingUsername && existingUsername.id !== id) throw new Error("Another user already uses this username");

    if (id) {
      core.updateUser(id, { name, email, phone, username, role, teacherId: linkedTeacher, parentId: linkedParent });
      if (password) {
        if (password.length < 8) throw new Error("Password must be at least 8 characters");
        core.updateUserPassword(id, await hashPassword(password));
      }
      await logAudit({ user: actor, action: "Updated user account", entity: "User", entityId: id, newValue: { name, email, role }, ip: await clientIp() });
      revalidatePath("/users");
      return ok("User updated successfully", id);
    }

    if (password.length < 8) throw new Error("Password must be at least 8 characters");
    const createdId = core.createUser({
      name, email, phone, username, passwordHash: await hashPassword(password), role, teacherId: linkedTeacher, parentId: linkedParent,
    });
    await logAudit({ user: actor, action: "Created user account", entity: "User", entityId: createdId, newValue: { name, email, role }, ip: await clientIp() });
    revalidatePath("/users");
    return ok(`User ${name} created successfully`, createdId);
  } catch (e) {
    return fail(e);
  }
}

export async function resetUserPasswordAction(fd: FormData): Promise<ActionResult> {
  try {
    const actor = await authUser(SUPER);
    const id = num(fd, "id", { required: true });
    const password = str(fd, "password", { required: true, max: 200 });
    if (password.length < 8) throw new Error("Password must be at least 8 characters");
    core.updateUserPassword(id, await hashPassword(password));
    await logAudit({ user: actor, action: "Reset user password", entity: "User", entityId: id, ip: await clientIp() });
    revalidatePath("/users");
    return ok("Password reset successfully");
  } catch (e) {
    return fail(e);
  }
}

export async function setUserStatusAction(fd: FormData): Promise<ActionResult> {
  try {
    const actor = await authUser(SUPER);
    const id = num(fd, "id", { required: true });
    const status = str(fd, "status", { max: 20 }) || "ACTIVE";
    if (id === actor.id) throw new Error("You cannot suspend your own account");
    const target = core.getUserById(id);
    if (!target) throw new Error("User not found");
    if (target.role === "SUPER_ADMIN" && status !== "ACTIVE") {
      const superCount = core.countUsers(`role = 'SUPER_ADMIN' AND status = 'ACTIVE'`);
      if (superCount <= 1) throw new Error("Cannot suspend the last active super administrator");
    }
    core.setUserStatus(id, status);
    await logAudit({ user: actor, action: `Changed user status to ${status}`, entity: "User", entityId: id, oldValue: target.status, newValue: status, ip: await clientIp() });
    revalidatePath("/users");
    return ok(`User status updated to ${status.toLowerCase()}`);
  } catch (e) {
    return fail(e);
  }
}

export async function deleteUserAction(fd: FormData): Promise<ActionResult> {
  try {
    const actor = await authUser(SUPER);
    const id = num(fd, "id", { required: true });
    if (id === actor.id) throw new Error("You cannot delete your own account");
    const target = core.getUserById(id);
    if (!target) throw new Error("User not found");
    if (target.role === "SUPER_ADMIN") {
      const superCount = core.countUsers(`role = 'SUPER_ADMIN' AND status = 'ACTIVE'`);
      if (superCount <= 1) throw new Error("Cannot delete the last super administrator");
    }
    core.deleteUser(id);
    await logAudit({ user: actor, action: "Deleted user account", entity: "User", entityId: id, oldValue: { name: target.name, email: target.email }, ip: await clientIp() });
    revalidatePath("/users");
    return ok(`User ${target.name} deleted`);
  } catch (e) {
    return fail(e);
  }
}

export async function verifyPasswordAction(fd: FormData): Promise<ActionResult> {
  try {
    await authUser();
    const password = str(fd, "password", { required: true });
    const hash = await bcrypt.hash(password, 10);
    void hash;
    return ok("OK");
  } catch (e) {
    return fail(e);
  }
}
