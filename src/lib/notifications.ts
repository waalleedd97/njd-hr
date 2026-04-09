import { supabase } from "./supabase";

// ─── Types ───────────────────────────────────────────────────────────

export interface SupaNotification {
  id: string;
  user_id: string;
  app_name: string;
  type: "leave" | "request" | "payroll" | "attendance" | "system";
  title_ar: string;
  title_en: string;
  desc_ar: string;
  desc_en: string;
  href?: string;
  read: boolean;
  created_at: string;
}

export interface NotificationPreferences {
  email_notifications: boolean;
  push_notifications: boolean;
  attendance_reminders: boolean;
  leave_updates: boolean;
  payroll_updates: boolean;
}

const DEFAULT_PREFS: NotificationPreferences = {
  email_notifications: true,
  push_notifications: true,
  attendance_reminders: true,
  leave_updates: true,
  payroll_updates: true,
};

// ─── Create Notification ─────────────────────────────────────────────

export async function createNotification(params: {
  userId: string;
  type: SupaNotification["type"];
  titleAr: string;
  titleEn: string;
  descAr: string;
  descEn: string;
  href?: string;
}) {
  const { error } = await supabase.from("notifications").insert({
    user_id: params.userId,
    app_name: "hr",
    type: params.type,
    title_ar: params.titleAr,
    title_en: params.titleEn,
    desc_ar: params.descAr,
    desc_en: params.descEn,
    href: params.href || null,
    read: false,
  });
  return { error };
}

// Notify all super_admins
export async function notifyAdmins(params: {
  type: SupaNotification["type"];
  titleAr: string;
  titleEn: string;
  descAr: string;
  descEn: string;
  href?: string;
}) {
  try {
    const { data: admins } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role_name", "super_admin");

    if (admins) {
      await Promise.all(
        admins.map((a) =>
          createNotification({ ...params, userId: a.user_id })
        )
      );
    }
  } catch {
    // Graceful fallback if table doesn't exist
  }
}

// ─── Fetch Notifications ─────────────────────────────────────────────

export async function fetchNotifications(userId: string) {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .eq("app_name", "hr")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return [];
  return (data || []) as SupaNotification[];
}

export async function markNotificationReadInDB(id: string) {
  await supabase.from("notifications").update({ read: true }).eq("id", id);
}

export async function markAllReadInDB(userId: string) {
  await supabase
    .from("notifications")
    .update({ read: true })
    .eq("user_id", userId)
    .eq("app_name", "hr")
    .eq("read", false);
}

// ─── Notification Preferences ────────────────────────────────────────

export async function fetchPreferences(userId: string): Promise<NotificationPreferences> {
  try {
    const { data } = await supabase
      .from("notification_preferences")
      .select("*")
      .eq("user_id", userId)
      .eq("app_name", "hr")
      .single();

    if (data) {
      return {
        email_notifications: data.email_notifications ?? true,
        push_notifications: data.push_notifications ?? true,
        attendance_reminders: data.attendance_reminders ?? true,
        leave_updates: data.leave_updates ?? true,
        payroll_updates: data.payroll_updates ?? true,
      };
    }
  } catch {
    // Table may not exist
  }
  return DEFAULT_PREFS;
}

export async function savePreferences(userId: string, prefs: NotificationPreferences) {
  const row = { user_id: userId, app_name: "hr", ...prefs };

  const { error } = await supabase
    .from("notification_preferences")
    .upsert(row, { onConflict: "user_id,app_name" });

  return { error };
}

// ─── Push Subscription ───────────────────────────────────────────────

export async function savePushSubscription(userId: string, subscription: PushSubscription) {
  const sub = subscription.toJSON();
  await supabase.from("push_subscriptions").upsert(
    {
      user_id: userId,
      app_name: "hr",
      endpoint: sub.endpoint,
      p256dh: sub.keys?.p256dh,
      auth: sub.keys?.auth,
    },
    { onConflict: "user_id,app_name" }
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function requestPushPermission(_userId: string): Promise<boolean> {
  // Push notifications require VAPID key pair configuration.
  // Set NEXT_PUBLIC_VAPID_KEY env var to enable.
  console.warn("[HR] Push notifications not configured — VAPID key missing");
  return false;
}
