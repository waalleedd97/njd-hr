import { createServerClient } from "@/lib/supabase/server";
import {
  employees as defaultEmployees,
  branches as defaultBranches,
  roles as defaultRoles,
  complianceItems as defaultCompliance,
} from "@/lib/mock-data";
import type {
  Employee,
  SalaryAdvance,
  AttendanceAdjustment,
  PendingInvitation,
  Branch,
  Role,
  ComplianceItem,
  EmployeeAsset,
} from "@/lib/mock-data";

// ─── Shared types (mirror data-store.tsx) ────────────────────────────

export interface AttRecord {
  id?: string;
  employeeId: string;
  date: string;
  checkIn: string | null;
  checkOut: string | null;
  status: "present" | "absent" | "late" | "on-leave" | "half-day";
}

export interface LeaveBalance {
  typeKey: string;
  total: number;
  used: number;
  remaining: number;
}

export interface LeaveReq {
  id: string;
  employeeId: string;
  typeKey: string;
  startDate: string;
  endDate: string;
  days: number;
  status: "pending" | "approved" | "rejected";
  reasonAr: string;
  reasonEn: string;
}

export interface EmpReq {
  id: string;
  employeeId: string;
  typeKey: string;
  date: string;
  status: "pending" | "in-review" | "approved" | "rejected";
  detailsAr: string;
  detailsEn: string;
}

// ─── Individual collection fetchers ──────────────────────────────────

const trimTime = (t: unknown) => (t ? String(t).slice(0, 5) : null);

const DEFAULT_BALANCES: LeaveBalance[] = [
  { typeKey: "annual", total: 21, used: 0, remaining: 21 },
  { typeKey: "sick", total: 10, used: 0, remaining: 10 },
  { typeKey: "unpaid", total: 30, used: 0, remaining: 30 },
];

export async function fetchTodayAttendance(): Promise<AttRecord[]> {
  try {
    const supabase = await createServerClient();
    const today = new Date().toISOString().split("T")[0];
    const { data } = await supabase
      .from("attendance")
      .select("*")
      .eq("date", today)
      .order("created_at", { ascending: false });
    if (!data) return [];
    return data.map((r: Record<string, unknown>) => ({
      id: r.id as string,
      employeeId: r.employee_id as string,
      date: r.date as string,
      checkIn: trimTime(r.check_in),
      checkOut: trimTime(r.check_out),
      status: ((r.status as string) || "present") as AttRecord["status"],
    }));
  } catch {
    return [];
  }
}

export async function fetchLeaveRequests(): Promise<LeaveReq[]> {
  try {
    const supabase = await createServerClient();
    const { data } = await supabase
      .from("leave_requests")
      .select("*")
      .order("created_at", { ascending: false });
    if (!data) return [];
    return data.map((row: Record<string, unknown>) => ({
      id: row.id as string,
      employeeId: row.employee_id as string,
      typeKey: (row.type as string) || (row.type_key as string) || "annual",
      startDate: row.start_date as string,
      endDate: row.end_date as string,
      days: row.days as number,
      status: row.status as "pending" | "approved" | "rejected",
      reasonAr: (row.reason_ar as string) || (row.reason as string) || "",
      reasonEn: (row.reason_en as string) || (row.reason as string) || "",
    }));
  } catch {
    return [];
  }
}

export async function fetchEmployeeRequests(): Promise<EmpReq[]> {
  try {
    const supabase = await createServerClient();
    const { data } = await supabase
      .from("employee_requests")
      .select("*")
      .order("created_at", { ascending: false });
    if (!data) return [];
    return data.map((r: Record<string, unknown>) => ({
      id: r.id as string,
      employeeId: r.employee_id as string,
      typeKey: r.type_key as string,
      date: r.date as string,
      status: r.status as "pending" | "in-review" | "approved" | "rejected",
      detailsAr: (r.details_ar as string) || "",
      detailsEn: (r.details_en as string) || "",
    }));
  } catch {
    return [];
  }
}

