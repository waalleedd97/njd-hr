// Notification writes into the shared `notifications` table (Landing schema).
// Columns: user_id, app_name ('hr'), type, title_ar, title_en, body_ar, body_en, link, is_read.

import { throwIfError } from "./helpers.js";

const VALID_TYPES = ["general", "leave", "request", "payroll", "attendance", "system"];

/**
 * Insert a single in-app notification for a user.
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @param {string} userId auth.users UUID of the recipient
 * @param {{type?:string, titleAr:string, titleEn:string, bodyAr?:string, bodyEn?:string, link?:string}} n
 */
export async function insertNotification(supabase, userId, n) {
  const type = VALID_TYPES.includes(n.type) ? n.type : "general";
  const { error } = await supabase.from("notifications").insert({
    user_id: userId,
    app_name: "hr",
    type,
    title_ar: n.titleAr,
    title_en: n.titleEn,
    body_ar: n.bodyAr ?? null,
    body_en: n.bodyEn ?? null,
    link: n.link ?? null,
    is_read: false,
  });
  throwIfError(error);
}

/**
 * Send a notification to every super_admin (user_roles.role_name = 'super_admin').
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @param {{type?:string, titleAr:string, titleEn:string, bodyAr?:string, bodyEn?:string, link?:string}} n
 * @returns {Promise<number>} number of admins notified
 */
export async function notifyAdmins(supabase, n) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("user_id")
    .eq("role_name", "super_admin");
  throwIfError(error);
  const admins = data || [];
  for (const a of admins) {
    await insertNotification(supabase, a.user_id, n);
  }
  return admins.length;
}
