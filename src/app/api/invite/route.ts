import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "RESEND_API_KEY not configured" }, { status: 500 });
    }
    const resend = new Resend(apiKey);
    const { email, nameAr, nameEn, positionAr, positionEn, department } = await req.json();

    if (!email || !nameAr) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const loginUrl = process.env.NEXT_PUBLIC_APP_URL || "https://njd-hr.vercel.app";

    const html = `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f4f1fa;font-family:'Segoe UI',Tahoma,Arial,sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(108,63,197,0.1);">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#7C52D9,#4C2A8A);padding:32px 24px;text-align:center;">
      <h1 style="color:#ffffff;font-size:24px;margin:0 0 4px;">نجد قيمز</h1>
      <p style="color:rgba(255,255,255,0.8);font-size:13px;margin:0;">NJD Games HR</p>
    </div>

    <!-- Body -->
    <div style="padding:32px 24px;">
      <h2 style="color:#1a1a2e;font-size:20px;margin:0 0 8px;">مرحباً ${nameAr} 👋</h2>
      <p style="color:#64748b;font-size:15px;line-height:1.7;margin:0 0 24px;">
        يسعدنا دعوتك للانضمام إلى فريق <strong style="color:#7C52D9;">نجد قيمز</strong>!
        تم تسجيلك في نظام الموارد البشرية بالمعلومات التالية:
      </p>

      <!-- Info Card -->
      <div style="background:#f8f6fc;border-radius:12px;padding:20px;margin-bottom:24px;border:1px solid #e9e2f5;">
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:6px 0;color:#64748b;font-size:13px;">الاسم</td>
            <td style="padding:6px 0;color:#1a1a2e;font-size:14px;font-weight:600;text-align:left;">${nameAr}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#64748b;font-size:13px;">Name</td>
            <td style="padding:6px 0;color:#1a1a2e;font-size:14px;font-weight:600;text-align:left;">${nameEn}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#64748b;font-size:13px;">المسمى الوظيفي</td>
            <td style="padding:6px 0;color:#1a1a2e;font-size:14px;font-weight:600;text-align:left;">${positionAr || positionEn}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#64748b;font-size:13px;">القسم</td>
            <td style="padding:6px 0;color:#1a1a2e;font-size:14px;font-weight:600;text-align:left;">${department}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#64748b;font-size:13px;">البريد الإلكتروني</td>
            <td style="padding:6px 0;color:#1a1a2e;font-size:14px;font-weight:600;text-align:left;" dir="ltr">${email}</td>
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
           style="display:inline-block;background:linear-gradient(135deg,#7C52D9,#6C3FC5);color:#ffffff;font-size:15px;font-weight:700;padding:14px 40px;border-radius:12px;text-decoration:none;box-shadow:0 4px 16px rgba(108,63,197,0.3);">
          تفعيل الحساب والدخول
        </a>
      </div>

      <p style="color:#94a3b8;font-size:13px;line-height:1.7;margin:24px 0 0;padding-top:16px;border-top:1px solid #e9e2f5;">
        استخدم بريدك الإلكتروني (<strong dir="ltr">${email}</strong>) مع كلمة المرور <strong>demo123</strong> لتسجيل الدخول.
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
      subject: `دعوة للانضمام إلى نجد قيمز — ${nameAr}`,
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
