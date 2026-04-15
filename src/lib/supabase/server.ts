import { cookies } from "next/headers";
import { createServerClient as createSSRClient } from "@supabase/ssr";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://iauulqfgrbegwcnfatmx.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "sb_publishable_Dvk_dI_FY6oxhyOw7__06Q_wzDmwguJ";

export async function createServerClient() {
  const cookieStore = await cookies();
  return createSSRClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
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
