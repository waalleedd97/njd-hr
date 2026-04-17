import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

/**
 * PDPL Right to Erasure (نظام حماية البيانات الشخصية السعودي — المادة 18).
 *
 * Files an erasure request in `employee_requests` with type `dataErasure`.
 * It does NOT auto-delete because:
 *   - Payroll / tax records must be retained for regulatory periods
 *   - GOSI requires certain data to be held per law
 *   - Attendance records are business records
 *
 * HR reviews the request, performs lawful erasure of what can be removed,
 * and documents what is retained with legal basis.
 */
export async function POST(req: NextRequest) {
  // CSRF: only accept from same origin
  const origin = req.headers.get("origin");
  const referer = req.headers.get("referer");
  const host = req.headers.get("host");
  if (origin || referer) {
    const expectedHost = host ? host.toLowerCase() : "";
    const isSameOrigin = (url: string | null) => {
      if (!url) return false;
      try {
        return new URL(url).host.toLowerCase() === expectedHost;
      } catch {
        return false;
      }
    };
    if (!isSameOrigin(origin) && !isSameOrigin(referer)) {
      return NextResponse.json({ error: "Forbidden: cross-origin request" }, { status: 403 });
    }
  }

  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.toLowerCase().startsWith("bearer ")
    ? authHeader.slice(7).trim()
    : "";
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { reasonAr?: string; reasonEn?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });

  const { data: userData, error: userErr } = await authClient.auth.getUser();
  if (userErr || !userData.user) {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }

  const reasonAr = String(body.reasonAr ?? "طلب حذف البيانات الشخصية وفق نظام حماية البيانات الشخصية").slice(0, 1000);
  const reasonEn = String(body.reasonEn ?? "Personal data erasure request under PDPL").slice(0, 1000);

  const { error } = await authClient.from("employee_requests").insert({
    employee_id: userData.user.id,
    type_key: "dataErasure",
    date: new Date().toISOString().split("T")[0],
    status: "pending",
    details_ar: reasonAr,
    details_en: reasonEn,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, message: "Erasure request filed. HR will review within 30 days." });
}
