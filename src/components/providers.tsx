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
import { employees as allEmployees } from "@/lib/mock-data";
import { SupabaseAuthGuard } from "@/components/supabase-auth-guard";
import { supabase } from "@/lib/supabase";

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

export interface UserProfile {
  id: string;
  nameAr: string;
  nameEn: string;
  positionAr: string;
  positionEn: string;
  initials: string;
  email: string;
  profileCompleted?: boolean;
}

/** Fallback admin emails — used when Supabase RPC is unavailable */
const ADMIN_EMAILS = new Set(
  allEmployees.filter((e) => e.department === "hr").map((e) => e.email)
);

function resolveUser(email: string): { profile: UserProfile; role: UserRole } | null {
  // Check static employees first
  let emp = allEmployees.find(
    (e) => e.email.toLowerCase() === email.toLowerCase()
  );
  // Also check dynamic employees from data store (invited employees)
  if (!emp) {
    try {
      const saved = localStorage.getItem("njd-hr-data");
      if (saved) {
        const data = JSON.parse(saved);
        emp = (data.employees || []).find(
          (e: { email: string }) => e.email.toLowerCase() === email.toLowerCase()
        );
      }
    } catch { /* ignore */ }
  }
  if (!emp) return null;
  const profile: UserProfile = {
    id: emp.id,
    nameAr: emp.nameAr,
    nameEn: emp.nameEn,
    positionAr: emp.positionAr,
    positionEn: emp.positionEn,
    initials: emp.initials,
    email: emp.email,
    profileCompleted: emp.profileCompleted !== false,
  };
  const role: UserRole = ADMIN_EMAILS.has(emp.email) ? "admin" : "employee";
  return { profile, role };
}

const fallbackUser: UserProfile = {
  id: "EMP001",
  nameAr: "وليد",
  nameEn: "Waleed",
  positionAr: "مدير النظام",
  positionEn: "System Administrator",
  initials: "و",
  email: "waleed@njdstudio.net",
};

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

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within Providers");
  return ctx;
}

function AuthProvider({ children, onReady }: { children: ReactNode; onReady?: () => void }) {
  const [role, setRole] = useState<UserRole>("admin");
  const [user, setUser] = useState<UserProfile>(fallbackUser);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // Sync auth from Supabase session + fetch RBAC role
  useEffect(() => {
    async function syncAuth() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.email) {
        const email = session.user.email;
        const userId = session.user.id;

        // Accept any pending invitation for this email
        try {
          const saved = localStorage.getItem("njd-hr-data");
          if (saved) {
            const data = JSON.parse(saved);
            const hasInvitation = (data.pendingInvitations || []).some(
              (i: { email: string; status: string }) =>
                i.email.toLowerCase() === email.toLowerCase() && i.status === "pending"
            );
            if (hasInvitation) {
              window.dispatchEvent(new CustomEvent("njd-accept-invitation", { detail: email }));
            }
          }
        } catch { /* ignore */ }

        // Fetch role from Supabase RBAC (super_admin → admin, else employee)
        let supabaseRole: UserRole = "employee";
        try {
          const { data: roleData } = await supabase.rpc("get_user_role", { uid: userId });
          if (roleData === "super_admin") {
            supabaseRole = "admin";
          }
        } catch {
          // RPC not available — fall back to local email-based check
          supabaseRole = ADMIN_EMAILS.has(email) ? "admin" : "employee";
        }

        // Fetch real name from Supabase profiles table
        let nameAr = "";
        let nameEn = "";
        try {
          const { data: prof } = await supabase
            .from("profiles")
            .select("name_ar, name_en, full_name_ar, full_name_en")
            .eq("id", userId)
            .single();
          if (prof) {
            nameAr = prof.full_name_ar || prof.name_ar || "";
            nameEn = prof.full_name_en || prof.name_en || "";
          }
        } catch { /* profiles table may not exist yet */ }

        // Fall back to local employee data, then to email prefix
        const resolved = resolveUser(email);
        const fallbackName = session.user.user_metadata?.full_name || email.split("@")[0];

        setUser({
          id: resolved?.profile.id || userId,
          nameAr: nameAr || resolved?.profile.nameAr || fallbackName,
          nameEn: nameEn || resolved?.profile.nameEn || fallbackName,
          positionAr: resolved?.profile.positionAr || (supabaseRole === "admin" ? "مدير النظام" : "موظف"),
          positionEn: resolved?.profile.positionEn || (supabaseRole === "admin" ? "System Administrator" : "Employee"),
          initials: (nameAr || resolved?.profile.nameAr || fallbackName).charAt(0).toUpperCase(),
          email,
          profileCompleted: resolved?.profile.profileCompleted ?? true,
        });
        setRole(supabaseRole);
        setIsAuthenticated(true);
      }
      setHydrated(true);
    }
    syncAuth();
  }, []);

  // Signal to the loading overlay that the app is fully ready
  useEffect(() => {
    if (hydrated && onReady) onReady();
  }, [hydrated, onReady]);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const login = useCallback(
    (email: string, password: string): boolean => {
      // Login is handled by Supabase — kept for interface compatibility
      void email; void password;
      return false;
    },
    []
  );

  const logout = useCallback(() => {
    setIsAuthenticated(false);
    setUser(fallbackUser);
    localStorage.removeItem(AUTH_KEY);
    supabase.auth.signOut();
  }, []);

  const switchRole = useCallback(() => {
    setRole((prev) => (prev === "admin" ? "employee" : "admin"));
  }, []);

  const isAdmin = role === "admin";

  // Don't render until hydrated to avoid flash
  if (!hydrated) return null;

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

export function Providers({ children }: { children: ReactNode }) {
  const handleAppReady = useCallback(() => {
    // Dismiss the HTML loading screen
    const loader = document.querySelector(".njd-loader");
    if (loader) {
      loader.classList.add("fade-out");
      loader.addEventListener("transitionend", () => loader.remove());
    }
  }, []);

  return (
    <NextThemeProvider
      attribute={["class", "data-theme"]}
      defaultTheme="light"
      enableSystem={false}
    >
      <SupabaseAuthGuard>
        <LanguageProvider>
          <AuthProvider onReady={handleAppReady}>
            <DataProvider>{children}</DataProvider>
          </AuthProvider>
        </LanguageProvider>
      </SupabaseAuthGuard>
    </NextThemeProvider>
  );
}
