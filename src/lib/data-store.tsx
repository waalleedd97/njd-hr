"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import {
  employees as defaultEmployees,
  departments as defaultDepartments,
  branches as defaultBranches,
  roles as defaultRoles,
  complianceItems as defaultCompliance,
  type Employee,
  type Notification,
  type SalaryAdvance,
  type AttendanceAdjustment,
  type PendingInvitation,
  type Branch,
  type Role,
  type ComplianceItem,
  type EmployeeAsset,
  type AssetType,
} from "./mock-data";
import { createNotification, notifyAdmins } from "./notifications";
import { supabase } from "./supabase";
import { LATE_REFERENCE_HOUR } from "./constants";

// ─── Types ───────────────────────────────────────────────────────────

interface AttRecord {
  id?: string;
  employeeId: string;
  date: string;
  checkIn: string | null;
  checkOut: string | null;
  status: "present" | "absent" | "late" | "on-leave" | "half-day";
}

interface LeaveBalance {
  typeKey: string;
  total: number;
  used: number;
  remaining: number;
}

interface LeaveReq {
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

interface EmpReq {
  id: string;
  employeeId: string;
  typeKey: string;
  date: string;
  status: "pending" | "in-review" | "approved" | "rejected";
  detailsAr: string;
  detailsEn: string;
}

interface AppSettings {
  geofenceEnabled: boolean;
  geofenceRadius: number;
  companyNameAr: string;
  companyNameEn: string;
  crNumber: string;
  addressAr: string;
  addressEn: string;
  cityAr: string;
  cityEn: string;
  countryAr: string;
  countryEn: string;
  industryAr: string;
  industryEn: string;
}

interface DataState {
  employees: Employee[];
  todayAttendance: AttRecord[];
  leaveBalances: LeaveBalance[];
  leaveRequests: LeaveReq[];
  employeeRequests: EmpReq[];
  salaryAdvances: SalaryAdvance[];
  attendanceAdjustments: AttendanceAdjustment[];
  pendingInvitations: PendingInvitation[];
  notifications: Notification[];
  settings: AppSettings;
  payrollProcessed: boolean;
  departments: Record<string, { ar: string; en: string }>;
  branches: Branch[];
  roles: Role[];
  compliance: ComplianceItem[];
  assets: EmployeeAsset[];
}

// ─── Default State ───────────────────────────────────────────────────

function getDefaultState(): DataState {
  return {
    employees: [...defaultEmployees],
    todayAttendance: [],
    leaveBalances: [],
    leaveRequests: [],
    employeeRequests: [],
    salaryAdvances: [],
    attendanceAdjustments: [],
    pendingInvitations: [],
    notifications: [],
    settings: {
      geofenceEnabled: true,
      geofenceRadius: 200,
      companyNameAr: "نجد قيمز",
      companyNameEn: "NJD Games",
      crNumber: "1010XXXXXX",
      addressAr: "طريق الملك فهد",
      addressEn: "King Fahd Road",
      cityAr: "الرياض",
      cityEn: "Riyadh",
      countryAr: "المملكة العربية السعودية",
      countryEn: "Saudi Arabia",
      industryAr: "تطوير الألعاب",
      industryEn: "Game Development",
    },
    payrollProcessed: false,
    departments: { ...defaultDepartments },
    branches: [...defaultBranches],
    roles: [...defaultRoles],
    compliance: [...defaultCompliance],
    assets: [],
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────

let idCounter = 1000;
function genId(prefix: string) {
  return `${prefix}${++idCounter}`;
}

/** Haversine distance in meters between two GPS coords */
export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function getSessionUserId(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user?.id) throw new Error("Not authenticated");
  return session.user.id;
}

// ─── Context ─────────────────────────────────────────────────────────

interface DataContextType extends DataState {
  // true once the initial batch of Supabase refreshes has settled.
  // Guard UI counts/totals against this to avoid rendering transient zeros.
  initialLoaded: boolean;

  /** Merge server-fetched data into the store. Called once per page from views. */
  hydrate: (slice: Partial<DataState>) => void;

  // Attendance (Supabase)
  clockIn: (time: string) => Promise<void>;
  clockOut: (time: string) => Promise<void>;
  refreshAttendance: () => Promise<void>;

  // Leave Requests (Supabase)
  submitLeaveRequest: (req: Omit<LeaveReq, "id">) => Promise<void>;
  refreshLeaveRequests: () => Promise<void>;
  approveLeaveRequest: (id: string) => Promise<void>;
  rejectLeaveRequest: (id: string, reason?: string) => Promise<void>;

  // Employee Requests (Supabase)
  submitEmployeeRequest: (req: Omit<EmpReq, "id">) => Promise<void>;
  refreshEmployeeRequests: () => Promise<void>;

  // Salary Advance (Supabase)
  submitAdvance: (adv: Omit<SalaryAdvance, "id">) => Promise<void>;
  refreshSalaryAdvances: () => Promise<void>;

  // Attendance Adjustment (Supabase)
  submitAdjustment: (adj: Omit<AttendanceAdjustment, "id">) => Promise<void>;
  refreshAttendanceAdjustments: () => Promise<void>;

  // Generic approve/reject (Supabase)
  approveItem: (
    collection: "employeeRequests" | "salaryAdvances" | "attendanceAdjustments",
    id: string
  ) => Promise<void>;
  rejectItem: (
    collection: "employeeRequests" | "salaryAdvances" | "attendanceAdjustments",
    id: string
  ) => Promise<void>;

  // Invitations (Supabase)
  sendInvitation: (inv: Omit<PendingInvitation, "id">) => Promise<void>;
  resendInvitation: (id: string) => Promise<void>;
  refreshInvitations: () => Promise<void>;

  // Leave Balances (Supabase)
  refreshLeaveBalances: () => Promise<void>;

  // Notifications (local cache — Supabase handles persistent ones separately)
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  addNotification: (n: Omit<Notification, "id">) => void;

  // Employees
  updateEmployee: (id: string, updates: Partial<Employee>) => void;

  // Settings (Supabase-backed via app_settings.key='company_settings')
  updateSettings: (updates: Partial<AppSettings>) => Promise<void>;
  refreshSettings: () => Promise<void>;

  // Departments
  addDepartment: (key: string, ar: string, en: string) => void;
  updateDepartment: (key: string, ar: string, en: string) => void;
  removeDepartment: (key: string) => void;

  // Branches (Supabase: branches)
  refreshBranches: () => Promise<void>;
  addBranch: (b: Omit<Branch, "id" | "employeeCount"> & { id?: string }) => Promise<void>;
  updateBranch: (id: string, updates: Partial<Branch>) => Promise<void>;
  removeBranch: (id: string) => Promise<void>;

  // Custom Roles (Supabase: custom_roles)
  refreshRoles: () => Promise<void>;
  addRole: (r: Omit<Role, "id" | "users"> & { id?: string }) => Promise<void>;
  updateRole: (id: string, updates: Partial<Role>) => Promise<void>;
  removeRole: (id: string) => Promise<void>;

  // Compliance Items (Supabase: compliance_items)
  refreshCompliance: () => Promise<void>;
  updateCompliance: (id: string, updates: Partial<ComplianceItem>) => Promise<void>;

  // Employee Assets (Supabase: employee_assets)
  refreshAssets: () => Promise<void>;
  addAsset: (a: Omit<EmployeeAsset, "id" | "issuedBy">) => Promise<void>;
  updateAsset: (id: string, updates: Partial<EmployeeAsset>) => Promise<void>;
  removeAsset: (id: string) => Promise<void>;

  // Manager assignment (writes profiles.manager_id)
  updateEmployeeManager: (employeeId: string, managerId: string | null) => Promise<void>;

  // Profile completion
  acceptInvitation: (email: string) => void;
  completeProfile: (id: string, data: Partial<Employee>) => Promise<void>;

  // Payroll
  processPayroll: () => void;

  // Reset
  resetStore: () => void;
}

const DataContext = createContext<DataContextType | null>(null);

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used within DataProvider");
  return ctx;
}

// ─── Supabase table → collection name mapping ───────────────────────

const SUPA_TABLE: Record<string, string> = {
  employeeRequests: "employee_requests",
  salaryAdvances: "salary_advances",
  attendanceAdjustments: "attendance_adjustments",
};

// ─── Provider ────────────────────────────────────────────────────────

const SETTINGS_KEY = "njd-hr-settings"; // Only settings cached locally

export function DataProvider({
  children,
  initialData,
  seedFromServer = false,
}: {
  children: ReactNode;
  /** Optional server-provided initial data to seed the store with. */
  initialData?: Partial<DataState>;
  /**
   * When true, treat the store as already loaded on first render and skip the
   * 7-way Supabase batch fetch. Pages then hydrate their own slices via
   * `useDataHydration`. Enabled by the server-rendered root layout.
   */
  seedFromServer?: boolean;
}) {
  const [state, setState] = useState<DataState>(() => ({
    ...getDefaultState(),
    ...(initialData ?? {}),
  }));
  const [hydrated, setHydrated] = useState(false);
  const [initialLoaded, setInitialLoaded] = useState(seedFromServer);

  const hydrate = useCallback((slice: Partial<DataState>) => {
    setState((prev) => ({ ...prev, ...slice }));
  }, []);

  // Hydrate settings from localStorage (only settings — everything else from Supabase)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(SETTINGS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setState((prev) => ({
          ...prev,
          settings: { ...prev.settings, ...parsed.settings },
          departments: parsed.departments || prev.departments,
        }));
      }
    } catch { /* ignore */ }
    setHydrated(true);
  }, []);

  // Persist ONLY settings to localStorage
  useEffect(() => {
    if (hydrated) {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify({
        settings: state.settings,
        departments: state.departments,
      }));
    }
  }, [state.settings, state.departments, hydrated]);

  // ── Supabase Refresh Functions ──

  const refreshAttendance = useCallback(async () => {
    try {
      const today = new Date().toISOString().split("T")[0];
      const { data } = await supabase
        .from("attendance")
        .select("*")
        .eq("date", today)
        .order("created_at", { ascending: false });
      if (!data) return;
      // Supabase returns TIME as "HH:MM:SS" — trim to "HH:MM"
      const trimTime = (t: unknown) => t ? String(t).slice(0, 5) : null;
      const mapped: AttRecord[] = data.map((r: Record<string, unknown>) => ({
        id: r.id as string,
        employeeId: r.employee_id as string,
        date: r.date as string,
        checkIn: trimTime(r.check_in),
        checkOut: trimTime(r.check_out),
        status: ((r.status as string) || "present") as AttRecord["status"],
      }));
      setState((prev) => ({ ...prev, todayAttendance: mapped }));
    } catch { /* table may not exist */ }
  }, []);

  const refreshLeaveRequests = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("leave_requests")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) { console.error("[HR] leave_requests fetch error:", error.message); return; }
      if (!data) return;
      const mapped: LeaveReq[] = data.map((row: Record<string, unknown>) => ({
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
      setState((prev) => ({ ...prev, leaveRequests: mapped }));
    } catch { /* */ }
  }, []);

  const refreshEmployeeRequests = useCallback(async () => {
    try {
      const { data } = await supabase
        .from("employee_requests")
        .select("*")
        .order("created_at", { ascending: false });
      if (!data) return;
      const mapped: EmpReq[] = data.map((r: Record<string, unknown>) => ({
        id: r.id as string,
        employeeId: r.employee_id as string,
        typeKey: r.type_key as string,
        date: r.date as string,
        status: r.status as "pending" | "in-review" | "approved" | "rejected",
        detailsAr: (r.details_ar as string) || "",
        detailsEn: (r.details_en as string) || "",
      }));
      setState((prev) => ({ ...prev, employeeRequests: mapped }));
    } catch { /* */ }
  }, []);

  const refreshSalaryAdvances = useCallback(async () => {
    try {
      const { data } = await supabase
        .from("salary_advances")
        .select("*")
        .order("created_at", { ascending: false });
      if (!data) return;
      const mapped: SalaryAdvance[] = data.map((r: Record<string, unknown>) => ({
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
      setState((prev) => ({ ...prev, salaryAdvances: mapped }));
    } catch { /* */ }
  }, []);

  const refreshAttendanceAdjustments = useCallback(async () => {
    try {
      const { data } = await supabase
        .from("attendance_adjustments")
        .select("*")
        .order("created_at", { ascending: false });
      if (!data) return;
      const mapped: AttendanceAdjustment[] = data.map((r: Record<string, unknown>) => ({
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
      setState((prev) => ({ ...prev, attendanceAdjustments: mapped }));
    } catch { /* */ }
  }, []);

  const refreshInvitations = useCallback(async () => {
    try {
      const { data } = await supabase
        .from("pending_invitations")
        .select("*")
        .order("created_at", { ascending: false });
      if (!data) return;
      const mapped: PendingInvitation[] = data.map((r: Record<string, unknown>) => ({
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
      setState((prev) => ({ ...prev, pendingInvitations: mapped }));
    } catch { /* */ }
  }, []);

  // Default leave balances — used when Supabase has no records for this employee/year
  const DEFAULT_BALANCES: LeaveBalance[] = [
    { typeKey: "annual", total: 21, used: 0, remaining: 21 },
    { typeKey: "sick", total: 10, used: 0, remaining: 10 },
    { typeKey: "unpaid", total: 30, used: 0, remaining: 30 },
  ];

  const refreshLeaveBalances = useCallback(async () => {
    try {
      const userId = await getSessionUserId();
      if (!userId) {
        setState((prev) => ({ ...prev, leaveBalances: DEFAULT_BALANCES }));
        return;
      }
      const currentYear = new Date().getFullYear();
      // Filter to the signed-in user. Without this, admin queries return
      // rows for every employee in the system (RLS allows it for admins)
      // and the .map() below collapses by type_key — last write wins,
      // showing essentially random balance numbers to the admin.
      const { data } = await supabase
        .from("leave_balances")
        .select("*")
        .eq("employee_id", userId)
        .eq("year", currentYear);
      const mapped: LeaveBalance[] = (data ?? []).map((r: Record<string, unknown>) => ({
        typeKey: r.type_key as string,
        total: r.total as number,
        used: r.used as number,
        remaining: (r.total as number) - (r.used as number),
      }));
      // Merge with defaults so every type (annual / sick / unpaid) still
      // renders a card even when the employee only has rows for a subset.
      const byType = new Map(mapped.map((b) => [b.typeKey, b]));
      const merged: LeaveBalance[] = DEFAULT_BALANCES.map((def) => byType.get(def.typeKey) ?? def);
      setState((prev) => ({ ...prev, leaveBalances: merged }));
    } catch {
      setState((prev) => prev.leaveBalances.length === 0 ? { ...prev, leaveBalances: DEFAULT_BALANCES } : prev);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Fetch ALL data from Supabase on hydration ──
  // Skipped when server-rendered layout provides seedFromServer — pages hydrate
  // their own slices via useDataHydration instead.

  useEffect(() => {
    if (!hydrated) return;
    if (seedFromServer) return;
    let cancelled = false;
    (async () => {
      await Promise.allSettled([
        refreshAttendance(),
        refreshLeaveRequests(),
        refreshEmployeeRequests(),
        refreshSalaryAdvances(),
        refreshAttendanceAdjustments(),
        refreshInvitations(),
        refreshLeaveBalances(),
      ]);
      if (!cancelled) setInitialLoaded(true);
    })();
    return () => { cancelled = true; };
  }, [hydrated, seedFromServer, refreshAttendance, refreshLeaveRequests, refreshEmployeeRequests, refreshSalaryAdvances, refreshAttendanceAdjustments, refreshInvitations, refreshLeaveBalances]);

  // Sync employees from Supabase
  useEffect(() => {
    if (!hydrated) return;
    async function syncEmployees() {
      try {
        let users: Array<{
          user_id: string; email: string; created_at: string;
          role_name: string; name_ar: string; name_en: string;
          full_name_ar: string; full_name_en: string;
          phone: string; department: string; job_title_ar: string;
          profile_completed: boolean;
        }> | null = null;

        const rpcResult = await supabase.rpc("admin_list_users");
        if (!rpcResult.error && rpcResult.data) {
          users = rpcResult.data;
        } else {
          const res = await supabase.from("profiles").select("id, name_ar, name_en, full_name_ar, full_name_en, phone, department, job_title_ar, profile_completed");
          if (res.error || !res.data) return;
          users = res.data.map((p: Record<string, unknown>) => ({
            user_id: p.id as string, email: "", created_at: "",
            role_name: "employee", name_ar: p.name_ar as string, name_en: p.name_en as string,
            full_name_ar: p.full_name_ar as string, full_name_en: p.full_name_en as string,
            phone: p.phone as string, department: p.department as string,
            job_title_ar: p.job_title_ar as string, profile_completed: p.profile_completed as boolean,
          }));
        }
        if (!users) return;

        setState((prev) => {
          const today = new Date().toISOString().split("T")[0];
          const incomingEmails = new Set(
            users
              .map((u) => (u.email || "").toLowerCase())
              .filter(Boolean)
          );
          const incomingIds = new Set(users.map((u) => u.user_id));

          const retainedEmployees = prev.employees.filter((emp) => {
            const email = emp.email.toLowerCase();
            if (incomingIds.has(emp.id)) return false;
            if (email && incomingEmails.has(email)) return false;
            return true;
          });

          const syncedEmployees: Employee[] = users.map((u) => {
            const email = (u.email || "").toLowerCase();
            const existing = prev.employees.find(
              (emp) => emp.id === u.user_id || (email && emp.email.toLowerCase() === email)
            );
            const fallbackLabel = u.email
              ? u.email.split("@")[0]
              : u.user_id.slice(0, 8).toUpperCase();
            const resolvedNameAr =
              u.name_ar ||
              u.full_name_ar ||
              existing?.nameAr ||
              existing?.fullNameAr ||
              fallbackLabel;
            const resolvedNameEn =
              u.name_en ||
              u.full_name_en ||
              existing?.nameEn ||
              existing?.fullNameEn ||
              fallbackLabel;

            return {
              ...(existing ?? {}),
              id: u.user_id,
              nameAr: resolvedNameAr,
              nameEn: resolvedNameEn,
              fullNameAr: u.full_name_ar || existing?.fullNameAr || resolvedNameAr,
              fullNameEn: u.full_name_en || existing?.fullNameEn || resolvedNameEn,
              positionAr:
                u.job_title_ar ||
                existing?.positionAr ||
                (u.role_name === "super_admin" ? "مدير النظام" : "موظف"),
              positionEn:
                existing?.positionEn ||
                (u.role_name === "super_admin" ? "System Administrator" : "Employee"),
              department: u.department || existing?.department || "",
              email: u.email || existing?.email || "",
              phone: u.phone || existing?.phone || existing?.mobileNumber || "",
              status: existing?.status || "active",
              joinDate: u.created_at
                ? u.created_at.split("T")[0]
                : existing?.joinDate || today,
              salary: existing?.salary || {
                basic: 0,
                housing: 0,
                transport: 0,
                other: 0,
              },
              initials:
                existing?.initials ||
                resolvedNameAr.charAt(0).toUpperCase() ||
                resolvedNameEn.charAt(0).toUpperCase() ||
                fallbackLabel.charAt(0).toUpperCase(),
              color: existing?.color || "bg-primary",
              profileCompleted:
                u.profile_completed ?? existing?.profileCompleted ?? false,
            };
          });

          return {
            ...prev,
            employees: [...retainedEmployees, ...syncedEmployees],
          };
        });
      } catch { /* */ }
    }
    syncEmployees();
  }, [hydrated]);

  // Listen for invitation acceptance from AuthProvider
  useEffect(() => {
    function handleAccept(e: Event) {
      const email = (e as CustomEvent).detail;
      if (email) acceptInvitation(email);
    }
    window.addEventListener("njd-accept-invitation", handleAccept);
    return () => window.removeEventListener("njd-accept-invitation", handleAccept);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Attendance Actions (Supabase) ──

  const clockIn = useCallback(async (time: string) => {
    const userId = await getSessionUserId();
    const today = new Date().toISOString().split("T")[0];

    // Derive status from check-in time. Anything after 10:00 KSA is "late" —
    // payroll then reads the time itself and applies the right penalty band
    // (grace / warning / 5% / 10%) via calcPenalty(). The grace period only
    // suppresses the *deduction*; the badge still flags lateness so the admin
    // and the employee see the truth on the roster.
    const [h, m] = time.split(":").map(Number);
    const checkInMinutes = (h ?? 0) * 60 + (m ?? 0);
    const status: AttRecord["status"] =
      checkInMinutes > LATE_REFERENCE_HOUR * 60 ? "late" : "present";

    await supabase.from("attendance").upsert({
      employee_id: userId,
      date: today,
      check_in: time,
      status,
      method: "geofence",
    }, { onConflict: "employee_id,date" });

    await refreshAttendance();
  }, [refreshAttendance]);

  const clockOut = useCallback(async (time: string) => {
    const userId = await getSessionUserId();
    const today = new Date().toISOString().split("T")[0];

    await supabase.from("attendance")
      .update({ check_out: time })
      .eq("employee_id", userId)
      .eq("date", today);

    await refreshAttendance();
  }, [refreshAttendance]);

  // ── Leave Requests (Supabase) ──

  // ── Row mappers (snake_case Supabase row → camelCase app shape) ──
  // Shared between refresh* (bulk) and submit* (single inserted row).

  const mapLeaveRow = (row: Record<string, unknown>): LeaveReq => ({
    id: row.id as string,
    employeeId: row.employee_id as string,
    typeKey: (row.type as string) || (row.type_key as string) || "annual",
    startDate: row.start_date as string,
    endDate: row.end_date as string,
    days: row.days as number,
    status: row.status as "pending" | "approved" | "rejected",
    reasonAr: (row.reason_ar as string) || (row.reason as string) || "",
    reasonEn: (row.reason_en as string) || (row.reason as string) || "",
  });

  const mapEmpReqRow = (row: Record<string, unknown>): EmpReq => ({
    id: row.id as string,
    employeeId: row.employee_id as string,
    typeKey: row.type_key as string,
    date: row.date as string,
    status: row.status as "pending" | "in-review" | "approved" | "rejected",
    detailsAr: (row.details_ar as string) || "",
    detailsEn: (row.details_en as string) || "",
  });

  const mapAdvanceRow = (row: Record<string, unknown>): SalaryAdvance => ({
    id: row.id as string,
    employeeId: row.employee_id as string,
    amount: row.amount as number,
    reasonAr: (row.reason_ar as string) || "",
    reasonEn: (row.reason_en as string) || "",
    requestDate: row.request_date as string,
    status: row.status as "pending" | "approved" | "rejected",
    repaymentMonths: row.repayment_months as number,
    monthlyDeduction: row.monthly_deduction as number,
    remainingBalance: row.remaining_balance as number,
    paidMonths: row.paid_months as number,
  });

  const mapAdjustmentRow = (row: Record<string, unknown>): AttendanceAdjustment => ({
    id: row.id as string,
    employeeId: row.employee_id as string,
    date: row.date as string,
    originalIn: (row.original_in as string) || "",
    requestedIn: (row.requested_in as string) || "",
    originalOut: (row.original_out as string) || "",
    requestedOut: (row.requested_out as string) || "",
    reasonAr: (row.reason_ar as string) || "",
    reasonEn: (row.reason_en as string) || "",
    status: row.status as "pending" | "approved" | "rejected",
  });

  const mapInvitationRow = (row: Record<string, unknown>): PendingInvitation => ({
    id: row.id as string,
    email: row.email as string,
    nameAr: (row.name_ar as string) || "",
    nameEn: (row.name_en as string) || "",
    department: (row.department as string) || "",
    positionAr: (row.position_ar as string) || "",
    positionEn: (row.position_en as string) || "",
    sentDate: row.sent_date as string,
    status: row.status as "pending" | "expired",
  });

  // Fire-and-forget notification — logs failures but never rejects the caller.
  const notifyAdminsBG = (params: Parameters<typeof notifyAdmins>[0]) => {
    notifyAdmins(params).catch((e) =>
      console.error("[HR] notifyAdmins (non-blocking) failed:", e)
    );
  };
  const notifyUserBG = (params: Parameters<typeof createNotification>[0]) => {
    createNotification(params).catch((e) =>
      console.error("[HR] createNotification (non-blocking) failed:", e)
    );
  };

  const submitLeaveRequest = useCallback(async (req: Omit<LeaveReq, "id">) => {
    const userId = await getSessionUserId();

    // Try the new schema (migration 004: `type` + `reason`); fall back to `type_key` + `reason_ar/en`.
    let { data, error } = await supabase.from("leave_requests").insert({
      employee_id: userId,
      type: req.typeKey,
      start_date: req.startDate,
      end_date: req.endDate,
      days: req.days,
      reason: req.reasonAr || req.reasonEn,
      status: "pending",
    }).select("*").single();
    if (error && (error.message.includes("type") || error.message.includes("column"))) {
      const retry = await supabase.from("leave_requests").insert({
        employee_id: userId,
        type_key: req.typeKey,
        start_date: req.startDate,
        end_date: req.endDate,
        days: req.days,
        reason_ar: req.reasonAr,
        reason_en: req.reasonEn,
        status: "pending",
      }).select("*").single();
      data = retry.data;
      error = retry.error;
    }
    if (error || !data) {
      console.error("[HR] leave_requests insert error:", error?.message);
      throw error ?? new Error("Insert returned no row");
    }

    const newRow = mapLeaveRow(data);
    setState((p) => ({ ...p, leaveRequests: [newRow, ...p.leaveRequests] }));

    notifyAdminsBG({
      type: "leave",
      titleAr: "طلب إجازة جديد",
      titleEn: "New Leave Request",
      descAr: "طلب إجازة جديد بانتظار الموافقة",
      descEn: "New leave request pending approval",
      href: "/leaves?tab=requests",
    });
  }, []);

  const approveLeaveRequest = useCallback(async (id: string) => {
    const userId = await getSessionUserId();

    // Look up the request first so we have the data needed to decrement the
    // employee's leave_balances. Bail out if the request is already approved
    // so a double-click can't double-count the days.
    const { data: req, error: fetchErr } = await supabase
      .from("leave_requests")
      .select("employee_id, type, days, start_date, status")
      .eq("id", id)
      .single();
    if (fetchErr || !req) throw fetchErr || new Error("Leave request not found");
    if ((req.status as string) === "approved") return;

    const { error } = await supabase.from("leave_requests").update({
      status: "approved",
      reviewed_by: userId,
      reviewed_at: new Date().toISOString(),
    }).eq("id", id);
    if (error) throw error;

    // Decrement the matching leave_balances row (creates it if it doesn't
    // exist yet). Unpaid leaves are exempt — they don't draw from a quota.
    const leaveType = req.type as string;
    if (leaveType !== "unpaid") {
      const balanceYear = new Date(req.start_date as string).getFullYear();
      const defaultsByType: Record<string, number> = {
        annual: 21,
        sick: 10,
        marriage: 7,
        paternity: 3,
      };
      const defaultTotal = defaultsByType[leaveType] ?? 0;
      const days = req.days as number;

      const { data: existing } = await supabase
        .from("leave_balances")
        .select("id, used")
        .eq("employee_id", req.employee_id as string)
        .eq("type_key", leaveType)
        .eq("year", balanceYear)
        .maybeSingle();

      if (existing) {
        await supabase
          .from("leave_balances")
          .update({ used: (existing.used as number) + days })
          .eq("id", existing.id as string);
      } else {
        await supabase.from("leave_balances").insert({
          employee_id: req.employee_id as string,
          type_key: leaveType,
          total: defaultTotal,
          used: days,
          year: balanceYear,
        });
      }
      // Refresh local store so the admin sees the new used number on the
      // current page (Balance tab cards) without a hard refresh.
      await refreshLeaveBalances();
    }

    let notifyTargetId: string | undefined;
    setState((p) => {
      const next = p.leaveRequests.map((r) => {
        if (r.id === id) {
          notifyTargetId = r.employeeId;
          return { ...r, status: "approved" as const };
        }
        return r;
      });
      return { ...p, leaveRequests: next };
    });

    if (notifyTargetId) {
      notifyUserBG({
        userId: notifyTargetId,
        type: "leave",
        titleAr: "تمت الموافقة على طلب الإجازة",
        titleEn: "Leave Request Approved",
        descAr: "تمت الموافقة على طلب إجازتك بنجاح",
        descEn: "Your leave request has been approved",
        href: "/leaves",
      });
    }
  }, [refreshLeaveBalances]);

  const rejectLeaveRequest = useCallback(async (id: string, reason?: string) => {
    const userId = await getSessionUserId();

    const { error } = await supabase.from("leave_requests").update({
      status: "rejected",
      reviewed_by: userId,
      reviewed_at: new Date().toISOString(),
      rejection_reason: reason || null,
    }).eq("id", id);
    if (error) throw error;

    setState((p) => ({
      ...p,
      leaveRequests: p.leaveRequests.map((r) =>
        r.id === id ? { ...r, status: "rejected" as const } : r
      ),
    }));
  }, []);

  // ── Employee Requests (Supabase) ──

  const submitEmployeeRequest = useCallback(async (req: Omit<EmpReq, "id">) => {
    const userId = await getSessionUserId();

    const { data, error } = await supabase.from("employee_requests").insert({
      employee_id: userId,
      type_key: req.typeKey,
      date: req.date || new Date().toISOString().split("T")[0],
      status: "pending",
      details_ar: req.detailsAr,
      details_en: req.detailsEn,
    }).select("*").single();
    if (error || !data) throw error ?? new Error("Insert returned no row");

    const newRow = mapEmpReqRow(data);
    setState((p) => ({ ...p, employeeRequests: [newRow, ...p.employeeRequests] }));

    notifyAdminsBG({
      type: "request",
      titleAr: "طلب موظف جديد",
      titleEn: "New Employee Request",
      descAr: "طلب جديد بانتظار الموافقة",
      descEn: "New request pending approval",
      href: "/requests",
    });
  }, []);

  // ── Salary Advance (Supabase) ──

  const submitAdvance = useCallback(async (adv: Omit<SalaryAdvance, "id">) => {
    const userId = await getSessionUserId();

    const { data, error } = await supabase.from("salary_advances").insert({
      employee_id: userId,
      amount: adv.amount,
      reason_ar: adv.reasonAr,
      reason_en: adv.reasonEn,
      request_date: adv.requestDate || new Date().toISOString().split("T")[0],
      status: "pending",
      repayment_months: adv.repaymentMonths,
      monthly_deduction: adv.monthlyDeduction,
      remaining_balance: adv.amount,
      paid_months: 0,
    }).select("*").single();
    if (error || !data) throw error ?? new Error("Insert returned no row");

    const newRow = mapAdvanceRow(data);
    setState((p) => ({ ...p, salaryAdvances: [newRow, ...p.salaryAdvances] }));

    notifyAdminsBG({
      type: "payroll",
      titleAr: "طلب سلفة جديد",
      titleEn: "New Salary Advance Request",
      descAr: "طلب سلفة بانتظار الموافقة",
      descEn: "Advance request pending approval",
      href: "/requests",
    });
  }, []);

  // ── Attendance Adjustment (Supabase) ──

  const submitAdjustment = useCallback(async (adj: Omit<AttendanceAdjustment, "id">) => {
    const userId = await getSessionUserId();

    const { data, error } = await supabase.from("attendance_adjustments").insert({
      employee_id: userId,
      date: adj.date,
      original_in: adj.originalIn || null,
      requested_in: adj.requestedIn || null,
      original_out: adj.originalOut || null,
      requested_out: adj.requestedOut || null,
      reason_ar: adj.reasonAr,
      reason_en: adj.reasonEn,
      status: "pending",
    }).select("*").single();
    if (error || !data) throw error ?? new Error("Insert returned no row");

    const newRow = mapAdjustmentRow(data);
    setState((p) => ({ ...p, attendanceAdjustments: [newRow, ...p.attendanceAdjustments] }));

    notifyAdminsBG({
      type: "attendance",
      titleAr: "طلب تعديل حضور جديد",
      titleEn: "New Attendance Adjustment Request",
      descAr: "طلب تعديل حضور بانتظار الموافقة",
      descEn: "Attendance adjustment pending approval",
      href: "/requests",
    });
  }, []);

  // ── Generic Approve/Reject (Supabase) ──

  const approveItem = useCallback(async (
    collection: "employeeRequests" | "salaryAdvances" | "attendanceAdjustments",
    id: string
  ) => {
    const userId = await getSessionUserId();
    const table = SUPA_TABLE[collection];

    const { error } = await supabase.from(table).update({
      status: "approved",
      reviewed_by: userId,
      reviewed_at: new Date().toISOString(),
    }).eq("id", id);
    if (error) throw error;

    setState((p) => ({
      ...p,
      [collection]: (p[collection] as Array<{ id: string; status: string }>).map((r) =>
        r.id === id ? { ...r, status: "approved" } : r
      ),
    }));
  }, []);

  const rejectItem = useCallback(async (
    collection: "employeeRequests" | "salaryAdvances" | "attendanceAdjustments",
    id: string
  ) => {
    const userId = await getSessionUserId();
    const table = SUPA_TABLE[collection];

    const { error } = await supabase.from(table).update({
      status: "rejected",
      reviewed_by: userId,
      reviewed_at: new Date().toISOString(),
    }).eq("id", id);
    if (error) throw error;

    setState((p) => ({
      ...p,
      [collection]: (p[collection] as Array<{ id: string; status: string }>).map((r) =>
        r.id === id ? { ...r, status: "rejected" } : r
      ),
    }));
  }, []);

  // ── Invitations (Supabase) ──

  const sendInvitation = useCallback(async (inv: Omit<PendingInvitation, "id">) => {
    const userId = await getSessionUserId();

    const { data, error } = await supabase.from("pending_invitations").insert({
      email: inv.email,
      name_ar: inv.nameAr,
      name_en: inv.nameEn,
      department: inv.department,
      position_ar: inv.positionAr,
      position_en: inv.positionEn,
      sent_date: inv.sentDate || new Date().toISOString().split("T")[0],
      status: "pending",
      invited_by: userId,
    }).select("*").single();
    if (error || !data) throw error ?? new Error("Insert returned no row");

    const newRow = mapInvitationRow(data);
    setState((p) => ({ ...p, pendingInvitations: [newRow, ...p.pendingInvitations] }));
  }, []);

  const resendInvitation = useCallback(async (id: string) => {
    const newSentDate = new Date().toISOString().split("T")[0];
    const { error } = await supabase.from("pending_invitations").update({
      status: "pending",
      sent_date: newSentDate,
    }).eq("id", id);
    if (error) throw error;

    setState((p) => ({
      ...p,
      pendingInvitations: p.pendingInvitations.map((i) =>
        i.id === id ? { ...i, status: "pending" as const, sentDate: newSentDate } : i
      ),
    }));
  }, []);

  // ── Notifications (local cache) ──

  const markNotificationRead = useCallback((id: string) => {
    setState((p) => ({
      ...p,
      notifications: p.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      ),
    }));
  }, []);

  const markAllNotificationsRead = useCallback(() => {
    setState((p) => ({
      ...p,
      notifications: p.notifications.map((n) => ({ ...n, read: true })),
    }));
  }, []);

  const addNotification = useCallback((n: Omit<Notification, "id">) => {
    setState((p) => ({
      ...p,
      notifications: [{ ...n, id: genId("N") }, ...p.notifications],
    }));
  }, []);

  // ── Employees (local + Supabase sync) ──

  const updateEmployee = useCallback(
    (id: string, updates: Partial<Employee>) => {
      setState((p) => ({
        ...p,
        employees: p.employees.map((e) =>
          e.id === id ? { ...e, ...updates } : e
        ),
      }));
    },
    []
  );

  // ── Settings (Supabase-backed via app_settings.key='company_settings') ──

  const refreshSettings = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "company_settings")
        .maybeSingle();
      if (error) {
        console.error("[data-store] refreshSettings failed:", error.message);
        return;
      }
      if (data?.value && typeof data.value === "object") {
        setState((p) => ({
          ...p,
          settings: { ...p.settings, ...(data.value as Partial<AppSettings>) },
        }));
      }
    } catch (err) {
      console.error("[data-store] refreshSettings exception:", err);
    }
  }, []);

  const updateSettings = useCallback(async (updates: Partial<AppSettings>) => {
    let previous: AppSettings = getDefaultState().settings;
    setState((p) => {
      previous = p.settings;
      return { ...p, settings: { ...p.settings, ...updates } };
    });
    const next = { ...previous, ...updates };
    const { error } = await supabase
      .from("app_settings")
      .upsert({ key: "company_settings", value: next }, { onConflict: "key" });
    if (error) {
      console.error("[data-store] updateSettings Supabase error:", error.message);
      // Rollback
      setState((p) => ({ ...p, settings: previous }));
      throw error;
    }
  }, []);

  // ── Branches (Supabase: branches) ──

  const refreshBranches = useCallback(async () => {
    const { data, error } = await supabase
      .from("branches")
      .select("*")
      .order("created_at", { ascending: true });
    if (error) {
      console.error("[data-store] refreshBranches failed:", error.message);
      return;
    }
    if (!data) return;
    const mapped: Branch[] = data.map((r: Record<string, unknown>) => ({
      id: r.id as string,
      nameAr: r.name_ar as string,
      nameEn: r.name_en as string,
      cityAr: r.city_ar as string,
      cityEn: r.city_en as string,
      employeeCount: (r.employee_count as number) ?? 0,
      isMain: (r.is_main as boolean) ?? false,
    }));
    setState((p) => ({ ...p, branches: mapped }));
  }, []);

  const addBranch = useCallback(async (b: Omit<Branch, "id" | "employeeCount"> & { id?: string }) => {
    const id = b.id || `BR${Date.now().toString().slice(-6)}`;
    const { error } = await supabase.from("branches").insert({
      id,
      name_ar: b.nameAr,
      name_en: b.nameEn,
      city_ar: b.cityAr,
      city_en: b.cityEn,
      is_main: b.isMain,
      employee_count: 0,
    });
    if (error) throw error;
    await refreshBranches();
  }, [refreshBranches]);

  const updateBranch = useCallback(async (id: string, updates: Partial<Branch>) => {
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (updates.nameAr !== undefined) patch.name_ar = updates.nameAr;
    if (updates.nameEn !== undefined) patch.name_en = updates.nameEn;
    if (updates.cityAr !== undefined) patch.city_ar = updates.cityAr;
    if (updates.cityEn !== undefined) patch.city_en = updates.cityEn;
    if (updates.isMain !== undefined) patch.is_main = updates.isMain;
    const { error } = await supabase.from("branches").update(patch).eq("id", id);
    if (error) throw error;
    await refreshBranches();
  }, [refreshBranches]);

  const removeBranch = useCallback(async (id: string) => {
    const { error } = await supabase.from("branches").delete().eq("id", id);
    if (error) throw error;
    await refreshBranches();
  }, [refreshBranches]);

  // ── Custom Roles (Supabase: custom_roles) ──

  const refreshRoles = useCallback(async () => {
    const { data, error } = await supabase
      .from("custom_roles")
      .select("*")
      .order("created_at", { ascending: true });
    if (error) {
      console.error("[data-store] refreshRoles failed:", error.message);
      return;
    }
    if (!data) return;
    const mapped: Role[] = data.map((r: Record<string, unknown>) => ({
      id: r.id as string,
      nameAr: r.name_ar as string,
      nameEn: r.name_en as string,
      users: (r.user_count as number) ?? 0,
      permissions: Array.isArray(r.permissions) ? (r.permissions as string[]) : [],
    }));
    setState((p) => ({ ...p, roles: mapped }));
  }, []);

  const addRole = useCallback(async (r: Omit<Role, "id" | "users"> & { id?: string }) => {
    const id = r.id || `R${Date.now().toString().slice(-6)}`;
    const { error } = await supabase.from("custom_roles").insert({
      id,
      name_ar: r.nameAr,
      name_en: r.nameEn,
      permissions: r.permissions,
      user_count: 0,
    });
    if (error) throw error;
    await refreshRoles();
  }, [refreshRoles]);

  const updateRole = useCallback(async (id: string, updates: Partial<Role>) => {
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (updates.nameAr !== undefined) patch.name_ar = updates.nameAr;
    if (updates.nameEn !== undefined) patch.name_en = updates.nameEn;
    if (updates.permissions !== undefined) patch.permissions = updates.permissions;
    const { error } = await supabase.from("custom_roles").update(patch).eq("id", id);
    if (error) throw error;
    await refreshRoles();
  }, [refreshRoles]);

  const removeRole = useCallback(async (id: string) => {
    const { error } = await supabase.from("custom_roles").delete().eq("id", id);
    if (error) throw error;
    await refreshRoles();
  }, [refreshRoles]);

  // ── Compliance Items (Supabase: compliance_items) ──

  const refreshCompliance = useCallback(async () => {
    const { data, error } = await supabase
      .from("compliance_items")
      .select("*")
      .order("id", { ascending: true });
    if (error) {
      console.error("[data-store] refreshCompliance failed:", error.message);
      return;
    }
    if (!data) return;
    const mapped: ComplianceItem[] = data.map((r: Record<string, unknown>) => ({
      id: r.id as string,
      titleAr: r.title_ar as string,
      titleEn: r.title_en as string,
      descAr: (r.desc_ar as string) || "",
      descEn: (r.desc_en as string) || "",
      compliant: (r.compliant as boolean) ?? false,
      reviewedAt: (r.reviewed_at as string) || undefined,
    }));
    setState((p) => ({ ...p, compliance: mapped }));
  }, []);

  const updateCompliance = useCallback(async (id: string, updates: Partial<ComplianceItem>) => {
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    const patch: Record<string, unknown> = {
      reviewed_by: userId,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    if (updates.titleAr !== undefined) patch.title_ar = updates.titleAr;
    if (updates.titleEn !== undefined) patch.title_en = updates.titleEn;
    if (updates.descAr !== undefined) patch.desc_ar = updates.descAr;
    if (updates.descEn !== undefined) patch.desc_en = updates.descEn;
    if (updates.compliant !== undefined) patch.compliant = updates.compliant;
    const { error } = await supabase.from("compliance_items").update(patch).eq("id", id);
    if (error) throw error;
    await refreshCompliance();
  }, [refreshCompliance]);

  // ── Employee Assets (Supabase: employee_assets) ──

  const refreshAssets = useCallback(async () => {
    const { data, error } = await supabase
      .from("employee_assets")
      .select("*")
      .order("issued_at", { ascending: false });
    if (error) {
      console.error("[data-store] refreshAssets failed:", error.message);
      return;
    }
    if (!data) return;
    const mapped: EmployeeAsset[] = data.map((r: Record<string, unknown>) => ({
      id: r.id as string,
      employeeId: r.employee_id as string,
      assetType: r.asset_type as AssetType,
      nameAr: r.name_ar as string,
      nameEn: r.name_en as string,
      serialNumber: (r.serial_number as string) || undefined,
      notes: (r.notes as string) || undefined,
      issuedAt: r.issued_at as string,
      returnedAt: (r.returned_at as string) || null,
      status: (r.status as EmployeeAsset["status"]) || "issued",
      issuedBy: (r.issued_by as string) || null,
    }));
    setState((p) => ({ ...p, assets: mapped }));
  }, []);

  const addAsset = useCallback(async (a: Omit<EmployeeAsset, "id" | "issuedBy">) => {
    const { data: { session } } = await supabase.auth.getSession();
    const issuedBy = session?.user?.id;
    const { error } = await supabase.from("employee_assets").insert({
      employee_id: a.employeeId,
      asset_type: a.assetType,
      name_ar: a.nameAr,
      name_en: a.nameEn,
      serial_number: a.serialNumber || null,
      notes: a.notes || null,
      issued_at: a.issuedAt,
      returned_at: a.returnedAt || null,
      status: a.status,
      issued_by: issuedBy,
    });
    if (error) throw error;
    await refreshAssets();
  }, [refreshAssets]);

  const updateAsset = useCallback(async (id: string, updates: Partial<EmployeeAsset>) => {
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (updates.assetType !== undefined) patch.asset_type = updates.assetType;
    if (updates.nameAr !== undefined) patch.name_ar = updates.nameAr;
    if (updates.nameEn !== undefined) patch.name_en = updates.nameEn;
    if (updates.serialNumber !== undefined) patch.serial_number = updates.serialNumber || null;
    if (updates.notes !== undefined) patch.notes = updates.notes || null;
    if (updates.issuedAt !== undefined) patch.issued_at = updates.issuedAt;
    if (updates.returnedAt !== undefined) patch.returned_at = updates.returnedAt || null;
    if (updates.status !== undefined) patch.status = updates.status;
    const { error } = await supabase.from("employee_assets").update(patch).eq("id", id);
    if (error) throw error;
    await refreshAssets();
  }, [refreshAssets]);

  const removeAsset = useCallback(async (id: string) => {
    const { error } = await supabase.from("employee_assets").delete().eq("id", id);
    if (error) throw error;
    await refreshAssets();
  }, [refreshAssets]);

  // ── Manager assignment (writes profiles.manager_id) ──

  const updateEmployeeManager = useCallback(async (employeeId: string, managerId: string | null) => {
    // Optimistic update of local employees state
    setState((p) => ({
      ...p,
      employees: p.employees.map((e) =>
        e.id === employeeId ? { ...e, managerId } : e
      ),
    }));
    const { error } = await supabase
      .from("profiles")
      .update({ manager_id: managerId })
      .eq("id", employeeId);
    if (error) {
      console.error("[data-store] updateEmployeeManager failed:", error.message);
      throw error;
    }
  }, []);

  const processPayroll = useCallback(() => {
    setState((p) => {
      p.employees.forEach((emp) => {
        createNotification({
          userId: emp.id,
          type: "payroll",
          titleAr: "تم تشغيل الرواتب",
          titleEn: "Payroll Processed",
          descAr: "تم معالجة رواتب الشهر الحالي بنجاح",
          descEn: "Current month payroll has been processed successfully",
          href: "/payroll",
        });
      });
      return { ...p, payrollProcessed: true };
    });
  }, []);

  // ── Departments ──

  const addDepartment = useCallback((key: string, ar: string, en: string) => {
    setState((p) => ({
      ...p,
      departments: { ...p.departments, [key]: { ar, en } },
    }));
  }, []);

  const updateDepartment = useCallback((key: string, ar: string, en: string) => {
    setState((p) => ({
      ...p,
      departments: { ...p.departments, [key]: { ar, en } },
    }));
  }, []);

  const removeDepartment = useCallback((key: string) => {
    setState((p) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { [key]: _removed, ...rest } = p.departments;
      return { ...p, departments: rest };
    });
  }, []);

  // ── Profile / Invitation Acceptance ──

  const acceptInvitation = useCallback((email: string) => {
    setState((p) => {
      const inv = p.pendingInvitations.find(
        (i) => i.email.toLowerCase() === email.toLowerCase() && i.status === "pending"
      );
      if (!inv) return p;

      // Update invitation status in Supabase even if the employee already exists.
      supabase.from("pending_invitations").update({ status: "expired" }).eq("id", inv.id);

      const alreadyExists = p.employees.some(
        (e) => e.email.toLowerCase() === email.toLowerCase()
      );
      if (alreadyExists) {
        return {
          ...p,
          pendingInvitations: p.pendingInvitations.map((i) =>
            i.id === inv.id ? { ...i, status: "expired" as const } : i
          ),
        };
      }
      const colors = ["bg-blue-500", "bg-emerald-500", "bg-amber-500", "bg-rose-500", "bg-purple-500", "bg-cyan-500", "bg-orange-500", "bg-teal-500", "bg-pink-500", "bg-indigo-500"];
      const newEmp: Employee = {
        id: genId("EMP"),
        nameAr: inv.nameAr,
        nameEn: inv.nameEn,
        positionAr: inv.positionAr,
        positionEn: inv.positionEn,
        department: inv.department,
        email: inv.email,
        phone: "",
        status: "active",
        joinDate: new Date().toISOString().split("T")[0],
        salary: { basic: 0, housing: 0, transport: 0, other: 0 },
        initials: inv.nameAr.split(" ").map((w) => w[0]).slice(0, 2).join(""),
        color: colors[Math.floor(Math.random() * colors.length)],
        profileCompleted: false,
      };

      return {
        ...p,
        employees: [...p.employees, newEmp],
        pendingInvitations: p.pendingInvitations.map((i) =>
          i.id === inv.id ? { ...i, status: "expired" as const } : i
        ),
      };
    });
  }, []);

  const completeProfile = useCallback(
    async (id: string, data: Partial<Employee>) => {
      const fullNameAr = data.fullNameAr || data.nameAr || "";
      const fullNameEn = data.fullNameEn || data.nameEn || "";
      const { error } = await supabase
        .from("profiles")
        .update({
          name_ar: data.nameAr || fullNameAr,
          name_en: data.nameEn || fullNameEn,
          full_name_ar: fullNameAr,
          full_name_en: fullNameEn,
          phone: data.phone || data.mobileNumber || null,
          profile_completed: true,
        })
        .eq("id", id);

      if (error) throw error;

      setState((p) => ({
        ...p,
        employees: p.employees.map((e) =>
          e.id === id ? { ...e, ...data, profileCompleted: true } : e
        ),
      }));
    },
    []
  );

  const resetStore = useCallback(() => {
    setState(getDefaultState());
    localStorage.removeItem(SETTINGS_KEY);
  }, []);

  const value: DataContextType = {
    ...state,
    initialLoaded,
    hydrate,
    clockIn,
    clockOut,
    refreshAttendance,
    submitLeaveRequest,
    refreshLeaveRequests,
    approveLeaveRequest,
    rejectLeaveRequest,
    submitEmployeeRequest,
    refreshEmployeeRequests,
    submitAdvance,
    refreshSalaryAdvances,
    submitAdjustment,
    refreshAttendanceAdjustments,
    approveItem,
    rejectItem,
    sendInvitation,
    resendInvitation,
    refreshInvitations,
    refreshLeaveBalances,
    markNotificationRead,
    markAllNotificationsRead,
    addNotification,
    updateEmployee,
    updateSettings,
    refreshSettings,
    addDepartment,
    updateDepartment,
    removeDepartment,
    refreshBranches,
    addBranch,
    updateBranch,
    removeBranch,
    refreshRoles,
    addRole,
    updateRole,
    removeRole,
    refreshCompliance,
    updateCompliance,
    refreshAssets,
    addAsset,
    updateAsset,
    removeAsset,
    updateEmployeeManager,
    acceptInvitation,
    completeProfile,
    processPayroll,
    resetStore,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}
