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
  todayAttendance as defaultAttendance,
  leaveBalances as defaultBalances,
  leaveRequests as defaultLeaveReqs,
  employeeRequests as defaultEmpReqs,
  salaryAdvances as defaultAdvances,
  attendanceAdjustments as defaultAdjustments,
  pendingInvitations as defaultInvitations,
  notifications as defaultNotifications,
  departments as defaultDepartments,
  type Employee,
  type Notification,
  type SalaryAdvance,
  type AttendanceAdjustment,
  type PendingInvitation,
} from "./mock-data";

// ─── Types ───────────────────────────────────────────────────────────

interface AttRecord {
  employeeId: string;
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
    todayAttendance: [...defaultAttendance] as AttRecord[],
    leaveBalances: [...defaultBalances],
    leaveRequests: [...defaultLeaveReqs] as LeaveReq[],
    employeeRequests: [...defaultEmpReqs] as EmpReq[],
    salaryAdvances: [...defaultAdvances],
    attendanceAdjustments: [...defaultAdjustments],
    pendingInvitations: [...defaultInvitations],
    notifications: [...defaultNotifications],
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

// ─── Context ─────────────────────────────────────────────────────────

interface DataContextType extends DataState {
  // Attendance
  clockIn: (employeeId: string, time: string) => void;
  clockOut: (employeeId: string, time: string) => void;

  // Leave
  submitLeaveRequest: (req: Omit<LeaveReq, "id">) => void;

  // Employee Requests
  submitEmployeeRequest: (req: Omit<EmpReq, "id">) => void;

  // Salary Advance
  submitAdvance: (adv: Omit<SalaryAdvance, "id">) => void;

  // Attendance Adjustment
  submitAdjustment: (adj: Omit<AttendanceAdjustment, "id">) => void;

  // Generic approve/reject (works on any collection with id + status)
  approveItem: (
    collection:
      | "leaveRequests"
      | "employeeRequests"
      | "salaryAdvances"
      | "attendanceAdjustments",
    id: string
  ) => void;
  rejectItem: (
    collection:
      | "leaveRequests"
      | "employeeRequests"
      | "salaryAdvances"
      | "attendanceAdjustments",
    id: string
  ) => void;

  // Invitations
  sendInvitation: (inv: Omit<PendingInvitation, "id">) => void;
  resendInvitation: (id: string) => void;

  // Notifications
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  addNotification: (n: Omit<Notification, "id">) => void;

  // Employees
  updateEmployee: (id: string, updates: Partial<Employee>) => void;

  // Settings
  updateSettings: (updates: Partial<AppSettings>) => void;

  // Departments
  addDepartment: (key: string, ar: string, en: string) => void;
  updateDepartment: (key: string, ar: string, en: string) => void;
  removeDepartment: (key: string) => void;

