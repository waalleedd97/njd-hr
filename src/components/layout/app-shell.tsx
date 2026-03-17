"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useLanguage, useAuth } from "@/components/providers";
import { adminOnlyPaths } from "@/lib/navigation";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { MobileNav } from "./mobile-nav";
import { Shield, LogIn, Eye, EyeOff, Sun, Moon } from "lucide-react";
import { useTheme } from "next-themes";

// ─── Login Screen ────────────────────────────────────────────────────

function LoginScreen() {
  const { t, lang, dir } = useLanguage();
  const { login } = useAuth();
  const { theme, setTheme } = useTheme();
  const isAr = lang === "ar";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    document.documentElement.dir = dir;
    document.documentElement.lang = lang;
  }, [dir, lang]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const ok = login(email, password);
    if (!ok) setError(true);
  }

  // removed demo accounts

  return (
    <div
      dir={dir}
      className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#F3EEFF] via-background to-[#E8DAFF] dark:from-[#0F0D1A] dark:via-[#1C1828] dark:to-[#0F0D1A] p-4 relative"
    >
      {/* Theme toggle */}
      <button
        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        className="absolute top-4 end-4 w-10 h-10 rounded-xl glass-card flex items-center justify-center hover:scale-105 transition-all"
      >
        {theme === "dark" ? (
          <Sun className="w-5 h-5 text-muted-foreground" />
        ) : (
          <Moon className="w-5 h-5 text-muted-foreground" />
        )}
      </button>

      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Image src="/logo.png" alt="NJD Games" width={64} height={64} className="w-16 h-16 rounded-2xl object-contain mx-auto shadow-lg shadow-primary/25" />
          <h1 className="text-2xl font-bold mt-4 text-foreground">
            {isAr ? "نجد قيمز" : "NJD Games"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t.login.welcome}
          </p>
        </div>

        {/* Login Card */}
        <div className="glass-card rounded-2xl p-6 lg:p-8 shadow-xl">
          <h2 className="text-lg font-bold mb-6">{t.login.title}</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t.login.email}</label>
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError(false);
                }}
                className="h-11 w-full rounded-lg border border-border bg-background px-4 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                placeholder="example@njdstudio.net"
                required
              />
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t.login.password}</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError(false);
                  }}
                  className="h-11 w-full rounded-lg border border-border bg-background px-4 pe-10 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((p) => !p)}
                  className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <p className="text-sm text-red-500 font-medium">
                {t.login.invalidCredentials}
              </p>
            )}

            {/* Submit */}
            <button
              type="submit"
              className="w-full h-11 rounded-lg bg-gradient-to-r from-[#7C52D9] to-[#6C3FC5] text-white font-medium text-sm shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2"
            >
              <LogIn className="w-4 h-4" />
              {t.login.signIn}
            </button>
          </form>

        </div>
      </div>
    </div>
  );
}

// ─── App Shell ───────────────────────────────────────────────────────

export function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const { dir, lang, t } = useLanguage();
  const { role, user, isAuthenticated } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  // Update html dir and lang attributes when language changes
  useEffect(() => {
    document.documentElement.dir = dir;
    document.documentElement.lang = lang;
  }, [dir, lang]);

  // Scroll to top on every route change and after login
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname, isAuthenticated]);

  // Redirect invited employees to profile completion
  const needsProfileCompletion =
    isAuthenticated && user.profileCompleted === false && pathname !== "/profile/complete";

  useEffect(() => {
    if (needsProfileCompletion) {
      router.replace("/profile/complete");
    }
  }, [needsProfileCompletion, router]);

  // Route protection: redirect employees away from admin-only pages
  const isBlocked =
    role === "employee" && adminOnlyPaths.includes(pathname);

  useEffect(() => {
    if (isAuthenticated && isBlocked) {
      const timer = setTimeout(() => router.replace("/"), 1500);
      return () => clearTimeout(timer);
    }
  }, [isBlocked, router, isAuthenticated]);

  // Show login screen if not authenticated
  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  return (
    <div dir={dir} className="flex min-h-screen">
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed((p) => !p)}
      />
      <div className="flex-1 flex flex-col min-h-screen min-w-0">
        <Topbar />
        <main className="flex-1 p-4 lg:p-6 pb-20 lg:pb-6 overflow-x-hidden">
          {isBlocked ? (
            <div className="flex flex-col items-center justify-center h-[60vh] text-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-red-100 dark:bg-red-500/15 flex items-center justify-center">
                <Shield className="w-8 h-8 text-red-500" />
              </div>
              <div>
                <p className="text-lg font-bold text-foreground">
                  {t.role.accessDenied}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
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
  );
}
