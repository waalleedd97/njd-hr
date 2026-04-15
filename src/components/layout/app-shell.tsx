"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { usePathname } from "next/navigation";
import { useLanguage, useAuth } from "@/components/providers";
import { adminOnlyPaths } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { Sidebar } from "./sidebar";
import { MobileNav } from "./mobile-nav";
import { NotificationsPanel } from "./notifications-panel";
import { Shield } from "lucide-react";
import { supabase } from "@/lib/supabase";

// TypeScript declaration for the njd-navbar web component
// (React 19 reads JSX.IntrinsicElements from the "react" module namespace)
declare module "react" {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      "njd-navbar": React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & { lang?: string; app?: string },
        HTMLElement
      >;
    }
  }
}

// ─── NJD Navbar Web Component Bridge ─────────────────────────────────

function NJDNavbar() {
  const navRef = useRef<HTMLElement>(null);
  const { lang, setLang } = useLanguage();
  const [profile, setProfile] = useState<{ name_ar: string; name_en: string; full_name_ar?: string; full_name_en?: string } | null>(null);
  const [notifOpen, setNotifOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Fetch profile from Supabase on mount
  useEffect(() => {
    async function fetchProfile() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data } = await supabase
        .from("profiles")
        .select("name_ar, name_en, full_name_ar, full_name_en")
        .eq("id", session.user.id)
        .single();

      if (!data) {
        window.location.href = "https://njd-services.net/#complete-profile";
        return;
      }

      setProfile(data);
    }
    fetchProfile();
  }, []);

  // Wire web component events → React state
  useEffect(() => {
    const el = navRef.current;
    if (!el) return;

    const handleLogout = () => {
      supabase.auth.signOut();
    };

    const handleLangChange = (e: Event) => {
      const newLang = (e as CustomEvent).detail?.lang;
      if (newLang === "ar" || newLang === "en") setLang(newLang);
    };

    const handleNotifClick = () => {
      setNotifOpen((p) => !p);
    };

    el.addEventListener("njd-logout", handleLogout);
    el.addEventListener("njd-lang-change", handleLangChange);
    el.addEventListener("njd-notification-click", handleNotifClick);

    return () => {
      el.removeEventListener("njd-logout", handleLogout);
      el.removeEventListener("njd-lang-change", handleLangChange);
      el.removeEventListener("njd-notification-click", handleNotifClick);
    };
  }, [setLang]);

  // Sync lang, user-name, and notification-count to the web component
  useEffect(() => {
    const el = navRef.current;
    if (!el) return;
    el.setAttribute("lang", lang);
    el.setAttribute("notification-count", String(unreadCount));
    if (profile) {
      // Use short first name (name_ar/name_en), not full name
      const displayName = lang === "ar"
        ? (profile.name_ar || (profile.full_name_ar || "").split(" ")[0])
        : (profile.name_en || (profile.full_name_en || "").split(" ")[0]);
      if (displayName) el.setAttribute("user-name", displayName);
    }
  }, [lang, profile, unreadCount]);

  const handleUnreadCountChange = useCallback((count: number) => {
    setUnreadCount(count);
  }, []);

  const handleCloseNotifs = useCallback(() => {
    setNotifOpen(false);
  }, []);

  return (
    <>
      <njd-navbar ref={navRef} lang={lang} app="hr" />
      <NotificationsPanel
        open={notifOpen}
        onClose={handleCloseNotifs}
        onUnreadCountChange={handleUnreadCountChange}
      />
    </>
  );
}

// ─── App Shell ───────────────────────────────────────────────────────

export function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try { return localStorage.getItem("njd-hr-sidebar-collapsed") === "1"; }
    catch { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem("njd-hr-sidebar-collapsed", collapsed ? "1" : "0"); }
    catch { /* quota */ }
  }, [collapsed]);
  const { dir, lang, t } = useLanguage();
  const { role, isAuthenticated } = useAuth();
  const pathname = usePathname();

  // Update html dir and lang attributes when language changes
  useEffect(() => {
    document.documentElement.dir = dir;
    document.documentElement.lang = lang;
  }, [dir, lang]);

  // Scroll to top on every route change and after login
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname, isAuthenticated]);

  // Server-side route gating handles profile-completion + admin-only redirects
  // (see src/app/layout.tsx and per-page `requireUser({ admin: true })`).
  // This client-side check exists only as a visual fallback for the brief moment
  // between client-nav request and server redirect response.
  const isBlocked =
    role === "employee" && adminOnlyPaths.includes(pathname);

  return (
    <>
      <NJDNavbar />
      <div dir={dir}>
        <Sidebar
          collapsed={collapsed}
          onToggle={() => setCollapsed((p) => !p)}
        />
        <div className={cn(
          "min-h-[calc(100dvh-var(--njd-navbar-height, 64px))] flex flex-col transition-all duration-300",
          collapsed ? "lg:ms-[72px]" : "lg:ms-72"
        )}>
          <main className="flex-1 px-4 pt-5 lg:px-6 lg:pt-6 pb-20 lg:pb-6 overflow-x-hidden">
            {isBlocked ? (
              <div className="flex flex-col items-center justify-center h-[60vh] text-center gap-4">
                <div className="w-20 h-20 rounded-3xl bg-error-container/20 flex items-center justify-center">
                  <Shield className="w-10 h-10 text-md-error" />
                </div>
                <div>
                  <p className="font-headline text-xl font-bold text-on-surface">
                    {t.role.accessDenied}
                  </p>
                  <p className="text-sm text-on-surface-variant mt-1">
                    {t.role.redirecting}
                  </p>
                </div>
              </div>
            ) : (
              children
            )}
          </main>
          <MobileNav />
        </div>
      </div>
    </>
  );
}
