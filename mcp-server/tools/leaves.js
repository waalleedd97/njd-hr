// Leave tools: list_leave_requests, approve_leave_request, reject_leave_request,
// get_leave_balances, adjust_leave_balance
// Approval logic mirrors src/lib/data-store.tsx approveLeaveRequest.
import { z } from "zod";
import {
  json,
  summary,
  withError,
  throwIfError,
  resolveEmployee,
  listUsers,
  userMap,
  displayName,
} from "../lib/helpers.js";

const LEAVE_TYPES = ["annual", "sick", "unpaid", "marriage", "paternity"];
const DEFAULT_TOTALS = { annual: 21, sick: 10, marriage: 7, paternity: 3 };

export function register(server, ctx) {
  const { supabase } = ctx;

  server.registerTool(
    "list_leave_requests",
    {
      description: "List leave requests with optional filters. طلبات الإجازات",
      inputSchema: {
        status: z.enum(["pending", "approved", "rejected"]).optional(),
        employee_id: z.string().uuid().optional(),
        email: z.string().email().optional(),
        type: z.enum(LEAVE_TYPES).optional(),
      },
    },
    withError(async (args) => {
      let employeeId = args.employee_id;
      if (!employeeId && args.email) {
        employeeId = (await resolveEmployee(supabase, args)).user_id;
      }
      let q = supabase
        .from("leave_requests")
        .select("*")
        .order("start_date", { ascending: false });
      if (args.status) q = q.eq("status", args.status);
      if (args.type) q = q.eq("type", args.type);
      if (employeeId) q = q.eq("employee_id", employeeId);
      const { data, error } = await q;
      throwIfError(error);
      const users = userMap(await listUsers(supabase));
      const requests = (data || []).map((r) => ({
        id: r.id,
        employeeId: r.employee_id,
        ...displayName(users.get(r.employee_id)),
        type: r.type,
        startDate: r.start_date,
        endDate: r.end_date,
        days: r.days,
        reason: r.reason,
        status: r.status,
        rejectionReason: r.rejection_reason,
        reviewedAt: r.reviewed_at,
      }));
      return json({ count: requests.length, requests });
    })
  );

  server.registerTool(
    "approve_leave_request",
    {
      description:
        "Approve a pending leave request and deduct from the employee's balance. الموافقة على طلب إجازة",
      inputSchema: { request_id: z.string().uuid() },
    },
    withError(async (args) => {
      const { data: req, error: fetchErr } = await supabase
        .from("leave_requests")
        .select("employee_id, type, days, start_date, status")
        .eq("id", args.request_id)
        .single();
      throwIfError(fetchErr);
      if (req.status === "approved") {
        return summary(
          "الطلب موافق عليه مسبقاً",
          "Request is already approved",
          { requestId: args.request_id }
        );
      }
      if (req.status === "rejected") {
        throw new Error("لا يمكن الموافقة على طلب مرفوض / Cannot approve a rejected request");
      }

      const { error } = await supabase
        .from("leave_requests")
        .update({ status: "approved", reviewed_at: new Date().toISOString() })
        .eq("id", args.request_id);
      throwIfError(error);

      // Deduct from leave_balances (skip 'unpaid'). On failure, revert approval.
      try {
        if (req.type !== "unpaid") {
          const defaultTotal = DEFAULT_TOTALS[req.type];
          if (defaultTotal !== undefined) {
            const balanceYear = new Date(req.start_date).getFullYear();
            const { data: existing, error: balFetchErr } = await supabase
              .from("leave_balances")
              .select("id, used")
              .eq("employee_id", req.employee_id)
              .eq("type_key", req.type)
              .eq("year", balanceYear)
              .maybeSingle();
            throwIfError(balFetchErr);
            if (existing) {
              const { error: balUpdErr } = await supabase
                .from("leave_balances")
                .update({ used: existing.used + req.days })
                .eq("id", existing.id);
              throwIfError(balUpdErr);
            } else {
              const { error: balInsErr } = await supabase
                .from("leave_balances")
                .insert({
                  employee_id: req.employee_id,
                  type_key: req.type,
                  total: defaultTotal,
                  used: req.days,
                  year: balanceYear,
                });
              throwIfError(balInsErr);
            }
          }
        }
      } catch (balanceErr) {
        await supabase
          .from("leave_requests")
          .update({ status: "pending", reviewed_by: null, reviewed_at: null })
          .eq("id", args.request_id);
        throw balanceErr;
      }

      await ctx.notify.insertNotification(supabase, req.employee_id, {
        type: "leave",
        titleAr: "تمت الموافقة على طلب الإجازة",
        titleEn: "Leave Request Approved",
        bodyAr: "تمت الموافقة على طلب إجازتك بنجاح",
        bodyEn: "Your leave request has been approved",
        link: "/leaves",
      });

      return summary(
        `تمت الموافقة على طلب الإجازة (${req.type}, ${req.days} يوم) وتحديث الرصيد`,
        `Approved leave request (${req.type}, ${req.days} day(s)) and updated the balance`,
        { requestId: args.request_id, employeeId: req.employee_id, type: req.type, days: req.days }
      );
    })
  );

  server.registerTool(
    "reject_leave_request",
    {
      description: "Reject a pending leave request with a reason. رفض طلب إجازة",
      inputSchema: {
        request_id: z.string().uuid(),
        reason: z.string().optional().describe("Rejection reason"),
      },
    },
    withError(async (args) => {
      const { data: req, error: fetchErr } = await supabase
        .from("leave_requests")
        .select("employee_id, type, days, status")
        .eq("id", args.request_id)
        .single();
      throwIfError(fetchErr);
      if (req.status !== "pending") {
        throw new Error(`الطلب تمت مراجعته مسبقاً / Request already reviewed (${req.status})`);
      }
      const { error } = await supabase
        .from("leave_requests")
        .update({
          status: "rejected",
          rejection_reason: args.reason || null,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", args.request_id);
      throwIfError(error);
      await ctx.notify.insertNotification(supabase, req.employee_id, {
        type: "leave",
        titleAr: "تم رفض طلب الإجازة",
        titleEn: "Leave Request Rejected",
        bodyAr: args.reason ? `سبب الرفض: ${args.reason}` : "تم رفض طلب إجازتك",
        bodyEn: args.reason ? `Reason: ${args.reason}` : "Your leave request was rejected",
        link: "/leaves",
      });
      return summary(
        `تم رفض طلب الإجازة (${req.type}, ${req.days} يوم)`,
        `Rejected leave request (${req.type}, ${req.days} day(s))`,
        { requestId: args.request_id, employeeId: req.employee_id }
      );
    })
  );

  server.registerTool(
    "get_leave_balances",
    {
      description:
        "Get leave balances (total/used/remaining) for one employee or everyone. أرصدة الإجازات",
      inputSchema: {
        employee_id: z.string().uuid().optional(),
        email: z.string().email().optional(),
        year: z.number().int().optional().describe("Defaults to current KSA year"),
      },
    },
    withError(async (args) => {
      let employeeId = args.employee_id;
      if (!employeeId && args.email) {
        employeeId = (await resolveEmployee(supabase, args)).user_id;
      }
      let q = supabase.from("leave_balances").select("*");
      if (employeeId) q = q.eq("employee_id", employeeId);
      if (args.year) q = q.eq("year", args.year);
      const { data, error } = await q;
      throwIfError(error);
      const users = userMap(await listUsers(supabase));
      const balances = (data || []).map((b) => ({
        employeeId: b.employee_id,
        ...displayName(users.get(b.employee_id)),
        type: b.type_key,
        year: b.year,
        total: b.total,
        used: b.used,
        remaining: b.total - b.used,
      }));
      return json({ count: balances.length, balances });
    })
  );

  server.registerTool(
    "adjust_leave_balance",
    {
      description:
        "Manually set/adjust a leave balance row (upsert on employee+type+year). تعديل رصيد إجازة",
      inputSchema: {
        employee_id: z.string().uuid().optional(),
        email: z.string().email().optional(),
        type: z.enum(LEAVE_TYPES),
        total: z.number().int().min(0).optional(),
        used: z.number().int().min(0).optional(),
        year: z.number().int().optional().describe("Defaults to current KSA year"),
      },
    },
    withError(async (args) => {
      if (args.total === undefined && args.used === undefined) {
        throw new Error("حدد total أو used للتعديل / Provide total or used to adjust");
      }
      const user = await resolveEmployee(supabase, args);
      const year = args.year || new Date().getFullYear();

      const { data: existing, error: fetchErr } = await supabase
        .from("leave_balances")
        .select("id, total, used")
        .eq("employee_id", user.user_id)
        .eq("type_key", args.type)
        .eq("year", year)
        .maybeSingle();
      throwIfError(fetchErr);

      if (existing) {
        const updates = {};
        if (args.total !== undefined) updates.total = args.total;
        if (args.used !== undefined) updates.used = args.used;
        const { error } = await supabase
          .from("leave_balances")
          .update(updates)
          .eq("id", existing.id);
        throwIfError(error);
      } else {
        const { error } = await supabase.from("leave_balances").insert({
          employee_id: user.user_id,
          type_key: args.type,
          total: args.total ?? DEFAULT_TOTALS[args.type] ?? 30,
          used: args.used ?? 0,
          year,
        });
        throwIfError(error);
      }

      const total = args.total ?? existing?.total ?? DEFAULT_TOTALS[args.type] ?? 30;
      const used = args.used ?? existing?.used ?? 0;
      const name = user.name_ar || user.name_en || user.email;
      return summary(
        `تم تعديل رصيد إجازة ${args.type} للموظف ${name} لعام ${year}: ${total - used} متبقي من ${total}`,
        `Adjusted ${args.type} balance for ${user.email} (${year}): ${total - used} remaining of ${total}`,
        { employeeId: user.user_id, type: args.type, year, total, used, remaining: total - used }
      );
    })
  );
}
