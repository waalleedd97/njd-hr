import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://iauulqfgrbegwcnfatmx.supabase.co";
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "sb_publishable_Dvk_dI_FY6oxhyOw7__06Q_wzDmwguJ";

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  console.warn(
    "[HR] NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY not set — falling back to hardcoded Landing project. Set both in .env.local for production."
  );
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    detectSessionInUrl: false,
  },
});
