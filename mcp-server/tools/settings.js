// Settings & asset tools: get_settings, send_notification, manage_asset, list_assets
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
  ksaToday,
} from "../lib/helpers.js";

const ASSET_TYPES = ["laptop", "phone", "vehicle", "sim", "access_card", "other"];
const ASSET_STATUSES = ["issued", "returned", "lost", "damaged"];
const NOTIF_TYPES = ["general", "leave", "request", "payroll", "attendance", "system"];

export function register(server, ctx) {
  const { supabase } = ctx;

  server.registerTool(
    "get_settings",
    {
      description:
        "Read company settings, branches, and custom roles. إعدادات الشركة والفروع والأدوار",
      inputSchema: {},
    },
    withError(async () => {
      const [settings, branches, roles] = await Promise.all([
        supabase.from("app_settings").select("key, value"),
        supabase.from("branches").select("*"),
        supabase.from("custom_roles").select("*"),
      ]);
      throwIfError(settings.error);
      throwIfError(branches.error);
      throwIfError(roles.error);
      const settingsMap = {};
      for (const row of settings.data || []) settingsMap[row.key] = row.value;
      return json({
        settings: settingsMap,
        branches: branches.data || [],
        customRoles: roles.data || [],
      });
    })
  );

  server.registerTool(
    "send_notification",
    {
      description:
        "Send an in-app notification to an employee, all employees, or all admins. إرسال إشعار",
      inputSchema: {
        target: z
          .enum(["employee", "admins", "all"])
          .describe("Recipient scope: one employee (needs employee_id/email), all admins, or everyone"),
        employee_id: z.string().uuid().optional(),
        email: z.string().email().optional(),
        type: z.enum(NOTIF_TYPES).default("general"),
        title_ar: z.string().min(1),
        title_en: z.string().min(1),
        body_ar: z.string().optional(),
        body_en: z.string().optional(),
        link: z.string().optional(),
      },
    },
    withError(async (args) => {
      const payload = {
        type: args.type,
        titleAr: args.title_ar,
        titleEn: args.title_en,
        bodyAr: args.body_ar,
        bodyEn: args.body_en,
        link: args.link,
      };
      if (args.target === "admins") {
        const n = await ctx.notify.notifyAdmins(supabase, payload);
        return summary(
          `تم إرسال الإشعار إلى ${n} مدير`,
          `Notification sent to ${n} admin(s)`,
          { recipients: n }
        );
      }
      if (args.target === "all") {
        const users = await listUsers(supabase);
        for (const u of users) {
          await ctx.notify.insertNotification(supabase, u.user_id, payload);
        }
        return summary(
          `تم إرسال الإشعار إلى جميع الموظفين (${users.length})`,
          `Notification sent to all employees (${users.length})`,
          { recipients: users.length }
        );
      }
      const user = await resolveEmployee(supabase, args);
      await ctx.notify.insertNotification(supabase, user.user_id, payload);
      const name = user.name_ar || user.name_en || user.email;
      return summary(
        `تم إرسال الإشعار إلى ${name}`,
        `Notification sent to ${user.email}`,
        { recipients: 1, employeeId: user.user_id }
      );
    })
  );

  server.registerTool(
    "manage_asset",
    {
      description:
        "Issue a company asset to an employee or update an existing asset (return/lost/damaged). إدارة عهد الموظفين",
      inputSchema: {
        action: z.enum(["issue", "update"]),
        asset_id: z.string().uuid().optional().describe("Required for update"),
        employee_id: z.string().uuid().optional().describe("Required for issue"),
        email: z.string().email().optional(),
        asset_type: z.enum(ASSET_TYPES).optional().describe("Required for issue"),
        name_ar: z.string().optional(),
        name_en: z.string().optional(),
        serial_number: z.string().optional(),
        notes: z.string().optional(),
        status: z.enum(ASSET_STATUSES).optional().describe("For update"),
        returned_at: z.string().optional().describe("YYYY-MM-DD, for update"),
      },
    },
    withError(async (args) => {
      if (args.action === "issue") {
        if (!args.asset_type) throw new Error("asset_type مطلوب / asset_type is required");
        const user = await resolveEmployee(supabase, args);
        const row = {
          employee_id: user.user_id,
          asset_type: args.asset_type,
          name_ar: args.name_ar || null,
          name_en: args.name_en || null,
          serial_number: args.serial_number || null,
          notes: args.notes || null,
          issued_at: ksaToday(),
          status: "issued",
        };
        const { data, error } = await supabase
          .from("employee_assets")
          .insert(row)
          .select("id")
          .single();
        throwIfError(error);
        const name = user.name_ar || user.name_en || user.email;
        return summary(
          `تم تسليم عهدة (${args.asset_type}) إلى ${name}`,
          `Issued asset (${args.asset_type}) to ${user.email}`,
          { assetId: data.id, employeeId: user.user_id, issuedAt: row.issued_at }
        );
      }

      if (!args.asset_id) throw new Error("asset_id مطلوب / asset_id is required");
      const updates = {};
      for (const k of ["asset_type", "name_ar", "name_en", "serial_number", "notes", "status"]) {
        if (args[k] !== undefined) updates[k] = args[k];
      }
      if (args.returned_at !== undefined) updates.returned_at = args.returned_at;
      if (args.status && args.status !== "issued" && updates.returned_at === undefined) {
        updates.returned_at = args.status === "returned" ? ksaToday() : null;
      }
      if (Object.keys(updates).length === 0) {
        throw new Error("لم يتم تمرير أي حقل للتحديث / No fields to update were provided");
      }
      const { error } = await supabase
        .from("employee_assets")
        .update(updates)
        .eq("id", args.asset_id);
      throwIfError(error);
      return summary(
        `تم تحديث العهدة (${Object.keys(updates).length} حقل)`,
        `Asset updated (${Object.keys(updates).length} field(s))`,
        { assetId: args.asset_id, updatedFields: Object.keys(updates) }
      );
    })
  );

  server.registerTool(
    "list_assets",
    {
      description: "List company assets issued to employees. عهد الموظفين",
      inputSchema: {
        employee_id: z.string().uuid().optional(),
        email: z.string().email().optional(),
        status: z.enum(ASSET_STATUSES).optional(),
      },
    },
    withError(async (args) => {
      let employeeId = args.employee_id;
      if (!employeeId && args.email) {
        employeeId = (await resolveEmployee(supabase, args)).user_id;
      }
      let q = supabase
        .from("employee_assets")
        .select("*")
        .order("issued_at", { ascending: false });
      if (employeeId) q = q.eq("employee_id", employeeId);
      if (args.status) q = q.eq("status", args.status);
      const { data, error } = await q;
      throwIfError(error);
      const users = userMap(await listUsers(supabase));
      const assets = (data || []).map((r) => ({
        id: r.id,
        employeeId: r.employee_id,
        ...displayName(users.get(r.employee_id)),
        assetType: r.asset_type,
        nameAr: r.name_ar,
        nameEn: r.name_en,
        serialNumber: r.serial_number,
        notes: r.notes,
        issuedAt: r.issued_at,
        returnedAt: r.returned_at,
        status: r.status,
      }));
      return json({ count: assets.length, assets });
    })
  );
}
