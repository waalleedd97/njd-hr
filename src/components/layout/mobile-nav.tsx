"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLanguage, useAuth } from "@/components/providers";
import { moduleIcons } from "@/components/icons/module-icons";
import { mobileNavItems, getNavForRole } from "@/lib/navigation";
import { cn } from "@/lib/utils";

export function MobileNav() {
  const pathname = usePathname();
  const { t } = useLanguage();
  const { role } = useAuth();

  const visibleItems = getNavForRole(mobileNavItems, role);

  return (
    <nav className="fixed bottom-0 start-0 end-0 lg:hidden bg-background/90 backdrop-blur-md border-t border-border z-50 pb-[env(safe-area-inset-bottom)]">
      <div className="flex justify-around items-center h-16 px-1">
        {visibleItems.map((item) => {
          const Icon = moduleIcons[item.key];
          const isActive = pathname === item.href;
          const label = t.nav[item.key];

          return (
            <Link
              key={item.key}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 flex-1 py-1 rounded-lg transition-colors",
                isActive ? "text-primary" : "text-muted-foreground"
              )}
            >
              <Icon className="w-6 h-6" />
              <span className="text-[10px] font-medium leading-tight truncate max-w-[60px] text-center">
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
