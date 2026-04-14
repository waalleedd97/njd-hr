import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://iauulqfgrbegwcnfatmx.supabase.co";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_Dvk_dI_FY6oxhyOw7__06Q_wzDmwguJ";

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
    // 1. Validate service role key exists
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      return NextResponse.json(
        { error: "SUPABASE_SERVICE_ROLE_KEY not configured in .env.local" },
        { status: 503 }
      );
    }

    // 2. Validate caller has a valid session
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) {
      return NextResponse.json({ error: "Missing access token" }, { status: 401 });
    }

    const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
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

    // 4. Create admin client (bypasses RLS)
    const adminClient = createClient(SUPABASE_URL, serviceRoleKey, { auth: { persistSession: false } });

    // 5. Insert notification — using Landing's schema:
    //    body_ar/body_en (not desc_*), link (not href), is_read (not read)
    const row: Record<string, unknown> = {
      user_id: body.userId,
      app_name: "hr",
      type: body.type,
      title_ar: body.titleAr,
      title_en: body.titleEn,
      body_ar: body.descAr || "",
      body_en: body.descEn || "",
      link: body.href || null,
      is_read: false,
    };

    let { error } = await adminClient.from("notifications").insert(row);

    // Fallback: some deployments might use the alternate schema (desc_*, href, read)
    if (error && error.code === "42703") {
      console.warn("[HR] Landing schema mismatch, trying alternate column names:", error.message);
      const alt: Record<string, unknown> = {
        user_id: body.userId,
        app_name: "hr",
        type: body.type,
        title_ar: body.titleAr,
        title_en: body.titleEn,
        desc_ar: body.descAr || "",
        desc_en: body.descEn || "",
        href: body.href || null,
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