export async function fetchSalaryAdvances(): Promise<SalaryAdvance[]> {
  try {
    const supabase = await createServerClient();
    const { data } = await supabase
      .from("salary_advances")
      .select("*")
      .order("created_at", { ascending: false });
    if (!data) return [];
    return data.map((r: Record<string, unknown>) => ({
      id: r.id as string,
      employeeId: r.employee_id as string,
      amount: r.amount as number,
      reasonAr: (r.reason_ar as string) || "",
      reasonEn: (r.reason_en as string) || "",
      requestDate: r.request_date as string,
      status: r.status as "pending" | "approved" | "rejected",
      repaymentMonths: r.repayment_months as number,
      monthlyDeduction: r.monthly_deduction as number,
      remainingBalance: r.remaining_balance as number,
      paidMonths: r.paid_months as number,
    }));
  } catch {
    return [];
  }
}

export async function fetchAttendanceAdjustments(): Promise<AttendanceAdjustment[]> {
  try {
    const supabase = await createServerClient();
    const { data } = await supabase
      .from("attendance_adjustments")
      .select("*")
      .order("created_at", { ascending: false });
    if (!data) return [];
    return data.map((r: Record<string, unknown>) => ({
      id: r.id as string,
      employeeId: r.employee_id as string,
      date: r.date as string,
      originalIn: (r.original_in as string) || "",
      requestedIn: (r.requested_in as string) || "",
      originalOut: (r.original_out as string) || "",
      requestedOut: (r.requested_out as string) || "",
      reasonAr: (r.reason_ar as string) || "",
      reasonEn: (r.reason_en as string) || "",
      status: r.status as "pending" | "approved" | "rejected",
    }));
  } catch {
    return [];
  }
}

export async function fetchPendingInvitations(): Promise<PendingInvitation[]> {
  try {
    const supabase = await createServerClient();
    const { data } = await supabase
      .from("pending_invitations")
      .select("*")
      .order("created_at", { ascending: false });
    if (!data) return [];
    return data.map((r: Record<string, unknown>) => ({
      id: r.id as string,
      email: r.email as string,
      nameAr: (r.name_ar as string) || "",
      nameEn: (r.name_en as string) || "",
      department: (r.department as string) || "",
      positionAr: (r.position_ar as string) || "",
      positionEn: (r.position_en as string) || "",
      sentDate: r.sent_date as string,
      status: r.status as "pending" | "expired",
    }));
  } catch {
    return [];
  }
}

export async function fetchLeaveBalances(): Promise<LeaveBalance[]> {
  try {
    const supabase = await createServerClient();
    const currentYear = new Date().getFullYear();
    const { data } = await supabase
      .from("leave_balances")
      .select("*")
      .eq("year", currentYear);
    if (!data || data.length === 0) return DEFAULT_BALANCES;
    return data.map((r: Record<string, unknown>) => ({
      typeKey: r.type_key as string,
      total: r.total as number,
      used: r.used as number,
      remaining: (r.total as number) - (r.used as number),
    }));
  } catch {
    return DEFAULT_BALANCES;
  }
}

