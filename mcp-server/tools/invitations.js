// Invitation tools: list_invitations, send_invitation, resend_invitation, delete_invitation
// Email template mirrors src/app/api/invite/route.ts.
import { z } from "zod";
import {
  json,
  summary,
  withError,
  throwIfError,
  ksaToday,
  escapeHtml,
} from "../lib/helpers.js";
import { RESEND_FROM, APP_URL } from "../lib/supabase.js";

function buildInviteHtml({ nameAr, nameEn, positionAr, positionEn, department, email }) {
  const safeNameAr = escapeHtml(nameAr);
  const safeNameEn = escapeHtml(nameEn);
  const safePositionAr = escapeHtml(positionAr);
  const safePositionEn = escapeHtml(positionEn);
  const safeDepartment = escapeHtml(department);
  const safeEmail = escapeHtml(email);
  const loginUrl = APP_URL;
  return `
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
}

async function sendInviteEmail(ctx, { email, nameAr, nameEn, positionAr, positionEn, department }) {
  const { data, error } = await ctx.resend.emails.send({
    from: RESEND_FROM,
    to: [email],
    subject: `دعوة للانضمام إلى نجد قيمز — ${String(nameAr).replace(/[\r\n]/g, " ")}`,
    html: buildInviteHtml({ nameAr, nameEn, positionAr, positionEn, department, email }),
  });
  if (error) throw new Error(`Resend: ${error.message}`);
  return data?.id;
}

export function register(server, ctx) {
  const { supabase } = ctx;

  server.registerTool(
    "list_invitations",
    {
      description: "List pending/expired employee invitations. الدعوات المعلقة",
      inputSchema: {
        status: z.enum(["pending", "expired"]).optional(),
      },
    },
    withError(async (args) => {
      let q = supabase
        .from("pending_invitations")
        .select("*")
        .order("sent_date", { ascending: false });
      if (args.status) q = q.eq("status", args.status);
      const { data, error } = await q;
      throwIfError(error);
      const invitations = (data || []).map((r) => ({
        id: r.id,
        email: r.email,
        nameAr: r.name_ar,
        nameEn: r.name_en,
        department: r.department,
        positionAr: r.position_ar,
        positionEn: r.position_en,
        sentDate: r.sent_date,
        status: r.status,
      }));
      return json({ count: invitations.length, invitations });
    })
  );

  server.registerTool(
    "send_invitation",
    {
      description:
        "Invite a new employee: creates the invitation row and emails the invite link via Resend. إرسال دعوة موظف جديد",
      inputSchema: {
        email: z.string().email(),
        nameAr: z.string().min(1).describe("Arabic first name"),
        nameEn: z.string().min(1).describe("English first name"),
        department: z.string().min(1).describe("Department key, e.g. software-dev"),
        positionAr: z.string().optional(),
        positionEn: z.string().optional(),
      },
    },
    withError(async (args) => {
      const email = args.email.toLowerCase().trim();

      // 1. Reject duplicates (case-insensitive pending invitation).
      const { data: dup, error: dupErr } = await supabase
        .from("pending_invitations")
        .select("id")
        .ilike("email", email)
        .eq("status", "pending");
      throwIfError(dupErr);
      if (dup && dup.length > 0) {
        throw new Error(
          `توجد دعوة معلقة لهذا البريد مسبقاً / A pending invitation already exists for ${email}`
        );
      }

      // 2. Insert the invitation row.
      const row = {
        email,
        name_ar: args.nameAr,
        name_en: args.nameEn,
        department: args.department,
        position_ar: args.positionAr || null,
        position_en: args.positionEn || null,
        sent_date: ksaToday(),
        status: "pending",
      };
      const { data: inserted, error: insErr } = await supabase
        .from("pending_invitations")
        .insert(row)
        .select("id")
        .single();
      throwIfError(insErr);

      // 3. Send the email; roll back the row on failure.
      try {
        const emailId = await sendInviteEmail(ctx, { email, ...args });
        return summary(
          `تم إرسال الدعوة إلى ${args.nameAr} (${email}) — قسم ${args.department}`,
          `Invitation sent to ${args.nameEn} (${email}) — ${args.department} department`,
          { invitationId: inserted.id, emailId, sentDate: row.sent_date }
        );
      } catch (emailErr) {
        await supabase.from("pending_invitations").delete().eq("id", inserted.id);
        throw emailErr;
      }
    })
  );

  server.registerTool(
    "resend_invitation",
    {
      description:
        "Resend the invitation email for an existing pending invitation. إعادة إرسال دعوة",
      inputSchema: { invitation_id: z.string().uuid() },
    },
    withError(async (args) => {
      const { data: inv, error: fetchErr } = await supabase
        .from("pending_invitations")
        .select("*")
        .eq("id", args.invitation_id)
        .single();
      throwIfError(fetchErr);
      const emailId = await sendInviteEmail(ctx, {
        email: inv.email,
        nameAr: inv.name_ar,
        nameEn: inv.name_en,
        positionAr: inv.position_ar,
        positionEn: inv.position_en,
        department: inv.department,
      });
      const { error: updErr } = await supabase
        .from("pending_invitations")
        .update({ sent_date: ksaToday(), status: "pending" })
        .eq("id", args.invitation_id);
      throwIfError(updErr);
      return summary(
        `تمت إعادة إرسال الدعوة إلى ${inv.name_ar} (${inv.email})`,
        `Resent invitation to ${inv.name_en} (${inv.email})`,
        { invitationId: inv.id, emailId }
      );
    })
  );

  server.registerTool(
    "delete_invitation",
    {
      description: "Delete a pending invitation. حذف دعوة",
      inputSchema: { invitation_id: z.string().uuid() },
    },
    withError(async (args) => {
      const { data: inv, error: fetchErr } = await supabase
        .from("pending_invitations")
        .select("email, name_ar, name_en")
        .eq("id", args.invitation_id)
        .single();
      throwIfError(fetchErr);
      const { error } = await supabase
        .from("pending_invitations")
        .delete()
        .eq("id", args.invitation_id);
      throwIfError(error);
      return summary(
        `تم حذف دعوة ${inv.name_ar} (${inv.email})`,
        `Deleted invitation for ${inv.name_en} (${inv.email})`,
        { invitationId: args.invitation_id }
      );
    })
  );
}
