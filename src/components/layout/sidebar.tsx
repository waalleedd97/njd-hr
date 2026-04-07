"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLanguage, useAuth } from "@/components/providers";
import { moduleIcons, type ModuleKey } from "@/components/icons/module-icons";
import { navItems, getNavForRole } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { ChevronsLeft, ChevronsRight } from "lucide-react";

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

// Per-section colors: [bg, text, activeBg, activeText]
const sectionColors: Record<ModuleKey, { bg: string; active: string }> = {
  dashboard:  { bg: "bg-[#8B5CF6]", active: "bg-[#8B5CF6]/10 text-[#8B5CF6]" },
  employees:  { bg: "bg-[#3B82F6]", active: "bg-[#3B82F6]/10 text-[#3B82F6]" },
  attendance: { bg: "bg-[#14B8A6]", active: "bg-[#14B8A6]/10 text-[#14B8A6]" },
  leaves:     { bg: "bg-[#10B981]", active: "bg-[#10B981]/10 text-[#10B981]" },
  payroll:    { bg: "bg-[#F59E0B]", active: "bg-[#F59E0B]/10 text-[#F59E0B]" },
  requests:   { bg: "bg-[#6366F1]", active: "bg-[#6366F1]/10 text-[#6366F1]" },
  dailyReports: { bg: "bg-[#EC4899]", active: "bg-[#EC4899]/10 text-[#EC4899]" },
  reports:    { bg: "bg-[#F43F5E]", active: "bg-[#F43F5E]/10 text-[#F43F5E]" },
  settings:   { bg: "bg-[#64748B]", active: "bg-[#64748B]/10 text-[#64748B]" },
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
        "hidden lg:flex flex-col fixed top-[var(--njd-navbar-height,64px)] start-0 h-[calc(100dvh-var(--njd-navbar-height,64px))] bg-white dark:bg-card shadow-[1px_0_3px_rgba(0,0,0,0.05)] dark:shadow-[1px_0_3px_rgba(0,0,0,0.2)] transition-all duration-300 ease-in-out z-30",
        collapsed ? "w-[72px]" : "w-64"
      )}
    >
      {/* Navigation */}
      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        {visibleItems.map((item) => {
          const Icon = moduleIcons[item.key];
          const isActive = pathname === item.href;
          const label = t.nav[item.key];
          const colors = sectionColors[item.key];

          return (
            <Link
              key={item.key}
              href={item.href}
              title={collapsed ? label : undefined}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-200 group relative",
                isActive
                  ? cn(colors.active, "font-semibold")
                  : "text-foreground/60 hover:bg-accent/60 hover:text-foreground",
                collapsed && "justify-center px-2"
              )}
            >
              {/* Icon with colored rounded-square background */}
              <div
                className={cn(
                  "flex items-center justify-center rounded-lg shrink-0 transition-all duration-200",
                  colors.bg,
                  isActive
                    ? (collapsed ? "w-9 h-9" : "w-8 h-8")
                    : (collapsed ? "w-8 h-8" : "w-7 h-7"),
                  "group-hover:scale-110"
                )}
              >
                <Icon
                  className={cn(
                    "shrink-0 text-white [&_rect]:fill-white [&_circle]:fill-white [&_path]:fill-white [&_line]:stroke-white",
                    isActive
                      ? (collapsed ? "w-5 h-5" : "w-[18px] h-[18px]")
                      : (collapsed ? "w-[18px] h-[18px]" : "w-4 h-4")
                  )}
                />
              </div>
              {!collapsed && (
                <span className={cn("text-sm truncate", isActive && "font-semibold")}>
                  {label}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Collapse toggle */}
      <div className="p-3 border-t border-border shrink-0">
        <button
          onClick={onToggle}
          className="w-full flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          title={collapsed ? t.common.expand : t.common.collapse}
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
