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
  type Employee,
  type Notification,
  type SalaryAdvance,
  type AttendanceAdjustment,
  type PendingInvitation,
} from "./mock-data";
import { createNotification, notifyAdmins } from "./notifications";
import { supabase } from "./supabase";

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

  // Settings (local)
  updateSettings: (updates: Partial<AppSettings>) => void;

  // Departments
  addDepartment: (key: string, ar: string, en: string) => void;
  updateDepartment: (key: string, ar: string, en: string) => void;
  removeDepartment: (key: string) => void;

  // Profile completion
  acceptInvitation: (email: string) => void;
  completeProfile: (id: string, data: Partial<Employee>) => void;

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

export function DataProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DataState>(getDefaultState);
  const [hydrated, setHydrated] = useState(false);

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
      const mapped: AttRecord[] = data.map((r: Record<string, unknown>) => ({
        id: r.id as string,
        employeeId: r.employee_id as string,
        date: r.date as string,
        checkIn: r.check_in as string | null,
        checkOut: r.check_out as string | null,
        status: ((r.status as string) || "present") as AttRecord["status"],
      }));
      setState((prev) => ({ ...prev, todayAttendance: mapped }));
    } catch { /* table may not exist */ }
  }, []);

  const refreshLeaveRequests = useCallback(async () => {
    try {
      const { data } = await supabase
        .from("leave_requests")
        .select("*")
        .order("created_at", { ascending: false });
      if (!data) return;
      const mapped: LeaveReq[] = data.map((row: Record<string, unknown>) => ({
        id: row.id as string,
        employeeId: row.employee_id as string,
        typeKey: (row.type as string) || (row.type_key as string) || "annual",
        startDate: row.start_date as string,
        endDate: row.end_date as string,
        days: row.days as number,
        status: row.status as "pending" | "approved" | "rejected",
        reasonAr: (row.reason as string) || "",
        reasonEn: (row.reason as string) || "",
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

  const refreshLeaveBalances = useCallback(async () => {
    try {
      const currentYear = new Date().getFullYear();
      const { data } = await supabase
        .from("leave_balances")
        .select("*")
        .eq("year", currentYear);
      if (!data || data.length === 0) return;
      const mapped: LeaveBalance[] = data.map((r: Record<string, unknown>) => ({
        typeKey: r.type_key as string,
        total: r.total as number,
        used: r.used as number,
        remaining: (r.total as number) - (r.used as number),
      }));
      setState((prev) => ({ ...prev, leaveBalances: mapped }));
    } catch { /* */ }
  }, []);

  // ── Fetch ALL data from Supabase on hydration ──

  useEffect(() => {
    if (!hydrated) return;
    refreshAttendance();
    refreshLeaveRequests();
    refreshEmployeeRequests();
    refreshSalaryAdvances();
    refreshAttendanceAdjustments();
    refreshInvitations();
    refreshLeaveBalances();
  }, [hydrated, refreshAttendance, refreshLeaveRequests, refreshEmployeeRequests, refreshSalaryAdvances, refreshAttendanceAdjustments, refreshInvitations, refreshLeaveBalances]);

  // Sync employees from Supabase
  useEffect(() => {
    if (!hydrated) return;
    async function syncEmployees() {
      try {
        // eslint-disable-next-line prefer-const
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
          const existingEmails = new Set(prev.employees.map((e) => e.email.toLowerCase()));
          const newEmployees: Employee[] = [];

          for (const u of users) {
            const email = (u.email || "").toLowerCase();
            if (existingEmails.has(email)) continue;
            newEmployees.push({
              id: u.user_id.slice(0, 8).toUpperCase(),
              nameAr: u.name_ar || u.full_name_ar || u.email.split("@")[0],
              nameEn: u.name_en || u.full_name_en || u.email.split("@")[0],
              positionAr: u.job_title_ar || (u.role_name === "super_admin" ? "مدير النظام" : "موظف"),
              positionEn: u.role_name === "super_admin" ? "System Administrator" : "Employee",
              department: u.department || "",
              email: u.email,
              phone: u.phone || "",
              status: "active",
              joinDate: u.created_at ? u.created_at.split("T")[0] : new Date().toISOString().split("T")[0],
              salary: { basic: 0, housing: 0, transport: 0, other: 0 },
              initials: (u.name_ar || u.name_en || u.email).charAt(0).toUpperCase(),
              color: "bg-primary",
              profileCompleted: u.profile_completed ?? false,
            });
          }

          if (newEmployees.length === 0) return prev;
          return { ...prev, employees: [...prev.employees, ...newEmployees] };
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
    const today = new Date().toISOString().split("T")[0];

    await supabase.from("attendance")
      .update({ check_out: time })
      .eq("employee_id", userId)
      .eq("date", today);

    await refreshAttendance();
  }, [refreshAttendance]);

  // ── Leave Requests (Supabase) ──

  const submitLeaveRequest = useCallback(async (req: Omit<LeaveReq, "id">) => {
    const userId = await getSessionUserId();

    await supabase.from("leave_requests").insert({
      employee_id: userId,
      type: req.typeKey,
      start_date: req.startDate,
      end_date: req.endDate,
      days: req.days,
      reason: req.reasonAr || req.reasonEn,
      status: "pending",
    });

    await refreshLeaveRequests();

    notifyAdmins({
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

    await supabase.from("leave_requests").update({
      status: "approved",
      reviewed_by: userId,
      reviewed_at: new Date().toISOString(),
    }).eq("id", id);

    await refreshLeaveRequests();

    const req = state.leaveRequests.find((r) => r.id === id);
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
  }, [refreshLeaveRequests, state.leaveRequests]);

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

    await supabase.from("employee_requests").insert({
      employee_id: userId,
      type_key: req.typeKey,
      date: req.date || new Date().toISOString().split("T")[0],
      status: "pending",
      details_ar: req.detailsAr,
      details_en: req.detailsEn,
    });

    await refreshEmployeeRequests();
  }, [refreshEmployeeRequests]);

  // ── Salary Advance (Supabase) ──

  const submitAdvance = useCallback(async (adv: Omit<SalaryAdvance, "id">) => {
    const userId = await getSessionUserId();

    await supabase.from("salary_advances").insert({
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
    });

    await refreshSalaryAdvances();
  }, [refreshSalaryAdvances]);

  // ── Attendance Adjustment (Supabase) ──

  const submitAdjustment = useCallback(async (adj: Omit<AttendanceAdjustment, "id">) => {
    const userId = await getSessionUserId();

    await supabase.from("attendance_adjustments").insert({
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

    await refreshAttendanceAdjustments();
  }, [refreshAttendanceAdjustments]);

  // ── Generic Approve/Reject (Supabase) ──

  const approveItem = useCallback(async (
    collection: "employeeRequests" | "salaryAdvances" | "attendanceAdjustments",
    id: string
  ) => {
    const userId = await getSessionUserId();
    const table = SUPA_TABLE[collection];

    await supabase.from(table).update({
      status: "approved",
      reviewed_by: userId,
      reviewed_at: new Date().toISOString(),
    }).eq("id", id);

    // Refresh the relevant collection
    if (collection === "employeeRequests") await refreshEmployeeRequests();
    else if (collection === "salaryAdvances") await refreshSalaryAdvances();
    else if (collection === "attendanceAdjustments") await refreshAttendanceAdjustments();
  }, [refreshEmployeeRequests, refreshSalaryAdvances, refreshAttendanceAdjustments]);

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
      sent_date: inv.sentDate || new Date().toISOString().split("T")[0],
      status: "pending",
      invited_by: userId,
    });

    await refreshInvitations();
  }, [refreshInvitations]);

  const resendInvitation = useCallback(async (id: string) => {
    await supabase.from("pending_invitations").update({
      status: "pending",
      sent_date: new Date().toISOString().split("T")[0],
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

  // ── Settings (local only) ──

  const updateSettings = useCallback((updates: Partial<AppSettings>) => {
    setState((p) => ({
      ...p,
      settings: { ...p.settings, ...updates },
    }));
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
      const alreadyExists = p.employees.some(
        (e) => e.email.toLowerCase() === email.toLowerCase()
      );
      if (alreadyExists) return p;
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

      // Update invitation status in Supabase
      supabase.from("pending_invitations").update({ status: "expired" }).eq("id", inv.id);

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
    (id: string, data: Partial<Employee>) => {
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
