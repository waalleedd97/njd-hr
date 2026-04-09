import { supabase } from "./supabase";

// ─── Types ───────────────────────────────────────────────────────────

export interface SupaNotification {
  id: string;
  user_id: string;
  app_name?: string | null;
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

function buildNotificationInsertCandidates(params: {
  userId: string;
  type: SupaNotification["type"];
  titleAr: string;
  titleEn: string;
  descAr: string;
  descEn: string;
  href?: string;
}) {
  return [
    {
      user_id: params.userId,
      app_name: "hr",
      type: params.type,
      title_ar: params.titleAr,
      title_en: params.titleEn,
      body_ar: params.descAr,
      body_en: params.descEn,
      link: params.href || null,
      is_read: false,
    },
    {
      user_id: params.userId,
      app_name: "hr",
      title_ar: params.titleAr,
      title_en: params.titleEn,
      body_ar: params.descAr,
      body_en: params.descEn,
      link: params.href || null,
      is_read: false,
    },
    {
      user_id: params.userId,
      app_name: "hr",
      type: params.type,
      title_ar: params.titleAr,
      title_en: params.titleEn,
      desc_ar: params.descAr,
      desc_en: params.descEn,
      href: params.href || null,
      read: false,
    },
    {
      user_id: params.userId,
      type: params.type,
      title_ar: params.titleAr,
      title_en: params.titleEn,
      desc_ar: params.descAr,
      desc_en: params.descEn,
      href: params.href || null,
      read: false,
    },
  ];
}

export function normalizeNotificationRow(
  row: Record<string, unknown>
): SupaNotification {
  return {
    id: (row.id as string) || "",
    user_id: (row.user_id as string) || "",
    app_name: (row.app_name as string) || null,
    type: ((row.type as SupaNotification["type"]) || "system"),
    title_ar: (row.title_ar as string) || "",
    title_en: (row.title_en as string) || "",
    desc_ar: ((row.desc_ar as string) || (row.body_ar as string) || ""),
    desc_en: ((row.desc_en as string) || (row.body_en as string) || ""),
    href: ((row.href as string) || (row.link as string) || undefined),
    read: ((row.read as boolean) ?? (row.is_read as boolean) ?? false),
    created_at: (row.created_at as string) || new Date().toISOString(),
  };
}

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
  let error: { message?: string } | null = null;
  for (const candidate of buildNotificationInsertCandidates(params)) {
    const result = await supabase.from("notifications").insert(candidate);
    error = result.error;
    if (!error) break;
  }
  if (error) console.error("[HR] createNotification error:", error.message);
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
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session?.access_token) {
      const response = await fetch("/api/notifications/admins", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(params),
      });

      if (response.ok) {
        return;
      }

      const errorBody = await response
        .json()
        .catch(() => ({ error: "Unknown notification route error" }));
      console.error(
        "[HR] notifyAdmins — API route error:",
        errorBody.error || response.statusText
      );
    }

    const { data: admins, error } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role_name", "super_admin");

    if (error) {
      console.error("[HR] notifyAdmins — user_roles query error:", error.message);
      return;
    }
    if (!admins || admins.length === 0) {
      console.warn("[HR] notifyAdmins — no super_admin users found in user_roles table");
      return;
    }

    await Promise.all(
      admins.map((a) =>
        createNotification({ ...params, userId: a.user_id })
      )
    );
  } catch (e) {
    console.error("[HR] notifyAdmins error:", e);
  }
}

// ─── Fetch Notifications ─────────────────────────────────────────────

export async function fetchNotifications(userId: string) {
  // Try with app_name filter first, fall back without it
  // eslint-disable-next-line prefer-const
  let { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .eq("app_name", "hr")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    // app_name column may not exist — retry without it
    const retry = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);
    data = retry.data;
  }

  return ((data || []) as Record<string, unknown>[]).map(normalizeNotificationRow);
}

export async function markNotificationReadInDB(id: string) {
  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("id", id);

  if (error) {
    await supabase.from("notifications").update({ read: true }).eq("id", id);
  }
}

export async function markAllReadInDB(userId: string) {
  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("user_id", userId)
    .eq("app_name", "hr")
    .eq("is_read", false);

  if (error) {
    await supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", userId)
      .eq("app_name", "hr")
      .eq("read", false);
  }
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
