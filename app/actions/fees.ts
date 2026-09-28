"use server";

import { revalidatePath } from "next/cache";
import { authUser, clientIp } from "@/lib/auth";
import * as finance from "@/lib/repo/finance";
import { str, optStr, num, optNum, optDateStr, bool, fail, ok, logAudit, type ActionResult } from "@/lib/server-utils";

const ADMIN = ["SUPER_ADMIN", "ADMIN"];

// ---------------------------------------------------------------------------
// Fee categories
// ---------------------------------------------------------------------------

export async function saveFeeCategoryAction(fd: FormData): Promise<ActionResult> {
  try {
    const user = await authUser(ADMIN);
    const name = str(fd, "name", { required: true, max: 80 });
    const description = optStr(fd, "description", 300);
    const id = finance.listFeeCategories().find((c) => c.name.toLowerCase() === name.toLowerCase());
    if (id) throw new Error("A fee category with this name already exists");
    const createdId = finance.ensureFeeCategory(name, description);
    await logAudit({ user, action: "Created fee category", entity: "FeeCategory", entityId: createdId, newValue: { name }, ip: await clientIp() });
    revalidatePath("/fees");
    return ok("Fee category created", createdId);
  } catch (e) {
    return fail(e);
  }
}

export async function deleteFeeCategoryAction(fd: FormData): Promise<ActionResult> {
  try {
    const user = await authUser(ADMIN);
    const id = num(fd, "id", { required: true });
    const cat = finance.listFeeCategories().find((c) => c.id === id);
    if (cat && cat.feeCount > 0) throw new Error(`Cannot delete: ${cat.feeCount} fee item(s) use this category`);
    finance.deleteFeeCategory(id);
    await logAudit({ user, action: "Deleted fee category", entity: "FeeCategory", entityId: id, oldValue: cat?.name, ip: await clientIp() });
    revalidatePath("/fees");
    return ok("Fee category deleted");
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------------------
// School fees
// ---------------------------------------------------------------------------

export async function saveFeeAction(fd: FormData): Promise<ActionResult> {
  try {
    const user = await authUser(ADMIN);
    const id = optNum(fd, "id");
    const name = str(fd, "name", { required: true, max: 100 });
    const categoryName = str(fd, "categoryName", { required: true, max: 80 });
    const amount = num(fd, "amount", { required: true, min: 1, max: 100_000_000 });
    const classId = num(fd, "classId", { required: true });
    const sessionId = num(fd, "sessionId", { required: true });
    const termId = num(fd, "termId", { required: true });
    const dueDate = optDateStr(fd, "dueDate");
    const description = optStr(fd, "description", 300);
    const mandatory = bool(fd, "mandatory");
    const status = str(fd, "status", { max: 20 }) || "ACTIVE";

    const categoryId = finance.ensureFeeCategory(categoryName);
    const data = { name, categoryId, amount, classId, sessionId, termId, dueDate, description, mandatory, status };

    if (id) {
      finance.updateFee(id, data);
      await logAudit({ user, action: "Updated school fee item", entity: "Fee", entityId: id, newValue: { name, amount }, ip: await clientIp() });
      revalidatePath("/fees");
      return ok("Fee item updated successfully", id);
    }
    const dup = finance.listFees({ sessionId, termId, classId }).find((f) => f.name.toLowerCase() === name.toLowerCase());
    if (dup) throw new Error("This class already has a fee item with the same name for the selected session/term");

    const createdId = finance.createFee(data);
    await logAudit({ user, action: "Created school fee item", entity: "Fee", entityId: createdId, newValue: { name, amount, classId }, ip: await clientIp() });
    revalidatePath("/fees");
    return ok(`Fee "${name}" created successfully`, createdId);
  } catch (e) {
    return fail(e);
  }
}

export async function deleteFeeAction(fd: FormData): Promise<ActionResult> {
  try {
    const user = await authUser(ADMIN);
    const id = num(fd, "id", { required: true });
    const fee = finance.getFeeById(id);
    finance.deleteFee(id);
    await logAudit({ user, action: "Deleted school fee item", entity: "Fee", entityId: id, oldValue: fee ? { name: fee.name, amount: fee.amount } : null, ip: await clientIp() });
    revalidatePath("/fees");
    return ok("Fee item deleted");
  } catch (e) {
    return fail(e);
  }
}
