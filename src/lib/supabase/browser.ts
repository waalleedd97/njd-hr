"use client";
import { createBrowserClient as createSSRBrowserClient } from "@supabase/ssr";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function getSupabaseEnv(): { url: string; anonKey: string } {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error("Supabase env vars missing");
  }
  return { url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY };
}

let cached: ReturnType<typeof createSSRBrowserClient> | null = null;

export function getBrowserClient() {
  if (cached) return cached;
  const { url, anonKey } = getSupabaseEnv();
  cached = createSSRBrowserClient(url, anonKey, {
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
