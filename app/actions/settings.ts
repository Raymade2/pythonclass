"use server";

import { revalidatePath } from "next/cache";
import { authUser, clientIp } from "@/lib/auth";
import * as core from "@/lib/repo/core";
import * as academics from "@/lib/repo/academics";
import { str, optStr, num, optNum, optDateStr, fail, ok, logAudit, type ActionResult } from "@/lib/server-utils";

const ADMIN = ["SUPER_ADMIN", "ADMIN"];
const SUPER = ["SUPER_ADMIN"];

// ---------------------------------------------------------------------------
// School profile
// ---------------------------------------------------------------------------

export async function updateSchoolAction(fd: FormData): Promise<ActionResult> {
  try {
    const user = await authUser(SUPER);
    const name = str(fd, "name", { required: true, max: 150 });
    const address = str(fd, "address", { required: true, max: 300 });
    const phone = str(fd, "phone", { required: true, max: 40 });
    const email = str(fd, "email", { required: true, max: 120 });
    const motto = optStr(fd, "motto", 150) ?? "";
    const shortName = optStr(fd, "shortName", 20) ?? "SFGS";
    const logoUrl = optStr(fd, "logoUrl", 500);

    const before = core.getSchool();
    core.updateSchool({ name, address, phone, email, motto, shortName, logoUrl });
    await logAudit({ user, action: "Updated school profile", entity: "School", entityId: 1, oldValue: { name: before.name }, newValue: { name }, ip: await clientIp() });
    revalidatePath("/settings");
    revalidatePath("/dashboard");
    return ok("School profile updated successfully");
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------------------
// Sessions & terms
// ---------------------------------------------------------------------------

export async function createSessionAction(fd: FormData): Promise<ActionResult> {
  try {
    const user = await authUser(ADMIN);
    const name = str(fd, "name", { required: true, max: 20 });
    if (!/^\d{4}\/\d{4}$/.test(name)) throw new Error("Session name must look like 2026/2027");
    const [startYear, endYear] = name.split("/").map(Number);
    if (endYear !== startYear + 1) throw new Error("Session end year must be one year after the start year");
    if (academics.getSessionByName(name)) throw new Error("This session already exists");
    const startDate = optDateStr(fd, "startDate");
    const endDate = optDateStr(fd, "endDate");

    const id = academics.createSession({ name, startDate, endDate });
    await logAudit({ user, action: `Created academic session ${name}`, entity: "AcademicSession", entityId: id, newValue: { name }, ip: await clientIp() });
    revalidatePath("/settings");
    return ok(`Session ${name} created with its three terms`, id);
  } catch (e) {
    return fail(e);
  }
}

export async function updateSessionAction(fd: FormData): Promise<ActionResult> {
  try {
    const user = await authUser(ADMIN);
    const id = num(fd, "id", { required: true });
    const name = str(fd, "name", { required: true, max: 20 });
    if (!/^\d{4}\/\d{4}$/.test(name)) throw new Error("Session name must look like 2026/2027");
    const dup = academics.getSessionByName(name);
    if (dup && dup.id !== id) throw new Error("Another session with this name exists");
    const startDate = optDateStr(fd, "startDate");
    const endDate = optDateStr(fd, "endDate");
    const status = str(fd, "status", { max: 20 }) || "ACTIVE";
    academics.updateSession(id, { name, startDate, endDate, status });
    await logAudit({ user, action: `Updated academic session ${name}`, entity: "AcademicSession", entityId: id, newValue: { name, status }, ip: await clientIp() });
    revalidatePath("/settings");
    return ok("Session updated successfully");
  } catch (e) {
    return fail(e);
  }
}

export async function setCurrentSessionTermAction(fd: FormData): Promise<ActionResult> {
  try {
    const user = await authUser(ADMIN);
    const sessionId = num(fd, "sessionId", { required: true });
    const termId = num(fd, "termId", { required: true });
    const session = academics.getSessionById(sessionId);
    const term = academics.getTermById(termId);
    if (!session || !term || term.sessionId !== sessionId) throw new Error("Invalid session or term");
    academics.setCurrentSessionTerm(sessionId, termId);
    await logAudit({ user, action: `Set current session/term to ${session.name} · ${term.name}`, entity: "AcademicSession", entityId: sessionId, newValue: { term: term.name }, ip: await clientIp() });
    revalidatePath("/settings");
    revalidatePath("/dashboard");
    return ok(`Current session set to ${session.name} — ${term.name}`);
  } catch (e) {
    return fail(e);
  }
}

export async function updateTermAction(fd: FormData): Promise<ActionResult> {
  try {
    const user = await authUser(ADMIN);
    const id = num(fd, "id", { required: true });
    const name = str(fd, "name", { required: true, max: 30 });
    const startDate = optDateStr(fd, "startDate");
    const endDate = optDateStr(fd, "endDate");
    const status = str(fd, "status", { max: 20 }) || "ACTIVE";
    academics.updateTerm(id, { name, startDate, endDate, status });
    await logAudit({ user, action: `Updated term ${name}`, entity: "Term", entityId: id, newValue: { name, status }, ip: await clientIp() });
    revalidatePath("/settings");
    return ok("Term updated successfully");
  } catch (e) {
    return fail(e);
  }
}

export async function deleteSessionAction(fd: FormData): Promise<ActionResult> {
  try {
    const user = await authUser(SUPER);
    const id = num(fd, "id", { required: true });
    const session = academics.getSessionById(id);
    if (!session) throw new Error("Session not found");
    if (session.isCurrent) throw new Error("Cannot delete the current session");
    if (academics.sessionHasData(id)) throw new Error("This session has invoices/records and cannot be deleted");
    academics.deleteSession(id);
    await logAudit({ user, action: `Deleted session ${session.name}`, entity: "AcademicSession", entityId: id, oldValue: { name: session.name }, ip: await clientIp() });
    revalidatePath("/settings");
    return ok(`Session ${session.name} deleted`);
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export async function markAllNotificationsReadAction(): Promise<ActionResult> {
  try {
    const user = await authUser();
    core.markAllNotificationsRead(user.id);
    revalidatePath("/notifications");
    return ok("All notifications marked as read");
  } catch (e) {
    return fail(e);
  }
}

export async function markNotificationReadAction(fd: FormData): Promise<ActionResult> {
  try {
    const user = await authUser();
    const id = num(fd, "id", { required: true });
    core.markNotificationRead(id, user.id);
    revalidatePath("/notifications");
    return ok("Notification marked as read");
  } catch (e) {
    return fail(e);
  }
}
