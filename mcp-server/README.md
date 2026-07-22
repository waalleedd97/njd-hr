# NJD HR — MCP Server

خادم MCP محلي (stdio) يتيح لمساعد ذكاء اصطناعي إدارة نظام الموارد البشرية بالكامل:
قراءة الحضور والإجازات والطلبات والرواتب والدعوات، وتنفيذ جميع عمليات الكتابة الإدارية.
يتصل مباشرة بمشروع Supabase الإنتاجي عبر مفتاح service-role، ويرسل البريد عبر Resend.

A local stdio MCP server that lets an AI assistant fully manage the NJD HR system:
read attendance, leaves, requests, payroll and invitations, and perform all admin write
operations. It connects directly to the production Supabase project using the
service-role key and sends email via Resend.

## المتطلبات / Requirements

- Node.js 18+
- ملف `.env.local` في **جذر المشروع** (مستوى واحد فوق `mcp-server/`) يحتوي:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `RESEND_API_KEY`
  - `RESEND_FROM_EMAIL` (اختياري — الافتراضي `NJD Games HR <onboarding@resend.dev>`)

The repo-root `.env.local` (one level above `mcp-server/`) must contain the variables above.

## التثبيت / Install

```bash
cd mcp-server
npm install
```

## الاختبار / Test

```bash
npm test
```

يشغّل الخادم عبر stdio، يسرد الأدوات المسجلة، ويستدعي `get_dashboard_stats`
و`list_employees` على قاعدة البيانات الإنتاجية الحية.

Spawns the server over stdio, lists the registered tools, and calls
`get_dashboard_stats` and `list_employees` against the live production database.

## التشغيل ضمن Claude Code / Register with Claude Code

من جذر المشروع / From the repo root:

```bash
claude mcp add njd-hr -- node "/Users/waleed97/Downloads/مشاريع ومجلدات/NJD HR/mcp-server/index.js"
```

## التشغيل ضمن Claude Desktop / Register with Claude Desktop

أضف إلى `claude_desktop_config.json` / Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "njd-hr": {
      "command": "node",
      "args": ["/Users/waleed97/Downloads/مشاريع ومجلدات/NJD HR/mcp-server/index.js"]
    }
  }
}
```

## الأدوات / Tools

| المجموعة / Group | الأدوات / Tools |
|---|---|
| الموظفون / Employees | `list_employees`, `get_employee`, `update_employee_profile` |
| الحضور / Attendance | `get_attendance`, `get_attendance_today`, `record_attendance`, `list_attendance_adjustments`, `review_attendance_adjustment` |
| الإجازات / Leaves | `list_leave_requests`, `approve_leave_request`, `reject_leave_request`, `get_leave_balances`, `adjust_leave_balance` |
| الطلبات / Requests | `list_employee_requests`, `review_employee_request`, `list_salary_advances`, `review_salary_advance` |
| الدعوات / Invitations | `list_invitations`, `send_invitation`, `resend_invitation`, `delete_invitation` |
| الرواتب / Payroll | `get_payroll` |
| التقارير / Reports | `list_daily_reports`, `get_dashboard_stats` |
| الإعدادات والعهد / Settings & Assets | `get_settings`, `send_notification`, `manage_asset`, `list_assets` |

## ملاحظات / Notes

- كل عمليات القراءة والكتابة تتم على قاعدة البيانات الإنتاجية مباشرة — لا يوجد تخزين محلي.
- المنطقة الزمنية للأعمال: `Asia/Riyadh`. مرجع التأخير 10:00 صباحاً.
- أرقام غربية (0-9) فقط في جميع المخرجات.
- All reads/writes hit the production database directly — there is no local store.
- Business timezone is `Asia/Riyadh`; late reference is 10:00 AM.
- Western Arabic numerals (0-9) only in all output.
