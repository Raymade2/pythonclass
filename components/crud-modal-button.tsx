"use client";

import { useState } from "react";
import { Plus, Pencil } from "lucide-react";
import { Modal } from "@/components/modal";
import { DataForm, type FormField } from "@/components/data-form";
import type { ActionResult } from "@/lib/server-utils";

/**
 * Button that opens a modal containing a DataForm bound to a server action.
 * Used for "Add …" and per-row "Edit" dialogs.
 */
export function CrudModalButton({
  label,
  title,
  subtitle,
  fields,
  action,
  hidden,
  submitLabel = "Save",
  variant = "primary",
  icon,
  onDoneRedirect,
}: {
  label: string;
  title: string;
  subtitle?: string;
  fields: FormField[];
  action: (fd: FormData) => Promise<ActionResult>;
  hidden?: Record<string, string | number>;
  submitLabel?: string;
  variant?: "primary" | "ghost" | "danger";
  icon?: "plus" | "pencil" | "none";
  onDoneRedirect?: string;
}) {
  const [open, setOpen] = useState(false);

  const variants: Record<string, string> = {
    primary:
      "inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-brand-700",
    ghost:
      "inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:border-brand-300 hover:text-brand-700",
    danger:
      "inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50",
  };

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={variants[variant]}>
        {icon === "pencil" ? <Pencil className="h-3.5 w-3.5" /> : icon === "plus" || icon === undefined ? <Plus className="h-3.5 w-3.5" /> : null}
        {label}
      </button>
      <Modal open={open} title={title} subtitle={subtitle} onClose={() => setOpen(false)} wide>
        <DataForm
          fields={fields}
          action={action}
          hidden={hidden}
          submitLabel={submitLabel}
          onCancel={() => setOpen(false)}
          onDone={(res) => {
            if (res.ok && !res.message.toLowerCase().includes("already")) setOpen(false);
          }}
        />
      </Modal>
    </>
  );
}
