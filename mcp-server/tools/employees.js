// Employee tools: list_employees, get_employee, update_employee_profile
import { z } from "zod";
import {
  json,
  summary,
  withError,
  throwIfError,
  listUsers,
  resolveEmployee,
} from "../lib/helpers.js";

// Profile columns the admin is allowed to update (matches the live `profiles` table).
const UPDATABLE_FIELDS = {
  name_ar: z.string().optional(),
  name_en: z.string().optional(),
  full_name_ar: z.string().optional(),
  full_name_en: z.string().optional(),
  phone: z.string().optional(),
  department: z.string().optional(),
  job_title_ar: z.string().optional(),
  job_title_en: z.string().optional(),
  location_required: z.boolean().optional(),
  manager_id: z.string().uuid().nullable().optional(),
  national_id: z.string().optional(),
  employee_number: z.string().optional(),
  date_of_birth: z.string().optional(),
  nationality: z.string().optional(),
  gender: z.string().optional(),
  marital_status: z.string().optional(),
  passport_number: z.string().optional(),
  emergency_phone: z.string().optional(),
  iban: z.string().optional(),
  base_salary: z.number().optional(),
  housing_allowance: z.number().optional(),
  other_allowances: z.number().optional(),
  is_saudi: z.boolean().optional(),
  university_major_ar: z.string().optional(),
  university_major_en: z.string().optional(),
  start_date: z.string().optional(),
};

const employeeRef = {
  employee_id: z.string().uuid().optional().describe("UUID of the employee (auth.users.id)"),
  email: z.string().email().optional().describe("Employee email (alternative to employee_id)"),
};

function mapUser(u) {
  return {
    id: u.user_id,
    email: u.email,
    role: u.role_name || "employee",
    nameAr: u.name_ar || u.full_name_ar || null,
    nameEn: u.name_en || u.full_name_en || null,
    phone: u.phone || null,
    department: u.department || null,
    jobTitleAr: u.job_title_ar || null,
    employeeNumber: u.employee_number || null,
    nationalId: u.national_id || null,
    profileCompleted: u.profile_completed ?? false,
    locationRequired: u.location_required ?? null,
    managerId: u.manager_id || null,
    createdAt: u.created_at || null,
  };
}

export function register(server, ctx) {
  const { supabase } = ctx;

  server.registerTool(
    "list_employees",
    {
      description: "List all employees (from auth + profiles + roles). يعرض قائمة الموظفين",
      inputSchema: {},
    },
    withError(async () => {
      const users = await listUsers(supabase);
      const employees = users.map(mapUser);
      return json({ count: employees.length, employees });
    })
  );

  server.registerTool(
    "get_employee",
    {
      description:
        "Get full profile of one employee by employee_id or email. عرض ملف موظف",
      inputSchema: { ...employeeRef },
    },
    withError(async (args) => {
      const user = await resolveEmployee(supabase, args);
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.user_id)
        .maybeSingle();
      throwIfError(error);
      return json({ employee: mapUser(user), profile: profile || null });
    })
  );

  server.registerTool(
    "update_employee_profile",
    {
      description:
        "Update profile fields for an employee (salary, department, location_required, etc.). تحديث بيانات موظف",
      inputSchema: { ...employeeRef, ...UPDATABLE_FIELDS },
    },
    withError(async (args) => {
      const user = await resolveEmployee(supabase, args);
      const updates = {};
      for (const key of Object.keys(UPDATABLE_FIELDS)) {
        if (args[key] !== undefined) updates[key] = args[key];
      }
      if (Object.keys(updates).length === 0) {
        throw new Error("لم يتم تمرير أي حقل للتحديث / No fields to update were provided");
      }
      const { error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", user.user_id);
      throwIfError(error);
      const name = user.name_ar || user.name_en || user.email;
      return summary(
        `تم تحديث بيانات الموظف ${name} (${Object.keys(updates).length} حقل)`,
        `Updated profile of ${user.email} (${Object.keys(updates).length} field(s))`,
        { employeeId: user.user_id, updatedFields: Object.keys(updates) }
      );
    })
  );
}
