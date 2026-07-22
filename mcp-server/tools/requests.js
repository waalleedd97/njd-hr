// Request tools: list_employee_requests, review_employee_request,
// list_salary_advances, review_salary_advance
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

export function register(server, ctx) {
  const { supabase } = ctx;

  server.registerTool(
    "list_employee_requests",
    {
      description: "List general employee requests (letters, documents, etc.). طلبات الموظفين",
      inputSchema: {
        status: z.enum(["pending", "in-review", "approved", "rejected"]).optional(),
        employee_id: z.string().uuid().optional(),
        email: z.string().email().optional(),
        type_key: z.string().optional(),
      },
    },
    withError(async (args) => {
      let employeeId = args.employee_id;
      if (!employeeId && args.email) {
        employeeId = (await resolveEmployee(supabase, args)).user_id;
      }
      let q = supabase
        .from("employee_requests")
        .select("*")
        .order("date", { ascending: false });
      if (args.status) q = q.eq("status", args.status);
      if (args.type_key) q = q.eq("type_key", args.type_key);
      if (employeeId) q = q.eq("employee_id", employeeId);
      const { data, error } = await q;
      throwIfError(error);
      const users = userMap(await listUsers(supabase));
      const requests = (data || []).map((r) => ({
        id: r.id,
        employeeId: r.employee_id,
        ...displayName(users.get(r.employee_id)),
        typeKey: r.type_key,
        date: r.date,
        status: r.status,
        detailsAr: r.details_ar,
        detailsEn: r.details_en,
        reviewedAt: r.reviewed_at,
      }));
      return json({ count: requests.length, requests });
    })
  );

  server.registerTool(
    "review_employee_request",
    {
      description:
        "Set the status of an employee request (approve/reject/in-review). مراجعة طلب موظف",
      inputSchema: {
        request_id: z.string().uuid(),
        action: z.enum(["approve", "reject", "in-review"]),
      },
    },
    withError(async (args) => {
      const statusMap = {
        approve: "approved",
        reject: "rejected",
        "in-review": "in-review",
      };
      const { data: req, error: fetchErr } = await supabase
        .from("employee_requests")
        .select("employee_id, type_key, status")
        .eq("id", args.request_id)
        .single();
      throwIfError(fetchErr);
      const { error } = await supabase
        .from("employee_requests")
        .update({ status: statusMap[args.action], reviewed_at: new Date().toISOString() })
        .eq("id", args.request_id);
      throwIfError(error);
      await ctx.notify.insertNotification(supabase, req.employee_id, {
        type: "request",
        titleAr: "تحديث حالة الطلب",
        titleEn: "Request Status Update",
        bodyAr: `تم تحديث حالة طلبك (${req.type_key}) إلى: ${statusMap[args.action]}`,
        bodyEn: `Your request (${req.type_key}) status is now: ${statusMap[args.action]}`,
        link: "/requests",
      });
      return summary(
        `تم تحديث حالة الطلب إلى «${statusMap[args.action]}»`,
        `Request status set to "${statusMap[args.action]}"`,
        { requestId: args.request_id, employeeId: req.employee_id, status: statusMap[args.action] }
      );
    })
  );

  server.registerTool(
    "list_salary_advances",
    {
      description: "List salary advance requests. طلبات السلف",
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
        .from("salary_advances")
        .select("*")
        .order("request_date", { ascending: false });
      if (args.status) q = q.eq("status", args.status);
      if (employeeId) q = q.eq("employee_id", employeeId);
      const { data, error } = await q;
      throwIfError(error);
      const users = userMap(await listUsers(supabase));
      const advances = (data || []).map((r) => ({
        id: r.id,
        employeeId: r.employee_id,
        ...displayName(users.get(r.employee_id)),
        amount: r.amount,
        reasonAr: r.reason_ar,
        reasonEn: r.reason_en,
        requestDate: r.request_date,
        status: r.status,
        repaymentMonths: r.repayment_months,
        monthlyDeduction: r.monthly_deduction,
        remainingBalance: r.remaining_balance,
        paidMonths: r.paid_months,
      }));
      return json({ count: advances.length, advances });
    })
  );

  server.registerTool(
    "review_salary_advance",
    {
      description:
        "Approve or reject a salary advance. Approval sets monthly deduction and remaining balance. مراجعة طلب سلفة",
      inputSchema: {
        advance_id: z.string().uuid(),
        action: z.enum(["approve", "reject"]),
        repayment_months: z
          .number()
          .int()
          .min(1)
          .max(24)
          .optional()
          .describe("Repayment period in months (default: row value or 3)"),
      },
    },
    withError(async (args) => {
      const { data: adv, error: fetchErr } = await supabase
        .from("salary_advances")
        .select("*")
        .eq("id", args.advance_id)
        .single();
      throwIfError(fetchErr);
      if (adv.status !== "pending") {
        throw new Error(`الطلب تمت مراجعته مسبقاً / Advance already reviewed (${adv.status})`);
      }

      if (args.action === "approve") {
        const months = args.repayment_months || adv.repayment_months || 3;
        const monthly = Math.round((adv.amount / months) * 100) / 100;
        const { error } = await supabase
          .from("salary_advances")
          .update({
            status: "approved",
            repayment_months: months,
            monthly_deduction: monthly,
            remaining_balance: adv.amount,
            paid_months: 0,
            reviewed_at: new Date().toISOString(),
          })
          .eq("id", args.advance_id);
        throwIfError(error);
        await ctx.notify.insertNotification(supabase, adv.employee_id, {
          type: "payroll",
          titleAr: "تمت الموافقة على السلفة",
          titleEn: "Salary Advance Approved",
          bodyAr: `تمت الموافقة على سلفتك بمبلغ ${adv.amount} ريال — قسط شهري ${monthly} ريال لمدة ${months} أشهر`,
          bodyEn: `Your advance of ${adv.amount} SAR was approved — ${monthly} SAR/month for ${months} months`,
          link: "/payroll",
        });
        return summary(
          `تمت الموافقة على السلفة بمبلغ ${adv.amount} ريال — قسط شهري ${monthly} ريال لمدة ${months} أشهر`,
          `Approved advance of ${adv.amount} SAR — ${monthly} SAR/month for ${months} months`,
          { advanceId: adv.id, employeeId: adv.employee_id, amount: adv.amount, monthlyDeduction: monthly, repaymentMonths: months }
        );
      }

      const { error } = await supabase
        .from("salary_advances")
        .update({ status: "rejected", reviewed_at: new Date().toISOString() })
        .eq("id", args.advance_id);
      throwIfError(error);
      await ctx.notify.insertNotification(supabase, adv.employee_id, {
        type: "payroll",
        titleAr: "تم رفض طلب السلفة",
        titleEn: "Salary Advance Rejected",
        bodyAr: `تم رفض طلب السلفة بمبلغ ${adv.amount} ريال`,
        bodyEn: `Your advance request of ${adv.amount} SAR was rejected`,
        link: "/payroll",
      });
      return summary(
        `تم رفض طلب السلفة بمبلغ ${adv.amount} ريال`,
        `Rejected advance request of ${adv.amount} SAR`,
        { advanceId: adv.id, employeeId: adv.employee_id }
      );
    })
  );
}
