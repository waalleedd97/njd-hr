import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://iauulqfgrbegwcnfatmx.supabase.co";
const supabaseKey = "sb_publishable_Dvk_dI_FY6oxhyOw7__06Q_wzDmwguJ";

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    detectSessionInUrl: false,
  },
});
