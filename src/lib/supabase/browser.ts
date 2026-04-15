"use client";
import { createBrowserClient as createSSRBrowserClient } from "@supabase/ssr";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://iauulqfgrbegwcnfatmx.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "sb_publishable_Dvk_dI_FY6oxhyOw7__06Q_wzDmwguJ";

let cached: ReturnType<typeof createSSRBrowserClient> | null = null;

export function getBrowserClient() {
  if (cached) return cached;
  cached = createSSRBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookieOptions: {
      domain:
        typeof window !== "undefined" &&
        window.location.hostname.endsWith("njd-services.net")
          ? ".njd-services.net"
          : undefined,
      path: "/",
      sameSite: "lax",
      secure: typeof window !== "undefined" && window.location.protocol === "https:",
    },
  });
  return cached;
}
