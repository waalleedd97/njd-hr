"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLanguage, useAuth } from "@/components/providers";
import { moduleIcons } from "@/components/icons/module-icons";
import { navItems, getNavForRole } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { ChevronsLeft, ChevronsRight } from "lucide-react";

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const { t, dir } = useLanguage();
  const { role } = useAuth();
  const isRTL = dir === "rtl";

  const visibleItems = getNavForRole(navItems, role);

  return (
    <aside
      className={cn(
        "hidden lg:flex flex-col h-screen sticky top-0 border-e border-sidebar-border bg-sidebar transition-all duration-300 ease-in-out z-30",
        collapsed ? "w-[72px]" : "w-64"
      )}
    >
      {/* Logo */}
      <div
        className={cn(
          "flex items-center h-16 px-4 border-b border-sidebar-border shrink-0",
          collapsed && "justify-center px-2"
        )}
      >
        {collapsed ? (
          <Image src="/logo.png" alt="NJD Games" width={40} height={40} className="w-10 h-10 rounded-xl object-contain shrink-0" />
        ) : (
          <div className="flex items-center gap-3">
            <Image src="/logo.png" alt="NJD Games" width={40} height={40} className="w-10 h-10 rounded-xl object-contain shrink-0" />
            <div className="min-w-0">
              <h1 className="font-bold text-sidebar-foreground leading-tight truncate">
                {t.appName}
              </h1>
              <p className="text-xs text-muted-foreground truncate">
                {t.appTagline}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        {visibleItems.map((item) => {
          const Icon = moduleIcons[item.key];
          const isActive = pathname === item.href;
          const label = t.nav[item.key];

          return (
            <Link
              key={item.key}
              href={item.href}
              title={collapsed ? label : undefined}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-200 group relative",
                isActive
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground",
                collapsed && "justify-center px-2"
              )}
            >
              <Icon
                className={cn(
                  "shrink-0 transition-transform duration-200 group-hover:scale-110",
                  collapsed ? "w-7 h-7" : "w-6 h-6"
                )}
              />
              {!collapsed && (
                <span className="text-sm truncate">{label}</span>
              )}
              {isActive && (
                <div className="absolute inset-y-1 start-0 w-1 rounded-full bg-primary" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Collapse toggle */}
      <div className="p-3 border-t border-sidebar-border shrink-0">
        <button
          onClick={onToggle}
          className="w-full flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
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
