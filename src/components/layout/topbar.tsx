"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useLanguage, useAuth } from "@/components/providers";
import { moduleIcons } from "@/components/icons/module-icons";
import { navItems, getNavForRole } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { Menu, Sun, Moon, Shield, User } from "lucide-react";
import { LanguageToggle } from "./language-toggle";
import { NotificationsPanel } from "./notifications-panel";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

export function Topbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { t, lang, dir } = useLanguage();
  const { theme, setTheme } = useTheme();
  const { role, user, isAdmin, logout } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const isRTL = dir === "rtl";
  const isAr = lang === "ar";

  const visibleNavItems = getNavForRole(navItems, role);

  const handleProfile = useCallback(() => {
    router.push(isAdmin ? "/employees" : "/");
  }, [router, isAdmin]);

  const handleSettings = useCallback(() => {
    router.push(isAdmin ? "/settings" : "/");
  }, [router, isAdmin]);

  const handleLogout = useCallback(() => {
    logout();
  }, [logout]);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <header className="sticky top-0 z-40 h-16 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="flex items-center justify-between h-full px-4 lg:px-6">
        {/* Left: Mobile menu */}
        <div className="flex items-center gap-3">
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger className="lg:hidden p-2 rounded-lg hover:bg-accent transition-colors">
              <Menu className="w-5 h-5" />
            </SheetTrigger>
            <SheetContent
              side={isRTL ? "right" : "left"}
              className="w-72 p-0"
            >
              <SheetHeader className="p-4 border-b border-border">
                <SheetTitle>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-primary-foreground font-bold text-lg">
                      ن
                    </div>
                    <div className="text-start">
                      <div className="font-bold text-foreground leading-tight">
                        {t.appName}
                      </div>
                      <div className="text-xs text-muted-foreground font-normal">
                        {t.appTagline}
                      </div>
                    </div>
                  </div>
                </SheetTitle>
              </SheetHeader>
              <nav className="p-3 space-y-1">
                {visibleNavItems.map((item) => {
                  const Icon = moduleIcons[item.key];
                  const isActive = pathname === item.href;
                  const label = t.nav[item.key];
                  return (
                    <Link
                      key={item.key}
                      href={item.href}
                      onClick={() => setSheetOpen(false)}
                      className={cn(
                        "flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-200",
                        isActive
                          ? "bg-primary/10 text-primary font-medium"
                          : "text-foreground/70 hover:bg-accent hover:text-foreground"
                      )}
                    >
                      <Icon className="w-6 h-6 shrink-0" />
                      <span className="text-sm">{label}</span>
                    </Link>
                  );
                })}
              </nav>
            </SheetContent>
          </Sheet>

          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm">
              ن
            </div>
            <span className="font-bold text-sm">{t.appName}</span>
          </div>
        </div>

        {/* Right: Controls */}
        <div className="flex items-center gap-2">
          {/* Role badge */}
          <div
            className={cn(
              "hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
              isAdmin
                ? "bg-primary/10 text-primary"
                : "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400"
            )}
          >
            {isAdmin ? (
              <Shield className="w-3 h-3" />
            ) : (
              <User className="w-3 h-3" />
            )}
            {t.role[role]}
          </div>

          {/* Language toggle */}
          <LanguageToggle />

          {/* Theme toggle */}
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="p-2 rounded-lg hover:bg-accent transition-colors"
          >
            {mounted ? (
              theme === "dark" ? (
                <Sun className="w-5 h-5 text-muted-foreground" />
              ) : (
                <Moon className="w-5 h-5 text-muted-foreground" />
              )
            ) : (
              <div className="w-5 h-5" />
            )}
          </button>

          {/* Notifications */}
          <NotificationsPanel />

          {/* Profile */}
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-2 p-1 rounded-lg hover:bg-accent transition-colors outline-none">
              <Avatar className="w-8 h-8">
                <AvatarFallback
                  className={cn(
                    "text-sm font-bold",
                    isAdmin
                      ? "bg-primary/10 text-primary"
                      : "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400"
                  )}
                >
                  {user.initials}
                </AvatarFallback>
              </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align={isRTL ? "start" : "end"}
              className="w-56"
            >
              {/* User info */}
              <div className="px-2 py-2">
                <p className="text-sm font-medium">
                  {isAr ? user.nameAr : user.nameEn}
                </p>
                <p className="text-xs text-muted-foreground">
                  {isAr ? user.positionAr : user.positionEn}
                </p>
                <div
                  className={cn(
                    "mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium",
                    isAdmin
                      ? "bg-primary/10 text-primary"
                      : "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400"
                  )}
                >
                  {isAdmin ? (
                    <Shield className="w-3 h-3" />
                  ) : (
                    <User className="w-3 h-3" />
                  )}
                  {t.role[role]}
                </div>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleProfile}>
                {t.common.profile}
              </DropdownMenuItem>
              {isAdmin && (
                <DropdownMenuItem onClick={handleSettings}>
                  {t.common.settings}
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={handleLogout}>
                {t.common.logout}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