export async function fetchEmployees(): Promise<Employee[]> {
  try {
    const supabase = await createServerClient();
    const rpcResult = await supabase.rpc("admin_list_users");
    let users:
      | Array<{
          user_id: string;
          email: string;
          created_at: string;
          role_name: string;
          name_ar: string;
          name_en: string;
          full_name_ar: string;
          full_name_en: string;
          phone: string;
          department: string;
          job_title_ar: string;
          profile_completed: boolean;
        }>
      | null = null;

    if (!rpcResult.error && rpcResult.data) {
      users = rpcResult.data;
    } else {
      const res = await supabase
        .from("profiles")
        .select(
          "id, name_ar, name_en, full_name_ar, full_name_en, phone, department, job_title_ar, profile_completed"
        );
      if (res.error || !res.data) return [...defaultEmployees];
      users = res.data.map((p: Record<string, unknown>) => ({
        user_id: p.id as string,
        email: "",
        created_at: "",
        role_name: "employee",
        name_ar: p.name_ar as string,
        name_en: p.name_en as string,
        full_name_ar: p.full_name_ar as string,
        full_name_en: p.full_name_en as string,
        phone: p.phone as string,
        department: p.department as string,
        job_title_ar: p.job_title_ar as string,
        profile_completed: p.profile_completed as boolean,
      }));
    }
    if (!users) return [...defaultEmployees];

    const colors = [
      "bg-blue-500",
      "bg-emerald-500",
      "bg-amber-500",
      "bg-rose-500",
      "bg-purple-500",
      "bg-cyan-500",
      "bg-orange-500",
    ];
    // Enrich with manager_id + commercial_registration from profiles —
    // admin_list_users RPC doesn't return these, so we batch-fetch by ID.
    const userIds = users.map((u) => u.user_id);
    let extras = new Map<string, { managerId: string | null; cr: string | null }>();
    if (userIds.length > 0) {
      const { data: profileExtras } = await supabase
        .from("profiles")
        .select("id, manager_id, commercial_registration")
        .in("id", userIds);
      if (profileExtras) {
        extras = new Map(
          profileExtras.map((p: Record<string, unknown>) => [
            p.id as string,
            {
              managerId: (p.manager_id as string) || null,
              cr: (p.commercial_registration as string) || null,
            },
          ])
        );
      }
    }

    return users.map((u, i): Employee => {
      const firstAr = (u.full_name_ar || u.name_ar || "").trim();
      const firstEn = (u.full_name_en || u.name_en || "").trim();
      const initialsSrc = firstEn || firstAr || u.email || "?";
      const extra = extras.get(u.user_id);
      return {
        id: u.user_id,
        nameAr: firstAr || u.email?.split("@")[0] || "",
        nameEn: firstEn || u.email?.split("@")[0] || "",
        initials: initialsSrc.charAt(0).toUpperCase(),
        email: u.email || "",
        phone: u.phone || "",
        department: u.department || "",
        positionAr: u.job_title_ar || "",
        positionEn: "",
        joinDate: u.created_at ? u.created_at.split("T")[0] : "",
        status: "active",
        salary: { basic: 0, housing: 0, transport: 0, other: 0 },
        color: colors[i % colors.length],
        profileCompleted: u.profile_completed ?? false,
        managerId: extra?.managerId ?? null,
        commercialRegistration: extra?.cr ?? null,
      };
    });
  } catch {
    return [...defaultEmployees];
  }
}

// ─── Slice builders (one per page) ───────────────────────────────────

export interface DashboardSlice {
  todayAttendance: AttRecord[];
  leaveBalances: LeaveBalance[];
  leaveRequests: LeaveReq[];
  employeeRequests: EmpReq[];
  employees: Employee[];
}

export async function fetchDashboardSlice(): Promise<DashboardSlice> {
  const [todayAttendance, leaveBalances, leaveRequests, employeeRequests, employees] =
    await Promise.all([
      fetchTodayAttendance(),
      fetchLeaveBalances(),
      fetchLeaveRequests(),
      fetchEmployeeRequests(),
      fetchEmployees(),
    ]);
  return { todayAttendance, leaveBalances, leaveRequests, employeeRequests, employees };
}

export interface RequestsSlice {
  leaveRequests: LeaveReq[];
  employeeRequests: EmpReq[];
  salaryAdvances: SalaryAdvance[];
  attendanceAdjustments: AttendanceAdjustment[];
  employees: Employee[];
}

export async function fetchRequestsSlice(): Promise<RequestsSlice> {
  const [leaveRequests, employeeRequests, salaryAdvances, attendanceAdjustments, employees] =
    await Promise.all([
      fetchLeaveRequests(),
      fetchEmployeeRequests(),
      fetchSalaryAdvances(),
      fetchAttendanceAdjustments(),
      fetchEmployees(),
    ]);
  return { leaveRequests, employeeRequests, salaryAdvances, attendanceAdjustments, employees };
}

