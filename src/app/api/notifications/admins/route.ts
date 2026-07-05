import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

// Hardcoded admin emails as ultimate fallback
const ADMIN_EMAILS = ["waleed@njdstudio.net", "salman@njdstudio.net"];
const ALLOWED_NOTIFICATION_TYPES = new Set(["leave", "request", "payroll", "attendance", "system"]);
const MAX_TITLE_LENGTH = 200;
const MAX_BODY_LENGTH = 500;

function capString(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function POST(req: NextRequest) {
  try {
    // 1. Validate Supabase env vars exist
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      return NextResponse.json({ error: "Supabase env vars missing" }, { status: 503 });
    }

    // 2. Validate caller has a valid session
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) {
      return NextResponse.json({ error: "Missing access token" }, { status: 401 });
    }

    // Verify token
    const anonClient = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false } });
    const { data: { user }, error: userError } = await anonClient.auth.getUser(token);
    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 3. Parse body
    const body = await req.json().catch(() => null);
    if (!body?.type || !body.titleAr || !body.titleEn) {
      return NextResponse.json({ error: "Missing notification payload" }, { status: 400 });
    }

    const type = String(body.type);
    if (!ALLOWED_NOTIFICATION_TYPES.has(type)) {
      return NextResponse.json({ error: "Invalid notification type" }, { status: 400 });
    }

    // Employees legitimately use this route to notify admins about leave,
    // request, attendance, and payroll events. Keep it session-gated rather
    // than admin-only, but cap text and whitelist type to reduce abuse impact.
    const payload = {
      type,
      titleAr: capString(body.titleAr, MAX_TITLE_LENGTH),
      titleEn: capString(body.titleEn, MAX_TITLE_LENGTH),
      descAr: capString(body.descAr, MAX_BODY_LENGTH),
      descEn: capString(body.descEn, MAX_BODY_LENGTH),
      href: capString(body.href, MAX_BODY_LENGTH) || null,
    };

    // 4. Create admin client (bypasses RLS)
    const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

    // 5. Find all admin user IDs
    const adminIds = new Set<string>();

    // Method A: Query user_roles table
    const { data: roleRows } = await adminClient
      .from("user_roles")
      .select("user_id")
      .eq("role_name", "super_admin");

    if (roleRows) {
      for (const row of roleRows) {
        if (row.user_id) adminIds.add(row.user_id);
      }
    }

    // Method B: Find by email (fallback)
    if (adminIds.size === 0) {
      const { data: usersData } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 200 });
      if (usersData) {
        for (const u of usersData.users) {
          if (u.email && ADMIN_EMAILS.includes(u.email.toLowerCase())) {
            adminIds.add(u.id);
          }
        }
      }
    }

    if (adminIds.size === 0) {
      return NextResponse.json({ error: "No admin recipients found" }, { status: 404 });
    }

    // 6. Insert notifications for each admin — using Landing's schema:
    //    body_ar/body_en (not desc_*), link (not href), is_read (not read)
    const rows = Array.from(adminIds).map((adminId) => ({
      user_id: adminId,
      app_name: "hr",
      type: payload.type,
      title_ar: payload.titleAr,
      title_en: payload.titleEn,
      body_ar: payload.descAr,
      body_en: payload.descEn,
      link: payload.href,
      is_read: false,
    }));

    let { error } = await adminClient.from("notifications").insert(rows);

    // Fallback: some deployments use alternate schema (desc_*, href, read)
    if (error && error.code === "42703") {
      console.warn("[HR] Landing schema mismatch, trying alternate column names:", error.message);
      const altRows = Array.from(adminIds).map((adminId) => ({
        user_id: adminId,
        app_name: "hr",
        type: payload.type,
        title_ar: payload.titleAr,
        title_en: payload.titleEn,
        desc_ar: payload.descAr,
        desc_en: payload.descEn,
        href: payload.href,
        read: false,
      }));
      const retry = await adminClient.from("notifications").insert(altRows);
      error = retry.error;
    }

    if (error) {
      console.error("[HR] admin notification insert error:", error.message, error.code, error.details);
      return NextResponse.json({ error: "Failed to insert notifications", detail: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, recipients: rows.length });
  } catch (e) {
    console.error("[HR] admin notifications route error:", e);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
