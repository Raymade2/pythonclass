import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import * as core from "@/lib/repo/core";
import type { Role } from "./constants";

export const SESSION_COOKIE = "sfgs_session";
const SESSION_DAYS = 7;

export type AppUser = {
  id: number;
  name: string;
  email: string;
  username: string;
  role: Role;
  phone: string | null;
  teacherId: number | null;
  parentId: number | null;
  teacher: { id: number; firstName: string; lastName: string } | null;
  parent: { id: number; name: string; phone: string } | null;
};

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export async function createSession(userId: number): Promise<void> {
  const id = randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  core.createAuthSession(id, userId, expiresAt);
  const jar = cookies();
  jar.set(SESSION_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession(): Promise<void> {
  const jar = cookies();
  const id = jar.get(SESSION_COOKIE)?.value;
  if (id) {
    core.deleteAuthSession(id);
  }
  jar.delete(SESSION_COOKIE);
}

export const getCurrentUser = cache(async (): Promise<AppUser | null> => {
  const jar = cookies();
  const sessionId = jar.get(SESSION_COOKIE)?.value;
  if (!sessionId) return null;
  const user = core.getAuthSession(sessionId);
  if (!user) return null;
  if (user.status !== "ACTIVE") return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    username: user.username,
    phone: user.phone,
    role: user.role as Role,
    teacherId: user.teacherId,
    parentId: user.parentId,
    teacher: user.teacher,
    parent: user.parent,
  };
});

/**
 * Require an authenticated user (optionally with one of the given roles).
 * Redirects to /login or /dashboard?denied=1 when access is not allowed.
 */
export async function requireUser(roles?: Role[]): Promise<AppUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (roles && roles.length > 0 && !roles.includes(user.role)) {
    redirect("/dashboard?denied=1");
  }
  return user;
}

/** For server actions: throws instead of redirecting. */
export async function authUser(roles?: Role[]): Promise<AppUser> {
  const user = await getCurrentUser();
  if (!user) throw new Error("You must be signed in to do that");
  if (roles && roles.length > 0 && !roles.includes(user.role)) {
    throw new Error("You do not have permission to perform this action");
  }
  return user;
}

export function canManageFinances(user: AppUser): boolean {
  return user.role === "SUPER_ADMIN" || user.role === "ADMIN";
}

export function isAdmin(user: AppUser): boolean {
  return user.role === "SUPER_ADMIN" || user.role === "ADMIN";
}

export async function clientIp(): Promise<string> {
  const h = headers();
  return (
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    "unknown"
  );
}
