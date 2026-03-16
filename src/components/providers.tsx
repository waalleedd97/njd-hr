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

function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Language>("ar");

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

/** Admin emails — users in HR department are admins */
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

function AuthProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<UserRole>("admin");
  const [user, setUser] = useState<UserProfile>(fallbackUser);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(AUTH_KEY);
      if (saved) {
        const data = JSON.parse(saved);
        setRole(data.role || "admin");
        setIsAuthenticated(data.isAuthenticated || false);
        if (data.user) setUser(data.user);
      }
    } catch {
      // ignore
    }
    setHydrated(true);
  }, []);

  // Persist auth state
  useEffect(() => {
    if (hydrated) {
      localStorage.setItem(
        AUTH_KEY,
        JSON.stringify({ role, isAuthenticated, user })
      );
    }
  }, [role, isAuthenticated, user, hydrated]);

  const login = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    (email: string, _password: string): boolean => {
      if (!email) return false;
      // Check if this email has a pending invitation — accept it first
      try {
        const saved = localStorage.getItem("njd-hr-data");
        if (saved) {
          const data = JSON.parse(saved);
          const hasInvitation = (data.pendingInvitations || []).some(
            (i: { email: string; status: string }) =>
              i.email.toLowerCase() === email.toLowerCase() && i.status === "pending"
          );
          if (hasInvitation) {
            // Trigger acceptInvitation via a custom event (picked up by DataProvider)
            window.dispatchEvent(new CustomEvent("njd-accept-invitation", { detail: email }));
          }
        }
      } catch { /* ignore */ }
      const resolved = resolveUser(email);
      if (!resolved) return false;
      setUser(resolved.profile);
      setRole(resolved.role);
      setIsAuthenticated(true);
      return true;
    },
    []
  );

  const logout = useCallback(() => {
    setIsAuthenticated(false);
    setUser(fallbackUser);
    localStorage.removeItem(AUTH_KEY);
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
  return (
    <NextThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
    >
      <LanguageProvider>
        <AuthProvider>
          <DataProvider>{children}</DataProvider>
        </AuthProvider>
      </LanguageProvider>
    </NextThemeProvider>
  );
}
