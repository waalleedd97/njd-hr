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

// ─── Normalize row from Supabase (handles both old and new schemas) ──

export function normalizeNotificationRow(
  row: Record<string, unknown>
): SupaNotification {
  return {
    id: (row.id as string) || "",
    user_id: (row.user_id as string) || "",
    app_name: (row.app_name as string) || null,
    type: (row.type as SupaNotification["type"]) || "system",
    title_ar: (row.title_ar as string) || "",
    title_en: (row.title_en as string) || "",
    desc_ar: (row.desc_ar as string) || (row.body_ar as string) || "",
    desc_en: (row.desc_en as string) || (row.body_en as string) || "",
    href: (row.href as string) || (row.link as string) || undefined,
    read: (row.read as boolean) ?? (row.is_read as boolean) ?? false,
    created_at: (row.created_at as string) || new Date().toISOString(),
  };
}

// ─── Notify Admins (via server-side API route) ──────────────────────
//
// This is the ONLY way to notify admins. It calls the API route which
// uses SUPABASE_SERVICE_ROLE_KEY to bypass RLS and:
// 1. Find all super_admin user IDs from user_roles
// 2. Insert notifications for each admin
//
// The client-side Supabase client CANNOT read user_roles (RLS blocks it).

export async function notifyAdmins(params: {
  type: SupaNotification["type"];
  titleAr: string;
  titleEn: string;
  descAr: string;
  descEn: string;
  href?: string;
}) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      console.warn("[HR] notifyAdmins — no session, skipping");
      return;
    }

    const response = await fetch("/api/notifications/admins", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      if (response.status === 503) {
        console.error(
          "[HR] notifyAdmins failed (503): SUPABASE_SERVICE_ROLE_KEY is not set in .env.local. " +
          "Add it and restart the dev server."
        );
      } else {
        console.error("[HR] notifyAdmins failed:", response.status, body.error || response.statusText);
      }
    }
  } catch (e) {
    console.error("[HR] notifyAdmins error:", e);
  }
}

// ─── Create Single Notification (for employee-targeted notifications) ──
//
// Goes through /api/notifications/user which uses service role to bypass RLS.
// Direct client-side inserts fail because RLS only permits users to manage
// their OWN rows — but we often need to create a notification FOR ANOTHER user
// (e.g. admin approving leave → notify the employee).

export async function createNotification(params: {
  userId: string;
  type: SupaNotification["type"];
  titleAr: string;
  titleEn: string;
  descAr: string;
  descEn: string;
  href?: string;
}) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      console.warn("[HR] createNotification — no session, skipping");
      return { error: new Error("No session") };
    }

    const response = await fetch("/api/notifications/user", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      const err = new Error(body.error || response.statusText);
      if (response.status === 503) {
        console.error(
          "[HR] createNotification failed (503): SUPABASE_SERVICE_ROLE_KEY is not set in .env.local. " +
          "Add it and restart the dev server."
        );
      } else {
        console.error("[HR] createNotification failed:", response.status, body.error || response.statusText, body.detail || "");
      }
      return { error: err };
    }

    return { error: null };
  } catch (e) {
    console.error("[HR] createNotification error:", e);
    return { error: e as Error };
  }
}

// ─── Fetch Notifications ─────────────────────────────────────────────

export async function fetchNotifications(userId: string) {
  // Try with app_name filter first
  // eslint-disable-next-line prefer-const
  let { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .eq("app_name", "hr")
    .order("created_at", { ascending: false })
    .limit(50);

  // Fallback if app_name column doesn't exist
  if (error) {
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

// ─── Mark Read ───────────────────────────────────────────────────────

export async function markNotificationReadInDB(id: string) {
  // Landing schema uses `is_read`; fall back to `read` for alternate deployments
  const { error } = await supabase.from("notifications").update({ is_read: true }).eq("id", id);
  if (error) {
    await supabase.from("notifications").update({ read: true }).eq("id", id);
  }
}

export async function markAllReadInDB(userId: string) {
  // Landing schema uses `is_read`
  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("user_id", userId)
    .eq("is_read", false);

  if (error) {
    await supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", userId)
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
  } catch { /* table may not exist */ }
  return DEFAULT_PREFS;
}

export async function savePreferences(userId: string, prefs: NotificationPreferences) {
  return supabase
    .from("notification_preferences")
    .upsert({ user_id: userId, app_name: "hr", ...prefs }, { onConflict: "user_id,app_name" });
}

// ─── Push Subscription (disabled — needs VAPID key) ─────────────────

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
  console.warn("[HR] Push notifications not configured — VAPID key missing");
  return false;
}
