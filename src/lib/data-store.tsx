"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import {
  employees as defaultEmployees,
  departments as defaultDepartments,
  type Employee,
  type Notification,
  type SalaryAdvance,
  type AttendanceAdjustment,
  type PendingInvitation,
} from "./mock-data";
import { createNotification, notifyAdmins } from "./notifications";
import { supabase } from "./supabase";
import { getKSADateString, getKSAYear } from "./utils";

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

// Default leave balances — Saudi Labor Law aligned (nominal values; adjust
// per employment contract in Supabase `leave_balances` when needed).
//   annual     — Article 109: 21 days < 5 yrs service, 30 days ≥ 5 yrs (we default to 21)
//   sick       — Article 117: 30 full-pay + 60 half-pay + 30 unpaid (we expose the full-pay tier)
//   maternity  — Article 151: 10 weeks (70 days) total
//   unpaid     — default 30 days allowance
//   marriage   — customary 5 days
//   paternity  — customary 3 days
//   bereavement — Article 113: 5 days (spouse) / 3 days (close relative), default 5
//   hajj       — Article 114: 10–15 days, once during service, default 15
const DEFAULT_BALANCES: LeaveBalance[] = [
  { typeKey: "annual", total: 21, used: 0, remaining: 21 },
  { typeKey: "sick", total: 30, used: 0, remaining: 30 },
  { typeKey: "maternity", total: 70, used: 0, remaining: 70 },
  { typeKey: "unpaid", total: 30, used: 0, remaining: 30 },
  { typeKey: "marriage", total: 5, used: 0, remaining: 5 },
  { typeKey: "paternity", total: 3, used: 0, remaining: 3 },
  { typeKey: "bereavement", total: 5, used: 0, remaining: 5 },
  { typeKey: "hajj", total: 15, used: 0, remaining: 15 },
];

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
  updateEmployee: (id: string, updates: Partial<Employee>) => Promise<void>;

  // Settings (local)
  updateSettings: (updates: Partial<AppSettings>) => void;

  // Departments
  addDepartment: (key: string, ar: string, en: string) => Promise<void>;
  updateDepartment: (key: string, ar: string, en: string) => Promise<void>;
  removeDepartment: (key: string) => Promise<void>;

  // Profile completion
  acceptInvitation: (email: string) => Promise<void>;
  completeProfile: (id: string, data: Partial<Employee>) => Promise<void>;

  // Payroll
  processPayroll: () => Promise<void>;

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

