import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const ADMIN_EMAILS = ["waleed@njdstudio.net", "salman@njdstudio.net"];

function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !anonKey || !serviceRoleKey) {
    return null;
  }

  return { url, anonKey, serviceRoleKey };
}

/** Escape user-supplied text before interpolating into HTML email template. */
function escapeHtml(input: unknown): string {
  const s = String(input ?? "");
  return s.replace(/[&<>"'`/]/g, (c) => {
    switch (c) {
      case "&": return "&amp;";
      case "<": return "&lt;";
      case ">": return "&gt;";
      case "\"": return "&quot;";
      case "'": return "&#x27;";
      case "`": return "&#x60;";
      case "/": return "&#x2F;";
      default: return c;
    }
  });
}

export async function POST(req: NextRequest) {
  try {
    // CSRF guard: only accept POSTs whose Origin/Referer match the host we serve.
    // This blocks browser-originated cross-site requests that ride along session cookies.
    const origin = req.headers.get("origin");
    const referer = req.headers.get("referer");
    const host = req.headers.get("host");
    if (origin || referer) {
      const expectedHost = host ? host.toLowerCase() : "";
      const isSameOrigin = (url: string | null) => {
        if (!url) return false;
        try {
          const u = new URL(url);
          return u.host.toLowerCase() === expectedHost;
        } catch {
          return false;
        }
      };
      if (!isSameOrigin(origin) && !isSameOrigin(referer)) {
        return NextResponse.json({ error: "Forbidden: cross-origin request" }, { status: 403 });
      }
    }

    const supabaseEnv = getSupabaseEnv();
    if (!supabaseEnv) {
      return NextResponse.json({ error: "Supabase env vars missing" }, { status: 503 });
    }

    const authHeader = req.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) {
      return NextResponse.json({ error: "Missing access token" }, { status: 401 });
    }

    const anonClient = createClient(supabaseEnv.url, supabaseEnv.anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: { user }, error: userError } = await anonClient.auth.getUser(token);
    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminClient = createClient(supabaseEnv.url, supabaseEnv.serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: roleRow, error: roleError } = await adminClient
      .from("user_roles")
      .select("user_id")
      .eq("user_id", user.id)
      .eq("role_name", "super_admin")
      .maybeSingle();

    if (roleError) {
      console.error("[invite] role lookup failed:", roleError.message);
    }

    const isAdmin = Boolean(roleRow) || Boolean(
      user.email && ADMIN_EMAILS.includes(user.email.toLowerCase())
    );
    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden: admin access required" }, { status: 403 });
    }

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "RESEND_API_KEY not configured" }, { status: 503 });
    }
    const resend = new Resend(apiKey);

    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const { email, nameAr, nameEn, positionAr, positionEn, department } = body;

    const isNonEmptyString = (v: unknown): v is string =>
      typeof v === "string" && v.trim().length > 0;

    if (!isNonEmptyString(email) || !isNonEmptyString(nameAr)) {
      return NextResponse.json({ error: "Missing required fields: email, nameAr" }, { status: 400 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
    }

    const missing: string[] = [];
    if (!isNonEmptyString(nameEn)) missing.push("nameEn");
    if (!isNonEmptyString(department)) missing.push("department");
    if (missing.length > 0) {
      return NextResponse.json(
        { error: `Missing required fields: ${missing.join(", ")}` },
        { status: 400 }
      );
    }

    const loginUrl = process.env.NEXT_PUBLIC_APP_URL || "https://njd-hr.vercel.app";

    // Sanitize every user-supplied field before embedding in HTML.
    const safeNameAr = escapeHtml(nameAr);
    const safeNameEn = escapeHtml(nameEn);
    const safePositionAr = escapeHtml(positionAr);
    const safePositionEn = escapeHtml(positionEn);
    const safeDepartment = escapeHtml(department);
    const safeEmail = escapeHtml(email);

    const html = `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f4f1fa;font-family:'Segoe UI',Tahoma,Arial,sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(124,58,237,0.1);">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#8B5CF6,#5B21B6);padding:32px 24px;text-align:center;">
      <h1 style="color:#ffffff;font-size:24px;margin:0 0 4px;">نجد قيمز</h1>
      <p style="color:rgba(255,255,255,0.8);font-size:13px;margin:0;">NJD Games HR</p>
    </div>

    <!-- Body -->
    <div style="padding:32px 24px;">
      <h2 style="color:#1a1a2e;font-size:20px;margin:0 0 8px;">مرحباً ${safeNameAr} 👋</h2>
      <p style="color:#64748b;font-size:15px;line-height:1.7;margin:0 0 24px;">
        يسعدنا دعوتك للانضمام إلى فريق <strong style="color:#7C3AED;">نجد قيمز</strong>!
        تم تسجيلك في نظام الموارد البشرية بالمعلومات التالية:
      </p>

      <!-- Info Card -->
      <div style="background:#f8f6fc;border-radius:12px;padding:20px;margin-bottom:24px;border:1px solid #e9e2f5;">
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:6px 0;color:#64748b;font-size:13px;">الاسم</td>
            <td style="padding:6px 0;color:#1a1a2e;font-size:14px;font-weight:600;text-align:left;">${safeNameAr}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#64748b;font-size:13px;">Name</td>
            <td style="padding:6px 0;color:#1a1a2e;font-size:14px;font-weight:600;text-align:left;">${safeNameEn}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#64748b;font-size:13px;">المسمى الوظيفي</td>
            <td style="padding:6px 0;color:#1a1a2e;font-size:14px;font-weight:600;text-align:left;">${safePositionAr || safePositionEn}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#64748b;font-size:13px;">القسم</td>
            <td style="padding:6px 0;color:#1a1a2e;font-size:14px;font-weight:600;text-align:left;">${safeDepartment}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#64748b;font-size:13px;">البريد الإلكتروني</td>
            <td style="padding:6px 0;color:#1a1a2e;font-size:14px;font-weight:600;text-align:left;" dir="ltr">${safeEmail}</td>
          </tr>
        </table>
      </div>

      <!-- Instructions -->
      <p style="color:#64748b;font-size:14px;line-height:1.7;margin:0 0 8px;">
        لتفعيل حسابك وإكمال بياناتك الشخصية، اضغط على الزر أدناه:
      </p>

      <!-- CTA Button -->
      <div style="text-align:center;margin:24px 0;">
        <a href="${loginUrl}"
           style="display:inline-block;background:linear-gradient(135deg,#8B5CF6,#5B21B6);color:#ffffff;font-size:15px;font-weight:700;padding:14px 40px;border-radius:12px;text-decoration:none;box-shadow:0 4px 16px rgba(147,51,234,0.3);">
          تفعيل الحساب والدخول
        </a>
      </div>

      <p style="color:#94a3b8;font-size:13px;line-height:1.7;margin:24px 0 0;padding-top:16px;border-top:1px solid #e9e2f5;">
        استخدم بريدك الإلكتروني (<strong dir="ltr">${safeEmail}</strong>) لتسجيل الدخول عبر الرابط أعلاه.
        بعد الدخول، سيتم توجيهك لإكمال بياناتك الشخصية.
      </p>
    </div>

    <!-- Footer -->
    <div style="background:#f8f6fc;padding:20px 24px;text-align:center;border-top:1px solid #e9e2f5;">
      <p style="color:#94a3b8;font-size:12px;margin:0;">
        نجد قيمز — نظام الموارد البشرية<br/>
        NJD Games HR Management System
      </p>
    </div>
  </div>
</body>
</html>`;

    const { data, error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || "NJD Games HR <onboarding@resend.dev>",
      to: [email],
      // Subject is a text header (not HTML) but strip control characters to
      // prevent header injection via malicious nameAr (CRLF injection).
      subject: `دعوة للانضمام إلى نجد قيمز — ${String(nameAr).replace(/[\r\n]/g, " ")}`,
      html,
    });

    if (error) {
      console.error("Resend error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, id: data?.id });
  } catch (err) {
    console.error("Invite API error:", err);
    return NextResponse.json({ error: "Failed to send invitation" }, { status: 500 });
  }
}
