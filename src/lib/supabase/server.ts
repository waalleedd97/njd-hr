import { cookies } from "next/headers";
import { createServerClient as createSSRClient } from "@supabase/ssr";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function getSupabaseEnv(): { url: string; anonKey: string } {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error("Supabase env vars missing");
  }
  return { url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY };
}

export async function createServerClient() {
  const cookieStore = await cookies();
  const { url, anonKey } = getSupabaseEnv();
  return createSSRClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // RSC context is read-only for cookies — middleware handles actual refresh.
        }
      },
    },
  });
}
