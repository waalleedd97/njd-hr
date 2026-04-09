import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://iauulqfgrbegwcnfatmx.supabase.co";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_Dvk_dI_FY6oxhyOw7__06Q_wzDmwguJ";

// Hardcoded admin emails as ultimate fallback
const ADMIN_EMAILS = ["waleed@njdstudio.net", "salman@njdstudio.net"];

export async function POST(req: NextRequest) {
  try {
    // 1. Validate service role key exists
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY not configured" }, { status: 503 });
    }

    // 2. Validate caller has a valid session
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) {
      return NextResponse.json({ error: "Missing access token" }, { status: 401 });
    }

    // Verify token
    const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
    const { data: { user }, error: userError } = await anonClient.auth.getUser(token);
    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 3. Parse body
    const body = await req.json().catch(() => null);
    if (!body?.type || !body.titleAr || !body.titleEn) {
      return NextResponse.json({ error: "Missing notification payload" }, { status: 400 });
    }

    // 4. Create admin client (bypasses RLS)
    const adminClient = createClient(SUPABASE_URL, serviceRoleKey, { auth: { persistSession: false } });

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

    // 6. Insert notifications for each admin
    const rows = Array.from(adminIds).map((adminId) => ({
      user_id: adminId,
      app_name: "hr",
      type: body.type,
      title_ar: body.titleAr,
      title_en: body.titleEn,
      desc_ar: body.descAr || "",
      desc_en: body.descEn || "",
      href: body.href || null,
      read: false,
    }));

    // Try insert with all columns
    let { error } = await adminClient.from("notifications").insert(rows);

    // Fallback: remove app_name if column doesn't exist
    if (error && (error.code === "42703" || error.message?.includes("column"))) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const fallbackRows = rows.map(({ app_name: _, ...rest }) => rest);
      const retry = await adminClient.from("notifications").insert(fallbackRows);
      error = retry.error;
    }

    if (error) {
      console.error("[HR] admin notification insert error:", error.message);
      return NextResponse.json({ error: "Failed to insert notifications" }, { status: 500 });
    }

    return NextResponse.json({ success: true, recipients: rows.length });
  } catch (e) {
    console.error("[HR] admin notifications route error:", e);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
