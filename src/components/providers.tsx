"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  ReactNode,
} from "react";
import { ThemeProvider as NextThemeProvider } from "next-themes";
import { type Language, translations, type TranslationKey } from "@/lib/i18n";
import { type UserRole } from "@/lib/navigation";
import { DataProvider } from "@/lib/data-store";
import { supabase } from "@/lib/supabase";
import type { UserProfile } from "@/lib/auth/types";
import { ToastProvider } from "@/components/ui/toast";
import { ConfirmProvider } from "@/components/ui/confirm-dialog";

// Re-export UserProfile so existing imports from "@/components/providers" keep working.
export type { UserProfile };

// ─── Language Context ────────────────────────────────────────────────

interface LanguageContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  t: TranslationKey;
  dir: "rtl" | "ltr";
  toggleLang: () => void;
}

const LanguageContext = createContext<LanguageContextType | null>(null);

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within Providers");
  return ctx;
}

function getInitialLang(): Language {
  if (typeof window === "undefined") return "ar";
  const stored = localStorage.getItem("njd-lang");
  if (stored === "en" || stored === "ar") return stored;
  return "ar";
}

function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Language>(getInitialLang);

  const toggleLang = useCallback(() => {
    setLang((prev) => (prev === "ar" ? "en" : "ar"));
  }, []);

  const dir = lang === "ar" ? "rtl" : "ltr";
  const t = translations[lang];

  return (
    <LanguageContext.Provider value={{ lang, setLang, toggleLang, t, dir }}>
      {children}
    </LanguageContext.Provider>
  );
}

// ─── Auth / Role Context ─────────────────────────────────────────────

interface AuthContextType {
  role: UserRole;
  setRole: (role: UserRole) => void;
  switchRole: () => void;
  user: UserProfile;
  isAdmin: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);
const AUTH_KEY = "njd-hr-auth";
const LANDING_URL = "https://njd-services.net";

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within Providers");
  return ctx;
}

function AuthProvider({
  children,
  initialUser,
  initialRole,
}: {
  children: ReactNode;
  initialUser: UserProfile;
  initialRole: UserRole;
}) {
  const [role, setRole] = useState<UserRole>(initialRole);
  // initialUser is passed in by the server-rendered layout, never mutated client-side.
  // No setUser exposed because client-side profile edits flow through useData() →
  // updateEmployee(), not through this auth context.
  const [user] = useState<UserProfile>(initialUser);
  // Layout already gated unauthenticated users to Landing — reaching here means authed.
  const [isAuthenticated] = useState(true);

  // Accept pending invitations + clear local auth cache on SIGNED_OUT.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { data: invitation } = await supabase
          .from("pending_invitations")
          .select("id")
          .eq("email", initialUser.email)
          .eq("status", "pending")
          .maybeSingle();
        if (!cancelled && invitation) {
          window.dispatchEvent(
            new CustomEvent("njd-accept-invitation", { detail: initialUser.email })
          );
        }
      } catch {
        /* ignore */
      }
    })();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event: string) => {
      if (event === "SIGNED_OUT") {
        try {
          localStorage.removeItem(AUTH_KEY);
        } catch {
          /* ignore */
        }
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [initialUser.email]);

  // login() is intentionally a no-op stub: this app never renders a sign-in UI.
  // All authentication lives in the Landing project. Kept in the context shape
  // only because older consumers still destructure it.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const login = useCallback((_email: string, _password: string): boolean => {
    return false;
  }, []);

  const logout = useCallback(async () => {
    try {
      localStorage.removeItem(AUTH_KEY);
    } catch {
      /* ignore */
    }
    try {
      const { error } = await supabase.auth.signOut();
      if (error) console.error("[auth] signOut failed:", error.message);
    } catch (err) {
      console.error("[auth] signOut threw:", err);
    } finally {
      window.location.href = LANDING_URL;
    }
  }, []);

  const switchRole = useCallback(() => {
    setRole((prev) => (prev === "admin" ? "employee" : "admin"));
  }, []);

  const isAdmin = role === "admin";

  return (
    <AuthContext.Provider
      value={{
        role,
        setRole,
        switchRole,
        user,
        isAdmin,
        isAuthenticated,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ─── Combined Providers ──────────────────────────────────────────────

export function Providers({
  children,
  initialUser,
  initialRole,
}: {
  children: ReactNode;
  initialUser: UserProfile;
  initialRole: UserRole;
}) {
  // Reveal the loading overlay exit as soon as React mounts — we already have
  // user + data from the server, so nothing left to wait for.
  useEffect(() => {
    document.documentElement.classList.add("app-ready");
  }, []);

  return (
    <NextThemeProvider
      attribute={["class", "data-theme"]}
      defaultTheme="light"
      enableSystem={false}
    >
      <LanguageProvider>
        <AuthProvider initialUser={initialUser} initialRole={initialRole}>
          <DataProvider seedFromServer>
            <ToastProvider>
              <ConfirmProvider>{children}</ConfirmProvider>
            </ToastProvider>
          </DataProvider>
        </AuthProvider>
      </LanguageProvider>
    </NextThemeProvider>
  );
}