export function DataProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DataState>(getDefaultState);
  const [hydrated, setHydrated] = useState(false);
  const [initialLoaded, setInitialLoaded] = useState(false);

  // Mirror state into a ref so async callbacks can read fresh values without
  // forcing re-renders and without relying on setState callback timing.
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

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
      const today = getKSADateString();
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
    } catch (err) {
      console.error("[data-store] refreshAttendance failed:", err);
    }
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
    } catch (err) {
      console.error("[data-store] refreshLeaveRequests failed:", err);
    }
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
    } catch (err) {
      console.error("[data-store] refreshEmployeeRequests failed:", err);
    }
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
    } catch (err) {
      console.error("[data-store] refreshSalaryAdvances failed:", err);
    }
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
    } catch (err) {
      console.error("[data-store] refreshAttendanceAdjustments failed:", err);
    }
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
    } catch (err) {
      console.error("[data-store] refreshInvitations failed:", err);
    }
  }, []);

  const refreshLeaveBalances = useCallback(async () => {
    try {
      const currentYear = getKSAYear();
      const { data } = await supabase
        .from("leave_balances")
        .select("*")
        .eq("year", currentYear);
      if (!data || data.length === 0) {
        setState((prev) => ({ ...prev, leaveBalances: DEFAULT_BALANCES }));
        return;
      }
      const byType = new Map<string, LeaveBalance>();
      for (const r of data as Array<Record<string, unknown>>) {
        const typeKey = r.type_key as string;
        const total = r.total as number;
        const used = r.used as number;
        byType.set(typeKey, { typeKey, total, used, remaining: total - used });
      }
      const merged: LeaveBalance[] = DEFAULT_BALANCES.map(
        (def) => byType.get(def.typeKey) ?? def
      );
      setState((prev) => ({ ...prev, leaveBalances: merged }));
    } catch (err) {
      console.error("[data-store] refreshLeaveBalances failed:", err);
      setState((prev) => prev.leaveBalances.length === 0 ? { ...prev, leaveBalances: DEFAULT_BALANCES } : prev);
    }
  }, []);

  const refreshDepartments = useCallback(async () => {
    try {
      const { data, error } = await supabase.from("departments").select("*");
      if (error || !data || data.length === 0) return;
      const mapped: Record<string, { ar: string; en: string }> = {};
      for (const row of data as Array<{ id: string; name_ar: string; name_en: string }>) {
        mapped[row.id] = { ar: row.name_ar, en: row.name_en };
      }
      setState((prev) => ({ ...prev, departments: mapped }));
    } catch (err) {
      console.error("[data-store] refreshDepartments failed:", err);
    }
  }, []);

  // ── Fetch ALL data from Supabase on hydration ──

  useEffect(() => {
    if (!hydrated) return;
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
        refreshDepartments(),
      ]);
      if (!cancelled) setInitialLoaded(true);
    })();
    return () => { cancelled = true; };
  }, [hydrated, refreshAttendance, refreshLeaveRequests, refreshEmployeeRequests, refreshSalaryAdvances, refreshAttendanceAdjustments, refreshInvitations, refreshLeaveBalances, refreshDepartments]);

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
          const today = getKSADateString();
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
      } catch (err) {
        console.error("[data-store] syncEmployees failed:", err);
      }
    }
    syncEmployees();
  }, [hydrated]);

  // Listen for invitation acceptance from AuthProvider
  useEffect(() => {
    function handleAccept(e: Event) {
      const email = (e as CustomEvent).detail;
      if (email) {
        acceptInvitation(email).catch((err) => {
          console.error("[data-store] acceptInvitation failed:", err);
        });
      }
    }
    window.addEventListener("njd-accept-invitation", handleAccept);
    return () => window.removeEventListener("njd-accept-invitation", handleAccept);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Attendance Actions (Supabase) ──

  const clockIn = useCallback(async (time: string) => {
    const userId = await getSessionUserId();
    const today = getKSADateString();

    await supabase.from("attendance").upsert({
      employee_id: userId,
      date: today,
      check_in: time,
      status: "present",
      method: "geofence",
    }, { onConflict: "employee_id,date" });

    await refreshAttendance();
  }, [refreshAttendance]);

  const clockOut = useCallback(async (time: string) => {
    const userId = await getSessionUserId();
    const today = getKSADateString();

    await supabase.from("attendance")
      .update({ check_out: time })
      .eq("employee_id", userId)
      .eq("date", today);

    await refreshAttendance();
  }, [refreshAttendance]);

  // ── Leave Requests (Supabase) ──

  const submitLeaveRequest = useCallback(async (req: Omit<LeaveReq, "id">) => {
    const userId = await getSessionUserId();

    // Overlap guard: block submission if another pending/approved leave already
    // covers any day in the requested range. Prevents double-dipping balances.
    const existing = stateRef.current.leaveRequests.filter(
      (r) =>
        r.employeeId === userId &&
        r.status !== "rejected" &&
        !(req.endDate < r.startDate || req.startDate > r.endDate)
    );
    if (existing.length > 0) {
      const err = new Error(
        "OVERLAP:" + existing.map((r) => `${r.startDate}→${r.endDate}`).join(", ")
      );
      throw err;
    }

    // Try with 'type' column first (migration 004 schema), fall back to 'type_key' (old schema)
    let { error } = await supabase.from("leave_requests").insert({
      employee_id: userId,
      type: req.typeKey,
      start_date: req.startDate,
      end_date: req.endDate,
      days: req.days,
      reason: req.reasonAr || req.reasonEn,
      status: "pending",
    });
    if (error && (error.message.includes("type") || error.message.includes("column"))) {
      // Fallback: old schema uses type_key + reason_ar/reason_en
      const retry = await supabase.from("leave_requests").insert({
        employee_id: userId,
        type_key: req.typeKey,
        start_date: req.startDate,
        end_date: req.endDate,
        days: req.days,
        reason_ar: req.reasonAr,
        reason_en: req.reasonEn,
        status: "pending",
      });
      error = retry.error;
    }
    if (error) {
      console.error("[HR] leave_requests insert error:", error.message, error.details, error.hint);
      throw error;
    }

    await refreshLeaveRequests();

    await notifyAdmins({
      type: "leave",
      titleAr: "طلب إجازة جديد",
      titleEn: "New Leave Request",
      descAr: "طلب إجازة جديد بانتظار الموافقة",
      descEn: "New leave request pending approval",
      href: "/leaves",
    });
  }, [refreshLeaveRequests]);

  const approveLeaveRequest = useCallback(async (id: string) => {
    const userId = await getSessionUserId();
    const req = state.leaveRequests.find((r) => r.id === id);

    const { error } = await supabase.from("leave_requests").update({
      status: "approved",
      reviewed_by: userId,
      reviewed_at: new Date().toISOString(),
    }).eq("id", id);
    if (error) throw error;

    // Increment leave_balances.used by the approved number of days.
    // Upsert so the row is created if the employee had no prior balance
    // record for this type/year (falls back to DEFAULT_BALANCES totals).
    if (req?.employeeId && req.typeKey && req.days) {
      const year = getKSAYear();
      const { data: existing } = await supabase
        .from("leave_balances")
        .select("total, used")
        .eq("employee_id", req.employeeId)
        .eq("type_key", req.typeKey)
        .eq("year", year)
        .maybeSingle();

      const defaults = DEFAULT_BALANCES.find((b) => b.typeKey === req.typeKey);
      const total = existing?.total ?? defaults?.total ?? 0;
      const used = (existing?.used ?? 0) + req.days;

      const { error: balanceError } = await supabase.from("leave_balances").upsert(
        {
          employee_id: req.employeeId,
          type_key: req.typeKey,
          year,
          total,
          used,
        },
        { onConflict: "employee_id,type_key,year" }
      );
      if (balanceError) {
        console.error("[data-store] approveLeaveRequest balance update failed:", balanceError.message);
      }
    }

    await refreshLeaveRequests();
    await refreshLeaveBalances();

    if (req?.employeeId) {
      createNotification({
        userId: req.employeeId,
        type: "leave",
        titleAr: "تمت الموافقة على طلب الإجازة",
        titleEn: "Leave Request Approved",
        descAr: "تمت الموافقة على طلب إجازتك بنجاح",
        descEn: "Your leave request has been approved",
        href: "/leaves",
      });
    }
  }, [refreshLeaveRequests, refreshLeaveBalances, state.leaveRequests]);

  const rejectLeaveRequest = useCallback(async (id: string, reason?: string) => {
    const userId = await getSessionUserId();

    await supabase.from("leave_requests").update({
      status: "rejected",
      reviewed_by: userId,
      reviewed_at: new Date().toISOString(),
      rejection_reason: reason || null,
    }).eq("id", id);

    await refreshLeaveRequests();
  }, [refreshLeaveRequests]);

  // ── Employee Requests (Supabase) ──

  const submitEmployeeRequest = useCallback(async (req: Omit<EmpReq, "id">) => {
    const userId = await getSessionUserId();

    const { error } = await supabase.from("employee_requests").insert({
      employee_id: userId,
      type_key: req.typeKey,
      date: req.date || getKSADateString(),
      status: "pending",
      details_ar: req.detailsAr,
      details_en: req.detailsEn,
    });
    if (error) throw error;

    await refreshEmployeeRequests();
  }, [refreshEmployeeRequests]);

  // ── Salary Advance (Supabase) ──

  const submitAdvance = useCallback(async (adv: Omit<SalaryAdvance, "id">) => {
    const userId = await getSessionUserId();

    const { error } = await supabase.from("salary_advances").insert({
      employee_id: userId,
      amount: adv.amount,
      reason_ar: adv.reasonAr,
      reason_en: adv.reasonEn,
      request_date: adv.requestDate || getKSADateString(),
      status: "pending",
      repayment_months: adv.repaymentMonths,
      monthly_deduction: adv.monthlyDeduction,
      remaining_balance: adv.amount,
      paid_months: 0,
    });
    if (error) throw error;

    await refreshSalaryAdvances();
  }, [refreshSalaryAdvances]);

  // ── Attendance Adjustment (Supabase) ──

  const submitAdjustment = useCallback(async (adj: Omit<AttendanceAdjustment, "id">) => {
    const userId = await getSessionUserId();

    const { error } = await supabase.from("attendance_adjustments").insert({
      employee_id: userId,
      date: adj.date,
      original_in: adj.originalIn || null,
      requested_in: adj.requestedIn || null,
      original_out: adj.originalOut || null,
      requested_out: adj.requestedOut || null,
      reason_ar: adj.reasonAr,
      reason_en: adj.reasonEn,
      status: "pending",
    });
    if (error) throw error;

    await refreshAttendanceAdjustments();
  }, [refreshAttendanceAdjustments]);

  // ── Generic Approve/Reject (Supabase) ──

  const approveItem = useCallback(async (
    collection: "employeeRequests" | "salaryAdvances" | "attendanceAdjustments",
    id: string
  ) => {
    const userId = await getSessionUserId();
    const table = SUPA_TABLE[collection];

    const baseUpdate = {
      status: "approved" as const,
      reviewed_by: userId,
      reviewed_at: new Date().toISOString(),
    };

    // Collection-specific side effects BEFORE marking approved
    if (collection === "salaryAdvances") {
      const adv = state.salaryAdvances.find((a) => a.id === id);
      if (adv) {
        const monthly = adv.monthlyDeduction > 0
          ? adv.monthlyDeduction
          : adv.repaymentMonths > 0
            ? Math.round((adv.amount / adv.repaymentMonths) * 100) / 100
            : adv.amount;
        const { error } = await supabase.from(table).update({
          ...baseUpdate,
          monthly_deduction: monthly,
          remaining_balance: adv.amount,
          paid_months: 0,
        }).eq("id", id);
        if (error) throw error;
      } else {
        await supabase.from(table).update(baseUpdate).eq("id", id);
      }
    } else if (collection === "attendanceAdjustments") {
      const adj = state.attendanceAdjustments.find((a) => a.id === id);
      const { error } = await supabase.from(table).update(baseUpdate).eq("id", id);
      if (error) throw error;

      // Apply the adjustment to the actual attendance record
      if (adj && adj.employeeId && adj.date) {
        const updates: Record<string, unknown> = {};
        if (adj.requestedIn) updates.check_in = adj.requestedIn;
        if (adj.requestedOut) updates.check_out = adj.requestedOut;
        if (Object.keys(updates).length > 0) {
          const { error: attError } = await supabase
            .from("attendance")
            .update(updates)
            .eq("employee_id", adj.employeeId)
            .eq("date", adj.date);
          if (attError) {
            console.error("[data-store] attendance adjustment apply failed:", attError.message);
          }
        }
      }
    } else {
      await supabase.from(table).update(baseUpdate).eq("id", id);
    }

    // Refresh relevant collections
    if (collection === "employeeRequests") await refreshEmployeeRequests();
    else if (collection === "salaryAdvances") await refreshSalaryAdvances();
    else if (collection === "attendanceAdjustments") {
      await refreshAttendanceAdjustments();
      await refreshAttendance();
    }
  }, [state.salaryAdvances, state.attendanceAdjustments, refreshEmployeeRequests, refreshSalaryAdvances, refreshAttendanceAdjustments, refreshAttendance]);

  const rejectItem = useCallback(async (
    collection: "employeeRequests" | "salaryAdvances" | "attendanceAdjustments",
    id: string
  ) => {
    const userId = await getSessionUserId();
    const table = SUPA_TABLE[collection];

    await supabase.from(table).update({
      status: "rejected",
      reviewed_by: userId,
      reviewed_at: new Date().toISOString(),
    }).eq("id", id);

    if (collection === "employeeRequests") await refreshEmployeeRequests();
    else if (collection === "salaryAdvances") await refreshSalaryAdvances();
    else if (collection === "attendanceAdjustments") await refreshAttendanceAdjustments();
  }, [refreshEmployeeRequests, refreshSalaryAdvances, refreshAttendanceAdjustments]);

  // ── Invitations (Supabase) ──

  const sendInvitation = useCallback(async (inv: Omit<PendingInvitation, "id">) => {
    const userId = await getSessionUserId();

    await supabase.from("pending_invitations").insert({
      email: inv.email,
      name_ar: inv.nameAr,
      name_en: inv.nameEn,
      department: inv.department,
      position_ar: inv.positionAr,
      position_en: inv.positionEn,
      sent_date: inv.sentDate || getKSADateString(),
      status: "pending",
      invited_by: userId,
    });

    await refreshInvitations();
  }, [refreshInvitations]);

  const resendInvitation = useCallback(async (id: string) => {
    await supabase.from("pending_invitations").update({
      status: "pending",
      sent_date: getKSADateString(),
    }).eq("id", id);

    await refreshInvitations();
  }, [refreshInvitations]);

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
    async (id: string, updates: Partial<Employee>) => {
      setState((p) => ({
        ...p,
        employees: p.employees.map((e) =>
          e.id === id ? { ...e, ...updates } : e
        ),
      }));

      const profilePatch: Record<string, unknown> = {};
      if (updates.nameAr !== undefined) profilePatch.name_ar = updates.nameAr;
      if (updates.nameEn !== undefined) profilePatch.name_en = updates.nameEn;
      if (updates.fullNameAr !== undefined) profilePatch.full_name_ar = updates.fullNameAr;
      if (updates.fullNameEn !== undefined) profilePatch.full_name_en = updates.fullNameEn;
      if (updates.phone !== undefined) profilePatch.phone = updates.phone;
      if (updates.department !== undefined) profilePatch.department = updates.department;
      if (updates.positionAr !== undefined) profilePatch.job_title_ar = updates.positionAr;
      if (updates.positionEn !== undefined) profilePatch.job_title_en = updates.positionEn;
      if (updates.profileCompleted !== undefined) profilePatch.profile_completed = updates.profileCompleted;

      if (Object.keys(profilePatch).length === 0) return;

      const { error } = await supabase.from("profiles").update(profilePatch).eq("id", id);
      if (error) {
        console.error("[data-store] updateEmployee Supabase error:", error.message);
      }
    },
    []
  );

  // ── Settings (local only) ──

  const updateSettings = useCallback((updates: Partial<AppSettings>) => {
    setState((p) => ({
      ...p,
      settings: { ...p.settings, ...updates },
    }));
  }, []);

  const processPayroll = useCallback(async () => {
    // Idempotency guard: don't let a double-click fire twice
    if (stateRef.current.payrollProcessed) return;

    setState((p) => ({ ...p, payrollProcessed: true }));

    // Read fresh employees via ref — avoids the fragile setState/resolve pattern
    const currentEmployees = stateRef.current.employees;

    const results = await Promise.allSettled(
      currentEmployees.map((emp) =>
        createNotification({
          userId: emp.id,
          type: "payroll",
          titleAr: "تم تشغيل الرواتب",
          titleEn: "Payroll Processed",
          descAr: "تم معالجة رواتب الشهر الحالي بنجاح",
          descEn: "Current month payroll has been processed successfully",
          href: "/payroll",
        })
      )
    );

    const failed = results.filter((r) => r.status === "rejected").length;
    if (failed > 0) {
      console.error(`[data-store] processPayroll: ${failed}/${currentEmployees.length} notifications failed to send`);
    }
  }, []);

  // ── Departments ──

  const addDepartment = useCallback(async (key: string, ar: string, en: string) => {
    setState((p) => ({
      ...p,
      departments: { ...p.departments, [key]: { ar, en } },
    }));
    const { error } = await supabase
      .from("departments")
      .upsert({ id: key, name_ar: ar, name_en: en }, { onConflict: "id" });
    if (error) {
      console.error("[data-store] addDepartment Supabase error:", error.message);
    }
  }, []);

  const updateDepartment = useCallback(async (key: string, ar: string, en: string) => {
    setState((p) => ({
      ...p,
      departments: { ...p.departments, [key]: { ar, en } },
    }));
    const { error } = await supabase
      .from("departments")
      .update({ name_ar: ar, name_en: en })
      .eq("id", key);
    if (error) {
      console.error("[data-store] updateDepartment Supabase error:", error.message);
    }
  }, []);

  const removeDepartment = useCallback(async (key: string) => {
    setState((p) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { [key]: _removed, ...rest } = p.departments;
      return { ...p, departments: rest };
    });
    const { error } = await supabase.from("departments").delete().eq("id", key);
    if (error) {
      console.error("[data-store] removeDepartment Supabase error:", error.message);
    }
  }, []);

  // ── Profile / Invitation Acceptance ──

  const acceptInvitation = useCallback(async (email: string) => {
    const normalizedEmail = email.toLowerCase();

    // Read the invitation BEFORE mutating state to avoid closure races with
    // React 18+ batching (setState callbacks may execute after the async work).
    const invitation = stateRef.current.pendingInvitations.find(
      (i) => i.email.toLowerCase() === normalizedEmail && i.status === "pending"
    );
    if (!invitation) return;

    const alreadyExists = stateRef.current.employees.some(
      (e) => e.email.toLowerCase() === normalizedEmail
    );

    // Optimistic update: mark invitation expired + create employee row locally
    setState((p) => {
      const expired = p.pendingInvitations.map((i) =>
        i.id === invitation.id ? { ...i, status: "expired" as const } : i
      );
      if (alreadyExists) {
        return { ...p, pendingInvitations: expired };
      }
      const colors = ["bg-blue-500", "bg-emerald-500", "bg-amber-500", "bg-rose-500", "bg-purple-500", "bg-cyan-500", "bg-orange-500", "bg-teal-500", "bg-pink-500", "bg-indigo-500"];
      const newEmp: Employee = {
        id: genId("EMP"),
        nameAr: invitation.nameAr,
        nameEn: invitation.nameEn,
        positionAr: invitation.positionAr,
        positionEn: invitation.positionEn,
        department: invitation.department,
        email: invitation.email,
        phone: "",
        status: "active",
        joinDate: getKSADateString(),
        salary: { basic: 0, housing: 0, transport: 0, other: 0 },
        initials: invitation.nameAr.split(" ").map((w) => w[0]).slice(0, 2).join(""),
        color: colors[Math.floor(Math.random() * colors.length)],
        profileCompleted: false,
      };
      return {
        ...p,
        employees: [...p.employees, newEmp],
        pendingInvitations: expired,
      };
    });

    const { error } = await supabase
      .from("pending_invitations")
      .update({ status: "expired" })
      .eq("id", invitation.id);

    if (error) {
      console.error("[data-store] acceptInvitation Supabase error:", error.message);
      // Rollback: revert invitation status in React state
      setState((p) => ({
        ...p,
        pendingInvitations: p.pendingInvitations.map((i) =>
          i.id === invitation.id ? { ...i, status: "pending" as const } : i
        ),
      }));
      throw new Error(error.message);
    }
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
    addDepartment,
    updateDepartment,
    removeDepartment,
    acceptInvitation,
    completeProfile,
    processPayroll,
    resetStore,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}
