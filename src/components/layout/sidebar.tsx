"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLanguage, useAuth } from "@/components/providers";
import { type ModuleKey } from "@/components/icons/module-icons";
import { navItems, getNavForRole } from "@/lib/navigation";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import { ChevronsLeft, ChevronsRight } from "lucide-react";

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

/** Material Symbols icon name per navigation module. */
const moduleIconName: Record<ModuleKey, string> = {
  dashboard: "home",
  employees: "group",
  attendance: "calendar_today",
  leaves: "event_busy",
  payroll: "payments",
  requests: "bolt",
  dailyReports: "description",
  reports: "analytics",
  settings: "settings",
};

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const { t, dir } = useLanguage();
  const { role } = useAuth();
  const isRTL = dir === "rtl";

  const visibleItems = getNavForRole(navItems, role);

  return (
    <aside
      className={cn(
        "hidden lg:flex flex-col fixed top-[var(--njd-navbar-height,64px)] start-0 h-[calc(100dvh-var(--njd-navbar-height,64px))] bg-surface-container-low transition-all duration-300 ease-in-out z-30",
        collapsed ? "w-[72px]" : "w-72"
      )}
    >
      {/* Brand header */}
      {!collapsed && (
        <div className="px-6 py-5 shrink-0">
          <h1 className="font-headline text-xl font-extrabold text-primary tracking-tight">
            NJD Games
          </h1>
          <p className="text-xs text-on-surface-variant mt-0.5 font-medium">
            {t.appTagline}
          </p>
        </div>
      )}

      {/* Navigation */}
      <nav className={cn("flex-1 overflow-y-auto space-y-1", collapsed ? "px-3 py-4" : "py-2")}>
        {visibleItems.map((item) => {
          const isActive = item.href === "/"
            ? pathname === "/"
            : pathname === item.href || pathname.startsWith(item.href + "/");
          const label = t.nav[item.key];
          const iconName = moduleIconName[item.key];

          return (
            <Link
              key={item.key}
              href={item.href}
              title={collapsed ? label : undefined}
              className={cn(
                "group flex items-center gap-3 rounded-2xl transition-all duration-300",
                collapsed ? "justify-center mx-0 p-3" : "mx-4 px-6 py-3",
                isActive
                  ? "bg-surface-container-lowest text-primary shadow-xl shadow-primary/10 font-semibold"
                  : "text-on-surface-variant hover:bg-primary-container/30 hover:text-primary",
                !isActive && !collapsed && "ltr:hover:translate-x-1 rtl:hover:-translate-x-1"
              )}
            >
              <Icon
                name={iconName}
                fill={isActive}
                size={collapsed ? 26 : 22}
                className="shrink-0"
              />
              {!collapsed && (
                <span className="text-sm truncate">
                  {label}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* CTA + collapse toggle */}
      <div className="shrink-0 p-4 space-y-2">
        {/* "New Request" CTA — hidden when collapsed */}
        {!collapsed && (
          <Link
            href="/requests"
            className="gradient-btn w-full flex items-center justify-center gap-2 rounded-xl px-4 py-3.5 text-sm font-bold shadow-primary-glow hover:shadow-primary-glow-lg hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            <Icon name="add" size={20} />
            <span>{t.actions.newRequest}</span>
          </Link>
        )}

        {/* Collapse/expand toggle */}
        <button
          onClick={onToggle}
          className="w-full flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors focus-visible:ring-2 focus-visible:ring-primary/40 outline-none"
          title={collapsed ? t.common.expand : t.common.collapse}
          aria-label={collapsed ? t.common.expand : t.common.collapse}
          aria-expanded={!collapsed}
        >
          {collapsed !== isRTL ? (
            <ChevronsRight className="w-4 h-4" />
          ) : (
            <ChevronsLeft className="w-4 h-4" />
          )}
          {!collapsed && <span>{t.common.collapse}</span>}
        </button>
      </div>
    </aside>
  );
}
