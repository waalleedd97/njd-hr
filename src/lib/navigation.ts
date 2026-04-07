import { type ModuleKey } from "@/components/icons/module-icons";

export type UserRole = "admin" | "employee";

export interface NavItem {
  key: ModuleKey;
  href: string;
  adminOnly?: boolean;
}

export const navItems: NavItem[] = [
  { key: "dashboard", href: "/" },
  { key: "employees", href: "/employees", adminOnly: true },
  { key: "attendance", href: "/attendance" },
  { key: "leaves", href: "/leaves" },
  { key: "payroll", href: "/payroll" },
  { key: "requests", href: "/requests" },
  { key: "dailyReports", href: "/daily-reports", adminOnly: true },
  { key: "reports", href: "/reports", adminOnly: true },
  { key: "settings", href: "/settings", adminOnly: true },
];

export const mobileNavItems: NavItem[] = [
  { key: "dashboard", href: "/" },
  { key: "attendance", href: "/attendance" },
  { key: "leaves", href: "/leaves" },
  { key: "requests", href: "/requests" },
  { key: "payroll", href: "/payroll" },
];

export function getNavForRole(items: NavItem[], role: UserRole): NavItem[] {
  if (role === "admin") return items;
  return items.filter((item) => !item.adminOnly);
}

/** Routes that only admins can access */
export const adminOnlyPaths = navItems
  .filter((item) => item.adminOnly)
  .map((item) => item.href);
