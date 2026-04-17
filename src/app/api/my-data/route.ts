import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

/**
 * PDPL Right of Access (نظام حماية البيانات الشخصية السعودي — المادة 9).
 *
 * Employee downloads everything the HR system knows about them: profile,
 * attendance, leaves, requests, salary advances, attendance adjustments,
 * and notifications. Returns a single JSON document.
 *
 * Auth: client sends its session access token as `Authorization: Bearer ...`.
 * We verify the token against Supabase and use the resulting user id — no
 * one can request another employee's data through this endpoint.
 */
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.toLowerCase().startsWith("bearer ")
    ? authHeader.slice(7).trim()
    : "";
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  // Auth client — resolves the user from the token
  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });

  const { data: userData, error: userErr } = await authClient.auth.getUser();
  if (userErr || !userData.user) {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }
  const userId = userData.user.id;
  const email = userData.user.email;

  // All subsequent queries run under the user's JWT → RLS ensures we
  // only return rows the user is permitted to see (their own).
  const [profile, attendance, leaves, requests, advances, adjustments, notifications] =
    await Promise.all([
      authClient.from("profiles").select("*").eq("id", userId).maybeSingle(),
      authClient.from("attendance").select("*").eq("employee_id", userId).order("date", { ascending: false }).limit(1000),
      authClient.from("leave_requests").select("*").eq("employee_id", userId).order("created_at", { ascending: false }),
      authClient.from("employee_requests").select("*").eq("employee_id", userId).order("created_at", { ascending: false }),
      authClient.from("salary_advances").select("*").eq("employee_id", userId).order("created_at", { ascending: false }),
      authClient.from("attendance_adjustments").select("*").eq("employee_id", userId).order("created_at", { ascending: false }),
      authClient.from("notifications").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(500),
    ]);

  const exportDoc = {
    exported_at: new Date().toISOString(),
    subject: { user_id: userId, email },
    profile: profile.data ?? null,
    attendance: attendance.data ?? [],
    leave_requests: leaves.data ?? [],
    employee_requests: requests.data ?? [],
    salary_advances: advances.data ?? [],
    attendance_adjustments: adjustments.data ?? [],
    notifications: notifications.data ?? [],
    notes: "Exported per PDPL (Royal Decree M/19) Article 9 — Right of Access. Audit-timestamp fields are in UTC.",
  };

  return new NextResponse(JSON.stringify(exportDoc, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="njd-hr-my-data-${userId}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
