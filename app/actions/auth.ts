"use server";

import * as core from "@/lib/repo/core";
import { createSession, verifyPassword, clientIp } from "@/lib/auth";
import { str, fail, ok, logAudit, type ActionResult } from "@/lib/server-utils";

const attempts = new Map<string, { count: number; until: number }>();

function throttleCheck(key: string): void {
  const rec = attempts.get(key);
  if (rec && rec.until > Date.now() && rec.count >= 8) {
    throw new Error("Too many failed attempts. Please wait a minute and try again.");
  }
}

function throttleFail(key: string): void {
  const rec = attempts.get(key);
  if (rec && rec.until > Date.now()) {
    rec.count += 1;
  } else {
    attempts.set(key, { count: 1, until: Date.now() + 60_000 });
  }
}

export async function loginAction(fd: FormData): Promise<ActionResult> {
  try {
    const identifier = str(fd, "identifier", { required: true, max: 120 }).toLowerCase();
    const password = str(fd, "password", { required: true, max: 200 });
    throttleCheck(identifier);

    const user = core.getUserByIdentifier(identifier);
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      throttleFail(identifier);
      throw new Error("Invalid email/username or password");
    }
    if (user.status !== "ACTIVE") throw new Error("This account has been suspended. Contact the administrator.");

    await createSession(user.id);
    core.touchLastLogin(user.id);
    await logAudit({
      user: { id: user.id, name: user.name },
      action: "User logged in",
      entity: "User",
      entityId: user.id,
      ip: await clientIp(),
    });
    attempts.delete(identifier);
    return ok("Login successful");
  } catch (e) {
    return fail(e);
  }
}