  // Profile completion (for invited employees)
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

// ─── Provider ────────────────────────────────────────────────────────

const STORAGE_KEY = "njd-hr-data";

export function DataProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DataState>(getDefaultState);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from localStorage after mount (merge with defaults so new fields are preserved)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setState((defaults) => ({ ...defaults, ...parsed }));
      }
    } catch {
      // ignore parse errors
    }
    setHydrated(true);
  }, []);

  // Persist to localStorage on every change (after hydration)
  useEffect(() => {
    if (hydrated) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
  }, [state, hydrated]);

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

  // ── Actions ──

  const clockIn = useCallback((employeeId: string, time: string) => {
    setState((p) => {
      const exists = p.todayAttendance.some((a) => a.employeeId === employeeId);
      const attendance = exists
        ? p.todayAttendance.map((a) =>
            a.employeeId === employeeId
              ? { ...a, checkIn: time, status: "present" as const }
              : a
          )
        : [
            ...p.todayAttendance,
            { employeeId, checkIn: time, checkOut: null, status: "present" as const },
          ];
      return { ...p, todayAttendance: attendance };
    });
  }, []);

  const clockOut = useCallback((employeeId: string, time: string) => {
    setState((p) => ({
      ...p,
      todayAttendance: p.todayAttendance.map((a) =>
        a.employeeId === employeeId ? { ...a, checkOut: time } : a
      ),
    }));
  }, []);

  const submitLeaveRequest = useCallback((req: Omit<LeaveReq, "id">) => {
    const newReq = { ...req, id: genId("LR") };
    setState((p) => ({
      ...p,
      leaveRequests: [newReq, ...p.leaveRequests],
      notifications: [
        {
          id: genId("N"),
          type: "request" as const,
          titleAr: "طلب إجازة جديد",
          titleEn: "New Leave Request",
          descAr: `طلب إجازة جديد بانتظار الموافقة`,
          descEn: `New leave request pending approval`,
          time: 0,
          read: false,
          href: "/leaves",
        },
        ...p.notifications,
      ],
    }));
  }, []);

  const submitEmployeeRequest = useCallback((req: Omit<EmpReq, "id">) => {
    setState((p) => ({
      ...p,
      employeeRequests: [{ ...req, id: genId("REQ") }, ...p.employeeRequests],
    }));
  }, []);

  const submitAdvance = useCallback((adv: Omit<SalaryAdvance, "id">) => {
    setState((p) => ({
      ...p,
      salaryAdvances: [{ ...adv, id: genId("ADV") }, ...p.salaryAdvances],
    }));
  }, []);

  const submitAdjustment = useCallback(
    (adj: Omit<AttendanceAdjustment, "id">) => {
      setState((p) => ({
        ...p,
        attendanceAdjustments: [
          { ...adj, id: genId("ADJ") },
          ...p.attendanceAdjustments,
        ],
      }));
    },
    []
  );

  const approveItem = useCallback(
    (
      collection:
        | "leaveRequests"
        | "employeeRequests"
        | "salaryAdvances"
        | "attendanceAdjustments",
      id: string
    ) => {
      setState((p) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const updated = (p[collection] as any[]).map((item: any) =>
          item.id === id ? { ...item, status: "approved" } : item
        );

        // If approving a leave request, update balances
        let balances = p.leaveBalances;
        if (collection === "leaveRequests") {
          const req = p.leaveRequests.find((r) => r.id === id);
          if (req && req.status === "pending") {
            balances = p.leaveBalances.map((b) =>
              b.typeKey === req.typeKey
                ? {
                    ...b,
                    used: b.used + req.days,
                    remaining: b.remaining - req.days,
                  }
                : b
            );
          }
        }

        return {
          ...p,
          [collection]: updated,
          leaveBalances: balances,
          notifications: [
            {
              id: genId("N"),
              type: "leave" as const,
              titleAr: "تمت الموافقة",
              titleEn: "Approved",
              descAr: "تمت الموافقة على الطلب بنجاح",
              descEn: "Request has been approved",
              time: 0,
              read: false,
              href: "/" + collection.replace("Requests", "").replace("Adjustments", ""),
            },
            ...p.notifications,
          ],
        };
      });
    },
    []
  );

  const rejectItem = useCallback(
    (
      collection:
        | "leaveRequests"
        | "employeeRequests"
        | "salaryAdvances"
        | "attendanceAdjustments",
      id: string
    ) => {
      setState((p) => ({
        ...p,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        [collection]: (p[collection] as any[]).map((item: any) =>
          item.id === id ? { ...item, status: "rejected" } : item
        ),
      }));
    },
    []
  );

  const sendInvitation = useCallback((inv: Omit<PendingInvitation, "id">) => {
    setState((p) => ({
      ...p,
      pendingInvitations: [
        { ...inv, id: genId("INV") },
        ...p.pendingInvitations,
      ],
    }));
  }, []);

  const resendInvitation = useCallback((id: string) => {
    setState((p) => ({
      ...p,
      pendingInvitations: p.pendingInvitations.map((inv) =>
        inv.id === id
          ? {
              ...inv,
              status: "pending" as const,
              sentDate: new Date().toISOString().split("T")[0],
            }
          : inv
      ),
    }));
  }, []);

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

  const updateSettings = useCallback((updates: Partial<AppSettings>) => {
    setState((p) => ({
      ...p,
      settings: { ...p.settings, ...updates },
    }));
  }, []);

  const processPayroll = useCallback(() => {
    setState((p) => ({
      ...p,
      payrollProcessed: true,
      notifications: [
        {
          id: genId("N"),
          type: "payroll" as const,
          titleAr: "تم تشغيل الرواتب",
          titleEn: "Payroll Processed",
          descAr: "تم معالجة رواتب الشهر الحالي بنجاح",
          descEn: "Current month payroll has been processed successfully",
          time: 0,
          read: false,
          href: "/payroll",
        },
        ...p.notifications,
      ],
    }));
  }, []);

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
    const fresh = getDefaultState();
    setState(fresh);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const value: DataContextType = {
    ...state,
    clockIn,
    clockOut,
    submitLeaveRequest,
    submitEmployeeRequest,
    submitAdvance,
    submitAdjustment,
    approveItem,
    rejectItem,
    sendInvitation,
    resendInvitation,
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
