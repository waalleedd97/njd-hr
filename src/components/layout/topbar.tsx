"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useLanguage, useAuth } from "@/components/providers";
import { moduleIcons } from "@/components/icons/module-icons";
import { navItems, getNavForRole } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { Menu, Sun, Moon, Shield, User, KeyRound } from "lucide-react";
import { useData } from "@/lib/data-store";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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
  const store = useData();
  const [mounted, setMounted] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [pwDialogOpen, setPwDialogOpen] = useState(false);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwError, setPwError] = useState("");
  const [pwSuccess, setPwSuccess] = useState(false);
  const isRTL = dir === "rtl";
  const isAr = lang === "ar";

  const visibleNavItems = getNavForRole(navItems, role);

  const handleProfile = useCallback(() => {
    router.push("/profile");
  }, [router]);

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
                    <Image src="/logo.png" alt="NJD Games" width={40} height={40} className="w-10 h-10 rounded-xl object-contain" />
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
            <Image src="/logo.png" alt="NJD Games" width={32} height={32} className="w-8 h-8 rounded-lg object-contain" />
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
              <DropdownMenuItem onClick={() => { setPwDialogOpen(true); setPwError(""); setPwSuccess(false); setCurrentPw(""); setNewPw(""); setConfirmPw(""); }}>
                <KeyRound className="w-3.5 h-3.5 me-1.5" />
                {t.profile.changePassword}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={handleLogout}>
                {t.common.logout}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Change Password Dialog */}
      <Dialog open={pwDialogOpen} onOpenChange={setPwDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-primary" />
              {t.profile.changePassword}
            </DialogTitle>
            <DialogDescription className="sr-only">{t.profile.changePassword}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium block mb-1">{t.profile.currentPassword}</label>
              <input type="password" value={currentPw} onChange={(e) => { setCurrentPw(e.target.value); setPwError(""); }} className="h-9 w-full rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-primary" />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">{t.profile.newPassword}</label>
              <input type="password" value={newPw} onChange={(e) => { setNewPw(e.target.value); setPwError(""); }} className="h-9 w-full rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-primary" />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">{t.profile.confirmPassword}</label>
              <input type="password" value={confirmPw} onChange={(e) => { setConfirmPw(e.target.value); setPwError(""); }} className="h-9 w-full rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-primary" />
            </div>
            {pwError && <p className="text-sm text-red-500 font-medium">{pwError}</p>}
            {pwSuccess && <p className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">{t.profile.passwordChanged}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPwDialogOpen(false)}>{t.common.cancel}</Button>
            <Button disabled={pwSuccess} onClick={() => {
              if (!store.verifyPassword(user.email, currentPw)) { setPwError(t.profile.wrongPassword); return; }
              if (newPw.length < 6) { setPwError(t.profile.passwordTooShort); return; }
              if (newPw !== confirmPw) { setPwError(t.profile.passwordMismatch); return; }
              store.changePassword(user.email, newPw);
              setPwSuccess(true);
              setTimeout(() => setPwDialogOpen(false), 1500);
            }}>{t.common.save}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </header>
  );
}