export interface EmployeesSlice {
  employees: Employee[];
  pendingInvitations: PendingInvitation[];
  assets: EmployeeAsset[];
}

export async function fetchEmployeesSlice(): Promise<EmployeesSlice> {
  const [employees, pendingInvitations, assets] = await Promise.all([
    fetchEmployees(),
    fetchPendingInvitations(),
    fetchAssets(),
  ]);
  return { employees, pendingInvitations, assets };
}


export interface PayrollSlice {
  employees: Employee[];
  todayAttendance: AttRecord[];
  salaryAdvances: SalaryAdvance[];
}

export async function fetchPayrollSlice(): Promise<PayrollSlice> {
  const [employees, todayAttendance, salaryAdvances] = await Promise.all([
    fetchEmployees(),
    fetchTodayAttendance(),
    fetchSalaryAdvances(),
  ]);
  return { employees, todayAttendance, salaryAdvances };
}

export interface ReportsSlice {
  employees: Employee[];
  todayAttendance: AttRecord[];
  leaveBalances: LeaveBalance[];
  leaveRequests: LeaveReq[];
}

export async function fetchReportsSlice(): Promise<ReportsSlice> {
  const [employees, todayAttendance, leaveBalances, leaveRequests] = await Promise.all([
    fetchEmployees(),
    fetchTodayAttendance(),
    fetchLeaveBalances(),
    fetchLeaveRequests(),
  ]);
  return { employees, todayAttendance, leaveBalances, leaveRequests };
}

export interface LeavesSlice {
  leaveBalances: LeaveBalance[];
  leaveRequests: LeaveReq[];
  employees: Employee[];
}

export async function fetchLeavesSlice(): Promise<LeavesSlice> {
  const [leaveBalances, leaveRequests, employees] = await Promise.all([
    fetchLeaveBalances(),
    fetchLeaveRequests(),
    fetchEmployees(),
  ]);
  return { leaveBalances, leaveRequests, employees };
}

export interface AttendanceSlice {
  todayAttendance: AttRecord[];
  employees: Employee[];
  attendanceAdjustments: AttendanceAdjustment[];
  locationRequired: boolean;
}

export async function fetchAttendanceSlice(userId: string): Promise<AttendanceSlice> {
  const supabase = await createServerClient();
  const [todayAttendance, employees, attendanceAdjustments, profileRes] = await Promise.all([
    fetchTodayAttendance(),
    fetchEmployees(),
    fetchAttendanceAdjustments(),
    supabase
      .from("profiles")
      .select("location_required")
      .eq("id", userId)
      .maybeSingle(),
  ]);
  const locationRequired =
    (profileRes.data as { location_required?: boolean } | null)?.location_required ?? true;
  return { todayAttendance, employees, attendanceAdjustments, locationRequired };
}

export async function fetchBranches(): Promise<Branch[]> {
  try {
    const supabase = await createServerClient();
    const { data, error } = await supabase
      .from("branches")
      .select("*")
      .order("created_at", { ascending: true });
    if (error || !data) return [...defaultBranches];
    return data.map((r: Record<string, unknown>) => ({
      id: r.id as string,
      nameAr: r.name_ar as string,
      nameEn: r.name_en as string,
      cityAr: r.city_ar as string,
      cityEn: r.city_en as string,
      employeeCount: (r.employee_count as number) ?? 0,
      isMain: (r.is_main as boolean) ?? false,
    }));
  } catch {
    return [...defaultBranches];
  }
}

export async function fetchRoles(): Promise<Role[]> {
  try {
    const supabase = await createServerClient();
    const { data, error } = await supabase
      .from("custom_roles")
      .select("*")
      .order("created_at", { ascending: true });
    if (error || !data) return [...defaultRoles];
    return data.map((r: Record<string, unknown>) => ({
      id: r.id as string,
      nameAr: r.name_ar as string,
      nameEn: r.name_en as string,
      users: (r.user_count as number) ?? 0,
      permissions: Array.isArray(r.permissions) ? (r.permissions as string[]) : [],
    }));
  } catch {
    return [...defaultRoles];
  }
}

