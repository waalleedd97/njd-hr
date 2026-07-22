// Report tools: list_daily_reports, get_dashboard_stats
import { z } from "zod";
import {
  json,
  withError,
  throwIfError,
  ksaToday,
  resolveEmployee,
  listUsers,
  userMap,
  displayName,
} from "../lib/helpers.js";

export function register(server, ctx) {
  const { supabase } = ctx;

  server.registerTool(
    "list_daily_reports",
    {
      description:
        "List end-of-day daily reports (with submitted/missing filtering). التقارير اليومية",
      inputSchema: {
        date: z.string().optional().describe("YYYY-MM-DD, defaults to KSA today"),
        employee_id: z.string().uuid().optional(),
        email: z.string().email().optional(),
        include_content: z
          .boolean()
          .default(false)
          .describe("Include full report text (default: truncated preview)"),
      },
    },
    withError(async (args) => {
      const date = args.date || ksaToday();
      let userId = args.employee_id;
      if (!userId && args.email) {
        userId = (await resolveEmployee(supabase, args)).user_id;
      }
      let q = supabase
        .from("daily_reports")
        .select("*")
        .eq("report_date", date)
        .order("submitted_at", { ascending: false });
      if (userId) q = q.eq("user_id", userId);
      const { data, error } = await q;
      throwIfError(error);

      const users = await listUsers(supabase);
      const map = userMap(users);
      const reports = (data || []).map((r) => ({
        id: r.id,
        userId: r.user_id,
        email: map.get(r.user_id)?.email || null,
        ...displayName(map.get(r.user_id)),
        reportDate: r.report_date,
        content: args.include_content
          ? r.content
          : String(r.content || "").slice(0, 200),
        attachments: Array.isArray(r.attachments) ? r.attachments.length : 0,
        submittedAt: r.submitted_at,
      }));
      const submitted = new Set(reports.map((r) => r.userId));
      const missing = users
        .filter((u) => !submitted.has(u.user_id))
        .map((u) => ({ userId: u.user_id, email: u.email, ...displayName(u) }));
      return json({ date, submitted: reports.length, missing: missing.length, reports, missingEmployees: missing });
    })
  );

  server.registerTool(
    "get_dashboard_stats",
    {
      description:
        "HR dashboard overview: headcount, today's attendance, pending requests/approvals, invitations. إحصائيات لوحة التحكم",
      inputSchema: {},
    },
    withError(async () => {
      const today = ksaToday();
      const users = await listUsers(supabase);

      const count = async (table, build) => {
        let q = supabase.from(table).select("*", { count: "exact", head: true });
        if (build) q = build(q);
        const { count: c, error } = await q;
        throwIfError(error);
        return c ?? 0;
      };

      const [
        attendanceToday,
        pendingLeaves,
        pendingRequests,
        pendingAdvances,
        pendingAdjustments,
        pendingInvitations,
        reportsToday,
      ] = await Promise.all([
        supabase.from("attendance").select("*").eq("date", today),
        count("leave_requests", (q) => q.eq("status", "pending")),
        count("employee_requests", (q) => q.eq("status", "pending")),
        count("salary_advances", (q) => q.eq("status", "pending")),
        count("attendance_adjustments", (q) => q.eq("status", "pending")),
        count("pending_invitations", (q) => q.eq("status", "pending")),
        count("daily_reports", (q) => q.eq("report_date", today)),
      ]);
      throwIfError(attendanceToday.error);
      const att = attendanceToday.data || [];
      const byStatus = {};
      for (const r of att) byStatus[r.status] = (byStatus[r.status] || 0) + 1;

      return json({
        date: today,
        employees: {
          total: users.length,
          admins: users.filter((u) => u.role_name === "super_admin").length,
        },
        attendanceToday: {
          recorded: att.length,
          byStatus,
          notCheckedIn: users.length - att.length,
        },
        pending: {
          leaveRequests: pendingLeaves,
          employeeRequests: pendingRequests,
          salaryAdvances: pendingAdvances,
          attendanceAdjustments: pendingAdjustments,
          invitations: pendingInvitations,
        },
        dailyReportsToday: reportsToday,
      });
    })
  );
}
