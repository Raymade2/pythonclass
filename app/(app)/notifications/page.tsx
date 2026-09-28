import Link from "next/link";
import { requireUser } from "@/lib/auth";
import * as core from "@/lib/repo/core";
import { formatDateTime } from "@/lib/format";
import { Card, PageHeader, EmptyState } from "@/components/ui";
import { Bell, CheckCheck, Info, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { MarkAllReadButton } from "./mark-all-read-button";
import { markAllNotificationsReadAction } from "@/app/actions/settings";

export const metadata = { title: "Notifications" };

const TYPE_STYLES: Record<string, { icon: React.ReactNode; ring: string }> = {
  success: { icon: <CheckCircle2 className="h-5 w-5 text-emerald-500" />, ring: "bg-emerald-50" },
  warning: { icon: <AlertTriangle className="h-5 w-5 text-amber-500" />, ring: "bg-amber-50" },
  danger: { icon: <XCircle className="h-5 w-5 text-red-500" />, ring: "bg-red-50" },
  info: { icon: <Info className="h-5 w-5 text-brand-500" />, ring: "bg-brand-50" },
};

export default async function NotificationsPage() {
  const user = await requireUser();
  const notifications = core.listNotifications(user.id, 100);
  const unread = notifications.filter((n) => !n.readStatus).length;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader title="Notifications" subtitle={`${unread} unread of ${notifications.length}`}>
        {unread > 0 && <MarkAllReadButton action={markAllNotificationsReadAction} />}
      </PageHeader>

      <Card>
        {notifications.length === 0 ? (
          <EmptyState
            icon={<Bell className="h-6 w-6" />}
            title="No notifications yet"
            message="Payment confirmations, new invoices, enrolments and reminders will appear here."
          />
        ) : (
          <ul className="divide-y divide-slate-100">
            {notifications.map((n) => {
              const style = TYPE_STYLES[n.type] ?? TYPE_STYLES.info;
              return (
                <li key={n.id} className={`flex items-start gap-3 p-4 ${!n.readStatus ? "bg-brand-50/30" : ""}`}>
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${style.ring}`}>
                    {style.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-slate-800">{n.title}</p>
                      {!n.readStatus && (
                        <span className="rounded-full bg-brand-600 px-1.5 py-0.5 text-[9px] font-bold uppercase text-white">New</span>
                      )}
                    </div>
                    <p className="mt-0.5 text-sm text-slate-600">{n.message}</p>
                    <div className="mt-1.5 flex items-center gap-3">
                      <p className="text-[11px] text-slate-400">{formatDateTime(n.createdAt)}</p>
                      {n.link && (
                        <Link href={n.link} className="text-[11px] font-bold text-brand-600 hover:underline">
                          View →
                        </Link>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <p className="flex items-center justify-center gap-2 text-center text-xs text-slate-400">
        <Bell className="h-3.5 w-3.5" /> Email, SMS and WhatsApp delivery channels are prepared for future integration.
      </p>
    </div>
  );
}
