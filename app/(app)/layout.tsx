import { requireUser } from "@/lib/auth";
import { countUnread } from "@/lib/repo/core";
import { getSchool } from "@/lib/repo/core";
import { getCurrentAcademic } from "@/lib/scope";
import { AppShell } from "@/components/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [school, unread, academic] = await Promise.all([getSchool(), countUnread(user.id), getCurrentAcademic()]);

  return (
    <AppShell
      user={{ id: user.id, name: user.name, role: user.role, email: user.email }}
      schoolName={school.name}
      schoolShort={school.shortName}
      unreadCount={unread}
      currentSession={academic?.session.name ?? "Not set"}
      currentTerm={academic?.term.name ?? "Not set"}
    >
      {children}
    </AppShell>
  );
}
