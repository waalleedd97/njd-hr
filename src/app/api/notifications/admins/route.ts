import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://iauulqfgrbegwcnfatmx.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "sb_publishable_Dvk_dI_FY6oxhyOw7__06Q_wzDmwguJ";
const ADMIN_EMAILS = new Set([
  "waleed@njdstudio.net",
  "salman@njdstudio.net",
]);
const ALLOWED_TYPES = new Set([
  "leave",
  "request",
  "payroll",
  "attendance",
  "system",
]);

type AdminNotificationPayload = {
  type: "leave" | "request" | "payroll" | "attendance" | "system";
  titleAr: string;
  titleEn: string;
  descAr: string;
  descEn: string;
  href?: string;
};

async function insertNotifications(
  adminClient: SupabaseClient,
  rows: Array<Record<string, unknown>>
) {
  let { error } = await adminClient
    .from("notifications")
    .insert(rows as never[]);

  if (
    error &&
    (error.message.includes("app_name") ||
      error.message.includes("column") ||
      error.code === "42703")
  ) {
    const fallbackRows = rows.map((row) => {
      const nextRow = { ...row };
      delete nextRow.app_name;
      return nextRow;
    });
    const retry = await adminClient
      .from("notifications")
      .insert(fallbackRows as never[]);
    error = retry.error;
  }

  return { error };
}

async function resolveAdminUserIds(
  adminClient: SupabaseClient
) {
  const adminIds = new Set<string>();

  const { data: roleRows, error: roleError } = await adminClient
    .from("user_roles")
    .select("user_id")
    .eq("role_name", "super_admin");

  if (!roleError) {
    for (const row of (roleRows || []) as Array<{ user_id: string }>) {
      if (row.user_id) adminIds.add(row.user_id);
    }
  }

  const { data: usersData, error: usersError } =
    await adminClient.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });

  if (!usersError) {
    for (const user of usersData.users) {
      if (user.email && ADMIN_EMAILS.has(user.email.toLowerCase())) {
        adminIds.add(user.id);
      }
    }
  }

  return adminIds;
}

export async function POST(req: NextRequest) {
  try {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      return NextResponse.json(
        { error: "SUPABASE_SERVICE_ROLE_KEY not configured" },
        { status: 503 }
      );
    }

    const authHeader = req.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7)
      : null;
    if (!token) {
      return NextResponse.json({ error: "Missing access token" }, { status: 401 });
    }

    let body: AdminNotificationPayload;
    try {
      body = (await req.json()) as AdminNotificationPayload;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    if (
      !body?.type ||
      !ALLOWED_TYPES.has(body.type) ||
      !body.titleAr ||
      !body.titleEn ||
      !body.descAr ||
      !body.descEn
    ) {
      return NextResponse.json(
        { error: "Missing or invalid notification payload" },
        { status: 400 }
      );
    }

    if (body.href !== undefined && typeof body.href !== "string") {
      return NextResponse.json({ error: "Invalid href" }, { status: 400 });
    }

    const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false },
    });
    const {
      data: { user },
      error: userError,
    } = await authClient.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminClient = createClient(SUPABASE_URL, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const adminIds = await resolveAdminUserIds(adminClient);
    if (adminIds.size === 0) {
      return NextResponse.json(
        { error: "No super admin recipients found" },
        { status: 404 }
      );
    }

    const rows = Array.from(adminIds).map((adminId) => ({
      user_id: adminId,
      app_name: "hr",
      type: body.type,
      title_ar: body.titleAr,
      title_en: body.titleEn,
      desc_ar: body.descAr,
      desc_en: body.descEn,
      href: body.href || null,
      read: false,
    }));

    const { error } = await insertNotifications(adminClient, rows);
    if (error) {
      console.error("[HR] admin notifications insert error:", error.message);
      return NextResponse.json(
        { error: "Failed to create admin notifications" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      recipients: rows.length,
    });
  } catch (error) {
    console.error("[HR] admin notifications route error:", error);
    return NextResponse.json(
      { error: "Unexpected notification error" },
      { status: 500 }
    );
  }
}
