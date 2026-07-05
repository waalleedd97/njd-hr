import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const ADMIN_EMAILS = ["waleed@njdstudio.net", "salman@njdstudio.net"];
const ALLOWED_NOTIFICATION_TYPES = new Set(["leave", "request", "payroll", "attendance", "system"]);
const MAX_TITLE_LENGTH = 200;
const MAX_BODY_LENGTH = 500;

function capString(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

/**
 * Create a notification for a specific user, bypassing RLS via service role.
 *
 * Used when one user needs to send a notification to another (e.g. admin
 * approving a leave request → notify the employee). Client-side direct
 * inserts fail because RLS only allows users to see/update their own rows,
 * not insert for others.
 */
export async function POST(req: NextRequest) {
  try {
    // 1. Validate Supabase env vars exist
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      return NextResponse.json(
        { error: "Supabase env vars missing" },
        { status: 503 }
      );
    }

    // 2. Validate caller has a valid session
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) {
      return NextResponse.json({ error: "Missing access token" }, { status: 401 });
    }

    const anonClient = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false } });
    const { data: { user }, error: userError } = await anonClient.auth.getUser(token);
    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 3. Parse body
    const body = await req.json().catch(() => null);
    if (!body?.userId || !body.type || !body.titleAr || !body.titleEn) {
      return NextResponse.json(
        { error: "Missing required fields: userId, type, titleAr, titleEn" },
        { status: 400 }
      );
    }

    const type = String(body.type);
    if (!ALLOWED_NOTIFICATION_TYPES.has(type)) {
      return NextResponse.json({ error: "Invalid notification type" }, { status: 400 });
    }

    const payload = {
      userId: String(body.userId),
      type,
      titleAr: capString(body.titleAr, MAX_TITLE_LENGTH),
      titleEn: capString(body.titleEn, MAX_TITLE_LENGTH),
      descAr: capString(body.descAr, MAX_BODY_LENGTH),
      descEn: capString(body.descEn, MAX_BODY_LENGTH),
      href: capString(body.href, MAX_BODY_LENGTH) || null,
    };

    // 4. Create admin client (bypasses RLS)
    const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

    const { data: roleRow, error: roleError } = await adminClient
      .from("user_roles")
      .select("user_id")
      .eq("user_id", user.id)
      .eq("role_name", "super_admin")
      .maybeSingle();
    if (roleError) {
      console.error("[HR] user notification role lookup error:", roleError.message);
    }

    const isAdmin = Boolean(roleRow) || Boolean(
      user.email && ADMIN_EMAILS.includes(user.email.toLowerCase())
    );
    if (!isAdmin && payload.userId !== user.id) {
      return NextResponse.json({ error: "Forbidden: cannot notify another user" }, { status: 403 });
    }

    // 5. Insert notification — using Landing's schema:
    //    body_ar/body_en (not desc_*), link (not href), is_read (not read)
    const row: Record<string, unknown> = {
      user_id: payload.userId,
      app_name: "hr",
      type: payload.type,
      title_ar: payload.titleAr,
      title_en: payload.titleEn,
      body_ar: payload.descAr,
      body_en: payload.descEn,
      link: payload.href,
      is_read: false,
    };

    let { error } = await adminClient.from("notifications").insert(row);

    // Fallback: some deployments might use the alternate schema (desc_*, href, read)
    if (error && error.code === "42703") {
      console.warn("[HR] Landing schema mismatch, trying alternate column names:", error.message);
      const alt: Record<string, unknown> = {
        user_id: payload.userId,
        app_name: "hr",
        type: payload.type,
        title_ar: payload.titleAr,
        title_en: payload.titleEn,
        desc_ar: payload.descAr,
        desc_en: payload.descEn,
        href: payload.href,
        read: false,
      };
      const retry = await adminClient.from("notifications").insert(alt);
      error = retry.error;
    }

    if (error) {
      console.error("[HR] user notification insert error:", error.message, error.code, error.details);
      return NextResponse.json({ error: "Failed to insert notification", detail: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[HR] user notification route error:", e);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
