"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import * as Icons from "lucide-react";
import { navForRole } from "@/lib/nav";
import { roleLabel } from "@/lib/constants";
import { Avatar } from "@/components/badges";
import { SchoolLogo } from "@/components/school-logo";

export type ShellUser = {
  id: number;
  name: string;
  role: string;
  email: string;
};

function LucideIcon({ name, className }: { name: string; className?: string }) {
  const Icon = (Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[name] ?? Icons.Circle;
  return <Icon className={className} />;
}

export function AppShell({
  user,
  schoolName,
  schoolShort,
  unreadCount,
  currentSession,
  currentTerm,
  children,
}: {
  user: ShellUser;
  schoolName: string;
  schoolShort: string;
  unreadCount: number;
  currentSession: string;
  currentTerm: string;
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const userMenuRef = useRef<HTMLDivElement>(null);
  const sections = navForRole(user.role);

  // Close mobile sidebar on navigation
  useEffect(() => {
    setSidebarOpen(false);
    setUserMenuOpen(false);
  }, [pathname]);

  // Close user dropdown on outside click
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const sidebar = (
    <div className="flex h-full flex-col bg-gradient-to-b from-brand-950 via-brand-900 to-[#101c4d] text-white">
      <div className="flex items-center gap-3 px-5 pb-5 pt-6">
        <SchoolLogo size={40} />
        <div className="leading-tight">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-gold-300">{schoolShort}</p>
          <p className="text-sm font-bold">Sure Foundation Group of Schools</p>
        </div>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-6">
        {sections.map((section) => (
          <div key={section.title}>
            <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-widest text-white/40">
              {section.title}
            </p>
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const active = pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors ${
                        active
                          ? "bg-white/12 text-white shadow-inner ring-1 ring-white/10"
                          : "text-white/70 hover:bg-white/8 hover:text-white"
                      }`}
                    >
                      <LucideIcon
                        name={item.icon}
                        className={`h-[17px] w-[17px] ${active ? "text-gold-300" : "text-white/50 group-hover:text-white/80"}`}
                      />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
        <div>
          <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-widest text-white/40">Account</p>
          <button
            onClick={logout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium text-white/70 transition-colors hover:bg-red-500/15 hover:text-white"
          >
            <Icons.LogOut className="h-[17px] w-[17px] text-white/50" />
            Logout
          </button>
        </div>
      </nav>

      <div className="border-t border-white/10 px-5 py-4">
        <p className="text-[11px] text-white/50">
          Session: <span className="font-semibold text-white/80">{currentSession}</span>
        </p>
        <p className="text-[11px] text-white/50">
          Term: <span className="font-semibold text-white/80">{currentTerm}</span>
        </p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen">
      {/* Desktop sidebar */}
      <aside className="no-print fixed inset-y-0 left-0 z-30 hidden w-[268px] lg:block">{sidebar}</aside>

      {/* Mobile drawer */}
      {sidebarOpen && (
        <div className="no-print fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-[280px] max-w-[85vw] animate-fade-in shadow-2xl">{sidebar}</aside>
        </div>
      )}

      <div className="lg:pl-[268px]">
        {/* Header */}
        <header className="no-print sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur sm:px-6">
          <button
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
          >
            <Icons.Menu className="h-5 w-5" />
          </button>

          <form action="/search" className="relative hidden max-w-md flex-1 sm:block">
            <Icons.Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              name="q"
              placeholder="Search students, teachers, payments, receipts…"
              className="w-full rounded-full border border-slate-200 bg-slate-50 py-2 pl-9 pr-4 text-sm outline-none transition focus:border-brand-400 focus:bg-white focus:ring-2 focus:ring-brand-100"
            />
          </form>

          <div className="ml-auto flex items-center gap-2">
            <Link
              href="/notifications"
              className="relative rounded-full p-2 text-slate-600 transition hover:bg-slate-100"
              aria-label="Notifications"
            >
              <Icons.Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4.5 min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </Link>

            <div className="relative" ref={userMenuRef}>
              <button
                onClick={() => setUserMenuOpen((v) => !v)}
                className="flex items-center gap-2.5 rounded-full py-1 pl-1 pr-2 transition hover:bg-slate-100"
              >
                <Avatar name={user.name} size="md" />
                <span className="hidden text-left leading-tight md:block">
                  <span className="block max-w-[160px] truncate text-[13px] font-semibold text-slate-800">{user.name}</span>
                  <span className="block text-[11px] text-slate-500">{roleLabel(user.role)}</span>
                </span>
                <Icons.ChevronDown className="hidden h-4 w-4 text-slate-400 md:block" />
              </button>
              {userMenuOpen && (
                <div className="animate-fade-in absolute right-0 mt-2 w-60 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                  <div className="border-b border-slate-100 px-4 py-3">
                    <p className="truncate text-sm font-semibold text-slate-800">{user.name}</p>
                    <p className="truncate text-xs text-slate-500">{user.email}</p>
                    <p className="mt-1 inline-flex rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-700">
                      {roleLabel(user.role)}
                    </p>
                  </div>
                  <Link href="/notifications" className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 md:hidden">
                    <Icons.Bell className="h-4 w-4" /> Notifications
                  </Link>
                  <button
                    onClick={logout}
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50"
                  >
                    <Icons.LogOut className="h-4 w-4" /> Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">{children}</main>

        <footer className="no-print px-6 pb-8 pt-2 text-center text-xs text-slate-400">
          {schoolName} · School Fee Management System
        </footer>
      </div>
    </div>
  );
}
