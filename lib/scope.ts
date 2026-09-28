import "server-only";
import type { AppUser } from "./auth";
import { isAdmin } from "./auth";
import * as academics from "@/lib/repo/academics";
import * as people from "@/lib/repo/people";
import type { ClassListRow } from "./repo/types";

export type CurrentAcademic = {
  session: academics.SessionRow;
  term: academics.TermRow;
};

export async function getCurrentAcademic(): Promise<CurrentAcademic | null> {
  return academics.getCurrentAcademic();
}

export async function requireCurrentAcademic(): Promise<CurrentAcademic> {
  const cur = await getCurrentAcademic();
  if (!cur) {
    throw new Error("No academic session configured. Create a session in Settings first.");
  }
  return cur;
}

// ---------------------------------------------------------------------------
// Role scoping
// ---------------------------------------------------------------------------

export type Scope = {
  /** null = unrestricted (admin) */
  classIds: number[] | null;
  studentIds: number[] | null;
  teacherId: number | null;
};

export async function getScope(user: AppUser): Promise<Scope> {
  if (isAdmin(user)) return { classIds: null, studentIds: null, teacherId: null };
  if (user.role === "TEACHER" && user.teacherId) {
    const current = await getCurrentAcademic();
    const classIds = current ? academics.teacherClassIds(user.teacherId, current.session.id) : [];
    const studentIds = classIds.length ? people.studentIdsForClasses(classIds, current!.session.id) : [];
    return { classIds, studentIds, teacherId: user.teacherId };
  }
  if (user.role === "PARENT" && user.parentId) {
    const students = people.studentsForParent(user.parentId);
    return { classIds: null, studentIds: students.map((s) => s.id), teacherId: null };
  }
  return { classIds: [], studentIds: [], teacherId: null };
}

export async function getClassesForUser(user: AppUser): Promise<ClassListRow[]> {
  const scope = await getScope(user);
  const classes = academics.listClasses({ status: "ACTIVE" });
  if (scope.classIds === null) return classes;
  return classes.filter((c) => scope.classIds!.includes(c.id));
}
