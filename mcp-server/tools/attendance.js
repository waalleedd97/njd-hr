// Attendance tools: get_attendance, get_attendance_today, record_attendance,
// list_attendance_adjustments, review_attendance_adjustment
import { z } from "zod";
import {
  json,
  summary,
  withError,
  throwIfError,
  ksaToday,
  resolveEmployee,
  listUsers,
  userMap,
  displayName,
  minutesLate,
} from "../lib/helpers.js";

const ATTENDANCE_METHODS = ["geofence", "manual", "biometric"];
const ATTENDANCE_STATUSES = ["present", "absent", "late", "on-leave", "half-day"];

function mapRow(r, users) {
  const u = users.get(r.employee_id);
  const late = minutesLate(r.check_in);
  return {
    id: r.id,
    employeeId: r.employee_id,
    ...displayName(u),
    email: u?.email || null,
    date: r.date,
    checkIn: r.check_in,
    checkOut: r.check_out,
    method: r.method,
    status: r.status,
    minutesLate: late > 0 ? late : 0,
    latitude: r.latitude,
    longitude: r.longitude,
  };
}

export function register(server, ctx) {
  const { supabase } = ctx;

  server.registerTool(
    "get_attendance",
    {
      description:
        "Query attendance records with optional filters (employee, date range, status). سجلات الحضور",
      inputSchema: {
        employee_id: z.string().uuid().optional(),
        email: z.string().email().optional(),
        from: z.string().optional().describe("Start date YYYY-MM-DD (inclusive)"),
        to: z.string().optional().describe("End date YYYY-MM-DD (inclusive)"),
        status: z.enum(ATTENDANCE_STATUSES).optional(),
        limit: z.number().int().min(1).max(500).default(100),
      },
    },
    withError(async (args) => {
      let employeeId = args.employee_id;
      if (!employeeId && args.email) {
        employeeId = (await resolveEmployee(supabase, args)).user_id;
      }
      let q = supabase.from("attendance").select("*").order("date", { ascending: false });
      if (employeeId) q = q.eq("employee_id", employeeId);
      if (args.from) q = q.gte("date", args.from);
      if (args.to) q = q.lte("date", args.to);
      if (args.status) q = q.eq("status", args.status);
      q = q.limit(args.limit);
      const { data, error } = await q;
      throwIfError(error);
      const users = userMap(await listUsers(supabase));
      const records = (data || []).map((r) => mapRow(r, users));
      return json({ count: records.length, records });
    })
  );

  server.registerTool(
    "get_attendance_today",
    {
      description:
        "Today's (KSA) attendance for all employees, with counts per status. حضور اليوم",
      inputSchema: {},
    },
    withError(async () => {
      const today = ksaToday();
      const { data, error } = await supabase
        .from("attendance")
        .select("*")
        .eq("date", today);
      throwIfError(error);
      const users = await listUsers(supabase);
      const map = userMap(users);
      const records = (data || []).map((r) => mapRow(r, map));
      const checkedIn = new Set(records.map((r) => r.employeeId));
      const notCheckedIn = users
        .filter((u) => !checkedIn.has(u.user_id))
        .map((u) => ({ employeeId: u.user_id, email: u.email, ...displayName(u) }));
      const byStatus = {};
      for (const r of records) byStatus[r.status] = (byStatus[r.status] || 0) + 1;
      return json({ date: today, total: users.length, byStatus, records, notCheckedIn });
    })
  );

  server.registerTool(
    "record_attendance",
    {
      description:
        "Record/correct an attendance entry (upsert on employee+date). تسجيل حضور يدوي",
      inputSchema: {
        employee_id: z.string().uuid().optional(),
        email: z.string().email().optional(),
        date: z.string().optional().describe("YYYY-MM-DD, defaults to KSA today"),
        check_in: z.string().optional().describe("HH:MM"),
        check_out: z.string().optional().describe("HH:MM"),
        method: z.enum(ATTENDANCE_METHODS).default("manual"),
        status: z.enum(ATTENDANCE_STATUSES).optional(),
      },
    },
    withError(async (args) => {
      const user = await resolveEmployee(supabase, args);
      const date = args.date || ksaToday();
      const row = {
        employee_id: user.user_id,
        date,
        method: args.method,
      };
      if (args.check_in) row.check_in = args.check_in;
      if (args.check_out) row.check_out = args.check_out;
      // Derive status when not given: late if check-in after 10:00 KSA, else present.
      row.status =
        args.status ||
        (args.check_in && minutesLate(args.check_in) > 0 ? "late" : "present");
      const { error } = await supabase
        .from("attendance")
        .upsert(row, { onConflict: "employee_id,date" });
      throwIfError(error);
      const name = user.name_ar || user.name_en || user.email;
      return summary(
        `تم تسجيل حضور ${name} بتاريخ ${date} (دخول ${row.check_in || "-"} / خروج ${row.check_out || "-"} / ${row.status})`,
        `Recorded attendance for ${user.email} on ${date} (in ${row.check_in || "-"} / out ${row.check_out || "-"} / ${row.status})`,
        { employeeId: user.user_id, date, row }
      );
    })
  );

  server.registerTool(
    "list_attendance_adjustments",
    {
      description:
        "List attendance adjustment requests (time-correction requests). طلبات تعديل الحضور",
      inputSchema: {
        status: z.enum(["pending", "approved", "rejected"]).optional(),
        employee_id: z.string().uuid().optional(),
        email: z.string().email().optional(),
      },
    },
    withError(async (args) => {
      let employeeId = args.employee_id;
      if (!employeeId && args.email) {
        employeeId = (await resolveEmployee(supabase, args)).user_id;
      }
      let q = supabase
        .from("attendance_adjustments")
        .select("*")
        .order("date", { ascending: false });
      if (args.status) q = q.eq("status", args.status);
      if (employeeId) q = q.eq("employee_id", employeeId);
      const { data, error } = await q;
      throwIfError(error);
      const users = userMap(await listUsers(supabase));
      const adjustments = (data || []).map((r) => ({
        id: r.id,
        employeeId: r.employee_id,
        ...displayName(users.get(r.employee_id)),
        date: r.date,
        originalIn: r.original_in,
        requestedIn: r.requested_in,
        originalOut: r.original_out,
        requestedOut: r.requested_out,
        reasonAr: r.reason_ar,
        reasonEn: r.reason_en,
        status: r.status,
        reviewedBy: r.reviewed_by,
        reviewedAt: r.reviewed_at,
      }));
      return json({ count: adjustments.length, adjustments });
    })
  );

  server.registerTool(
    "review_attendance_adjustment",
    {
      description:
        "Approve or reject an attendance adjustment. Approving updates the actual attendance row. مراجعة طلب تعديل حضور",
      inputSchema: {
        adjustment_id: z.string().uuid(),
        action: z.enum(["approve", "reject"]),
      },
    },
    withError(async (args) => {
      const { data: adj, error: fetchErr } = await supabase
        .from("attendance_adjustments")
        .select("*")
        .eq("id", args.adjustment_id)
        .single();
      throwIfError(fetchErr);
      if (adj.status !== "pending") {
        throw new Error(`الطلب تمت مراجعته مسبقاً / Adjustment already reviewed (${adj.status})`);
      }
      const newStatus = args.action === "approve" ? "approved" : "rejected";
      const { error } = await supabase
        .from("attendance_adjustments")
        .update({ status: newStatus, reviewed_at: new Date().toISOString() })
        .eq("id", args.adjustment_id);
      throwIfError(error);

      if (args.action === "approve") {
        // Apply the requested times to the actual attendance row (upsert).
        const row = { employee_id: adj.employee_id, date: adj.date };
        if (adj.requested_in) row.check_in = adj.requested_in;
        if (adj.requested_out) row.check_out = adj.requested_out;
        const { error: attErr } = await supabase
          .from("attendance")
          .upsert(row, { onConflict: "employee_id,date" });
        throwIfError(attErr);
        await ctx.notify.insertNotification(supabase, adj.employee_id, {
          type: "attendance",
          titleAr: "تمت الموافقة على تعديل الحضور",
          titleEn: "Attendance Adjustment Approved",
          bodyAr: `تم تعديل سجل حضورك بتاريخ ${adj.date}`,
          bodyEn: `Your attendance record for ${adj.date} has been adjusted`,
          link: "/attendance",
        });
        return summary(
          `تمت الموافقة على تعديل حضور بتاريخ ${adj.date} وتحديث سجل الحضور`,
          `Approved adjustment for ${adj.date} and updated the attendance record`,
          { adjustmentId: adj.id, employeeId: adj.employee_id, date: adj.date }
        );
      }

      await ctx.notify.insertNotification(supabase, adj.employee_id, {
        type: "attendance",
        titleAr: "تم رفض طلب تعديل الحضور",
        titleEn: "Attendance Adjustment Rejected",
        bodyAr: `تم رفض طلب تعديل الحضور بتاريخ ${adj.date}`,
        bodyEn: `Your attendance adjustment request for ${adj.date} was rejected`,
        link: "/attendance",
      });
      return summary(
        `تم رفض طلب تعديل الحضور بتاريخ ${adj.date}`,
        `Rejected adjustment request for ${adj.date}`,
        { adjustmentId: adj.id, employeeId: adj.employee_id }
      );
    })
  );
}