export async function fetchCompliance(): Promise<ComplianceItem[]> {
  try {
    const supabase = await createServerClient();
    const { data, error } = await supabase
      .from("compliance_items")
      .select("*")
      .order("id", { ascending: true });
    if (error || !data) return [...defaultCompliance];
    return data.map((r: Record<string, unknown>) => ({
      id: r.id as string,
      titleAr: r.title_ar as string,
      titleEn: r.title_en as string,
      descAr: (r.desc_ar as string) || "",
      descEn: (r.desc_en as string) || "",
      compliant: (r.compliant as boolean) ?? false,
      reviewedAt: (r.reviewed_at as string) || undefined,
    }));
  } catch {
    return [...defaultCompliance];
  }
}

export interface SettingsSlice {
  employees: Employee[];
  pendingInvitations: PendingInvitation[];
  branches: Branch[];
  roles: Role[];
  compliance: ComplianceItem[];
}

export async function fetchSettingsSlice(): Promise<SettingsSlice> {
  const [employees, pendingInvitations, branches, roles, compliance] = await Promise.all([
    fetchEmployees(),
    fetchPendingInvitations(),
    fetchBranches(),
    fetchRoles(),
    fetchCompliance(),
  ]);
  return { employees, pendingInvitations, branches, roles, compliance };
}

// ─── Employee Assets ────────────────────────────────────────────────

export async function fetchAssets(): Promise<EmployeeAsset[]> {
  try {
    const supabase = await createServerClient();
    const { data, error } = await supabase
      .from("employee_assets")
      .select("*")
      .order("issued_at", { ascending: false });
    if (error || !data) return [];
    return data.map((r: Record<string, unknown>) => ({
      id: r.id as string,
      employeeId: r.employee_id as string,
      assetType: r.asset_type as EmployeeAsset["assetType"],
      nameAr: r.name_ar as string,
      nameEn: r.name_en as string,
      serialNumber: (r.serial_number as string) || undefined,
      notes: (r.notes as string) || undefined,
      issuedAt: r.issued_at as string,
      returnedAt: (r.returned_at as string) || null,
      status: (r.status as EmployeeAsset["status"]) || "issued",
      issuedBy: (r.issued_by as string) || null,
    }));
  } catch {
    return [];
  }
}

export interface DailyReportRow {
  id: string;
  userId: string;
  date: string;
  reportText: string;
  createdAt: string;
  attachments: Array<{ name: string; url: string; type: string }>;
}

export interface DailyReportsSlice {
  reports: DailyReportRow[];
  todayAttendance: AttRecord[];
  employees: Employee[];
}

export async function fetchDailyReportsSlice(date: string): Promise<DailyReportsSlice> {
  const supabase = await createServerClient();
  const [reportsRes, todayAttendance, employees] = await Promise.all([
    supabase
      .from("daily_reports")
      .select("*")
      .eq("date", date)
      .order("created_at", { ascending: false }),
    fetchTodayAttendance(),
    fetchEmployees(),
  ]);

  const reports: DailyReportRow[] = [];
  if (reportsRes.data) {
    for (const r of reportsRes.data as Record<string, unknown>[]) {
      const attachmentsRaw = (r.attachments as Array<Record<string, unknown>> | null) || [];
      const attachments: DailyReportRow["attachments"] = [];
      for (const a of attachmentsRaw) {
        const path = a.path as string;
        if (!path) continue;
        const { data: signed } = await supabase.storage
          .from("daily-reports")
          .createSignedUrl(path, 3600);
        attachments.push({
          name: (a.name as string) || path.split("/").pop() || "file",
          type: (a.type as string) || "",
          url: signed?.signedUrl || "",
        });
      }
      reports.push({
        id: r.id as string,
        userId: r.user_id as string,
        date: r.date as string,
        reportText: (r.report_text as string) || "",
        createdAt: r.created_at as string,
        attachments,
      });
    }
  }

  return { reports, todayAttendance, employees };
}
