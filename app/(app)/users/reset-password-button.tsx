"use client";

import { useState } from "react";
import { KeyRound } from "lucide-react";
import { Modal } from "@/components/modal";
import { DataForm } from "@/components/data-form";
import type { ActionResult } from "@/lib/server-utils";

export function ResetPasswordButton({
  userId,
  userName,
  action,
}: {
  userId: number;
  userName: string;
  action: (fd: FormData) => Promise<ActionResult>;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Reset password"
        className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:border-brand-300 hover:text-brand-700"
      >
        <KeyRound className="h-3.5 w-3.5" />
      </button>
      <Modal open={open} title={`Reset Password — ${userName}`} onClose={() => setOpen(false)}>
        <DataForm
          fields={[{ name: "password", label: "New Password", type: "password", required: true, help: "Minimum 8 characters" }]}
          action={action}
          hidden={{ id: userId }}
          submitLabel="Reset Password"
          onCancel={() => setOpen(false)}
          onDone={() => setOpen(false)}
        />
      </Modal>
    </>
  );
}
