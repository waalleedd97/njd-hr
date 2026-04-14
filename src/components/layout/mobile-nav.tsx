"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLanguage, useAuth } from "@/components/providers";
import { mobileNavItems, getNavForRole } from "@/lib/navigation";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import { type ModuleKey } from "@/components/icons/module-icons";

/** Material Symbols icon name per nav module (same mapping as sidebar). */
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

export function MobileNav() {
  const pathname = usePathname();
  const { t } = useLanguage();
  const { role } = useAuth();

  const visibleItems = getNavForRole(mobileNavItems, role);

  return (
    <nav className="fixed bottom-0 start-0 end-0 lg:hidden glass-strong shadow-[0_-4px_20px_rgba(0,0,0,0.08)] z-50 pb-[env(safe-area-inset-bottom)]">
      <div className="flex justify-around items-center h-16 px-1">
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
              className={cn(
                "flex flex-col items-center justify-center gap-1 flex-1 py-1 rounded-lg transition-colors",
                isActive ? "text-primary font-bold" : "text-on-surface-variant"
              )}
            >
              <Icon name={iconName} size={24} fill={isActive} />
              <span className="text-[10px] font-bold leading-tight truncate max-w-[60px] text-center">
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
