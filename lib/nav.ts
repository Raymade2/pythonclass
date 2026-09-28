export type NavItem = {
  href: string;
  label: string;
  icon: string;
  roles: string[];
};

export type NavSection = { title: string; items: NavItem[] };

export const NAV_SECTIONS: NavSection[] = [
  {
    title: "Overview",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: "LayoutDashboard", roles: ["SUPER_ADMIN", "ADMIN", "TEACHER", "PARENT"] },
      { href: "/portal", label: "Parent Portal", icon: "Home", roles: ["PARENT"] },
    ],
  },
  {
    title: "Academics",
    items: [
      { href: "/classes", label: "Classes", icon: "School", roles: ["SUPER_ADMIN", "ADMIN", "TEACHER"] },
      { href: "/class-groups", label: "Class Groups", icon: "Layers", roles: ["SUPER_ADMIN", "ADMIN"] },
      { href: "/students", label: "Students", icon: "GraduationCap", roles: ["SUPER_ADMIN", "ADMIN", "TEACHER"] },
      { href: "/teachers", label: "Teachers", icon: "BookOpen", roles: ["SUPER_ADMIN", "ADMIN"] },
      { href: "/assignments/students", label: "Student-Class Assignment", icon: "UserPlus", roles: ["SUPER_ADMIN", "ADMIN"] },
      { href: "/assignments/teachers", label: "Teacher-Class Assignment", icon: "Users", roles: ["SUPER_ADMIN", "ADMIN"] },
    ],
  },
  {
    title: "Finance",
    items: [
      { href: "/fees", label: "School Fees", icon: "Receipt", roles: ["SUPER_ADMIN", "ADMIN"] },
      { href: "/other-payments", label: "Other Payments", icon: "ShoppingBag", roles: ["SUPER_ADMIN", "ADMIN"] },
      { href: "/billing", label: "Student Payments / Billing", icon: "FileText", roles: ["SUPER_ADMIN", "ADMIN", "TEACHER", "PARENT"] },
      { href: "/payments", label: "Payment History", icon: "CreditCard", roles: ["SUPER_ADMIN", "ADMIN", "TEACHER", "PARENT"] },
      { href: "/debtors", label: "Debtors", icon: "AlertTriangle", roles: ["SUPER_ADMIN", "ADMIN", "TEACHER"] },
    ],
  },
  {
    title: "Insights",
    items: [
      { href: "/reports", label: "Reports", icon: "BarChart3", roles: ["SUPER_ADMIN", "ADMIN"] },
    ],
  },
  {
    title: "Administration",
    items: [
      { href: "/users", label: "Users & Roles", icon: "ShieldCheck", roles: ["SUPER_ADMIN"] },
      { href: "/settings", label: "Settings", icon: "Settings", roles: ["SUPER_ADMIN", "ADMIN"] },
      { href: "/audit-logs", label: "Audit Logs", icon: "ScrollText", roles: ["SUPER_ADMIN"] },
    ],
  },
];

export function navForRole(role: string): NavSection[] {
  return NAV_SECTIONS.map((s) => ({
    ...s,
    items: s.items.filter((i) => i.roles.includes(role)),
  })).filter((s) => s.items.length > 0);
}
