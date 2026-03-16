export interface UploadedDocument {
  name: string;
  type: string;
  size: number;
  uploadedAt: string;
}

export interface Employee {
  id: string;
  nameAr: string;
  nameEn: string;
  positionAr: string;
  positionEn: string;
  department: string;
  email: string;
  phone: string;
  status: "active" | "on-leave" | "inactive";
  joinDate: string;
  salary: { basic: number; housing: number; transport: number; other: number };
  initials: string;
  color: string;
  profileCompleted?: boolean;
  // Extended profile fields (filled on first login)
  fullNameAr?: string;
  fullNameEn?: string;
  maritalStatus?: string;
  dateOfBirth?: string;
  mobileNumber?: string;
  nationalId?: string;
  bankName?: string;
  iban?: string;
  nationality?: string;
  documents?: {
    nationalIdDoc?: UploadedDocument;
    cv?: UploadedDocument;
    qualification?: UploadedDocument;
    passport?: UploadedDocument;
  };
}

export const departments: Record<string, { ar: string; en: string }> = {
  "software-dev": { ar: "تطوير البرمجيات", en: "Software Development" },
  "game-dev": { ar: "تطوير الألعاب", en: "Game Development" },
  design: { ar: "التصميم", en: "Design" },
  hr: { ar: "الموارد البشرية", en: "Human Resources" },
  marketing: { ar: "التسويق", en: "Marketing" },
  finance: { ar: "الشؤون المالية", en: "Finance" },
  "project-mgmt": { ar: "إدارة المشاريع", en: "Project Management" },
};

export const employees: Employee[] = [
  { id: "EMP001", nameAr: "وليد", nameEn: "Waleed", positionAr: "مدير النظام", positionEn: "System Administrator", department: "hr", email: "waleed@njdstudio.net", phone: "", status: "active", joinDate: "2025-01-01", salary: { basic: 0, housing: 0, transport: 0, other: 0 }, initials: "و", color: "bg-primary", profileCompleted: true },
];

export const todayAttendance: { employeeId: string; checkIn: string | null; checkOut: string | null; status: "present" | "absent" | "late" | "on-leave" | "half-day" }[] = [];

export const leaveBalances = [
  { typeKey: "annual", total: 21, used: 0, remaining: 21 },
  { typeKey: "sick", total: 10, used: 0, remaining: 10 },
  { typeKey: "personal", total: 5, used: 0, remaining: 5 },
  { typeKey: "unpaid", total: 30, used: 0, remaining: 30 },
];

export const leaveRequests: { id: string; employeeId: string; typeKey: string; startDate: string; endDate: string; days: number; status: "pending" | "approved" | "rejected"; reasonAr: string; reasonEn: string }[] = [];

export const employeeRequests: { id: string; employeeId: string; typeKey: string; date: string; status: "pending" | "in-review" | "approved" | "rejected"; detailsAr: string; detailsEn: string }[] = [];

export const branches = [
  { id: "BR001", nameAr: "المقر الرئيسي", nameEn: "Headquarters", cityAr: "الرياض", cityEn: "Riyadh", employeeCount: 1, isMain: true },
];

export const roles = [
  { id: "R001", nameAr: "مدير النظام", nameEn: "System Admin", users: 1, permissions: ["all"] },
  { id: "R002", nameAr: "مدير الموارد البشرية", nameEn: "HR Manager", users: 0, permissions: ["employees", "attendance", "leaves", "payroll", "requests", "reports"] },
  { id: "R003", nameAr: "مشرف", nameEn: "Supervisor", users: 0, permissions: ["attendance", "leaves", "requests"] },
  { id: "R004", nameAr: "موظف", nameEn: "Employee", users: 0, permissions: ["self-service"] },
];

export const complianceItems = [
  { id: "C001", titleAr: "عقود العمل", titleEn: "Employment Contracts", descAr: "جميع الموظفين لديهم عقود عمل موقعة ومحدثة", descEn: "All employees have signed and updated contracts", compliant: true },
  { id: "C002", titleAr: "تسجيل التأمينات الاجتماعية", titleEn: "GOSI Registration", descAr: "جميع الموظفين مسجلين في نظام التأمينات الاجتماعية", descEn: "All employees registered in GOSI system", compliant: true },
  { id: "C003", titleAr: "نسبة السعودة", titleEn: "Saudization (Nitaqat)", descAr: "الشركة في النطاق الأخضر المرتفع بنسبة 72%", descEn: "Company in high green zone at 72%", compliant: true },
  { id: "C004", titleAr: "حماية الأجور", titleEn: "Wage Protection (WPS)", descAr: "تحويل الرواتب عبر نظام حماية الأجور", descEn: "Salaries transferred via WPS system", compliant: true },
  { id: "C005", titleAr: "ساعات العمل", titleEn: "Working Hours", descAr: "الالتزام بحد أقصى 48 ساعة عمل أسبوعياً", descEn: "Maximum 48 working hours per week observed", compliant: true },
  { id: "C006", titleAr: "الإجازات السنوية", titleEn: "Annual Leave", descAr: "توفير 21 يوم إجازة سنوية كحد أدنى", descEn: "Minimum 21 days annual leave provided", compliant: true },
  { id: "C007", titleAr: "سياسة نهاية الخدمة", titleEn: "End of Service Policy", descAr: "حساب مكافأة نهاية الخدمة وفق نظام العمل", descEn: "End of service benefits calculated per labor law", compliant: true },
  { id: "C008", titleAr: "التأمين الطبي", titleEn: "Medical Insurance", descAr: "توفير تأمين طبي لجميع الموظفين وعائلاتهم", descEn: "Medical insurance for all employees and families", compliant: false },
  { id: "C009", titleAr: "سياسة التحرش", titleEn: "Anti-Harassment Policy", descAr: "وجود سياسة مكتوبة لمنع التحرش في بيئة العمل", descEn: "Written anti-harassment workplace policy", compliant: true },
  { id: "C010", titleAr: "السلامة المهنية", titleEn: "Occupational Safety", descAr: "الالتزام بمعايير السلامة والصحة المهنية", descEn: "Compliance with OHS standards", compliant: false },
];

export function getEmployeeById(id: string) {
  return employees.find((e) => e.id === id);
}

export function calcDuration(checkIn: string | null, checkOut: string | null): string {
  if (!checkIn || !checkOut) return "-";
  const [inH, inM] = checkIn.split(":").map(Number);
  const [outH, outM] = checkOut.split(":").map(Number);
  const mins = (outH * 60 + outM) - (inH * 60 + inM);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}m`;
}

export const GOSI_RATE = 0.0975;

export interface Notification {
  id: string;
  type: "leave" | "request" | "payroll" | "attendance" | "system";
  titleAr: string;
  titleEn: string;
  descAr: string;
  descEn: string;
  time: number; // minutes ago
  read: boolean;
  href?: string;
}

export const notifications: Notification[] = [];

// ─── Saudi Public Holidays 2026 ──────────────────────────────────────

export interface Holiday {
  id: string;
  nameAr: string;
  nameEn: string;
  startDate: string;
  endDate: string;
  days: number;
}

export const saudiHolidays: Holiday[] = [
  { id: "H001", nameAr: "يوم التأسيس", nameEn: "Founding Day", startDate: "2026-02-22", endDate: "2026-02-22", days: 1 },
  { id: "H002", nameAr: "عيد الفطر", nameEn: "Eid Al-Fitr", startDate: "2026-03-30", endDate: "2026-04-02", days: 4 },
  { id: "H003", nameAr: "عيد الأضحى", nameEn: "Eid Al-Adha", startDate: "2026-06-06", endDate: "2026-06-09", days: 4 },
  { id: "H004", nameAr: "اليوم الوطني", nameEn: "National Day", startDate: "2026-09-23", endDate: "2026-09-23", days: 1 },
];

// ─── Penalty Rules (Saudi Labor Law) ─────────────────────────────────

export interface PenaltyRule {
  id: string;
  conditionAr: string;
  conditionEn: string;
  deductionAr: string;
  deductionEn: string;
  minLate: number;
  maxLate: number;
  percentage: number;
}

export const penaltyRules: PenaltyRule[] = [
  { id: "P001", conditionAr: "تأخر 1-15 دقيقة", conditionEn: "Late 1-15 min", deductionAr: "إنذار", deductionEn: "Warning", minLate: 1, maxLate: 15, percentage: 0 },
  { id: "P002", conditionAr: "تأخر 16-30 دقيقة", conditionEn: "Late 16-30 min", deductionAr: "5% من الراتب اليومي", deductionEn: "5% of daily salary", minLate: 16, maxLate: 30, percentage: 5 },
  { id: "P003", conditionAr: "تأخر 31-60 دقيقة", conditionEn: "Late 31-60 min", deductionAr: "10% من الراتب اليومي", deductionEn: "10% of daily salary", minLate: 31, maxLate: 60, percentage: 10 },
  { id: "P004", conditionAr: "تأخر أكثر من 60 دقيقة", conditionEn: "Late > 60 min", deductionAr: "25% من الراتب اليومي", deductionEn: "25% of daily salary", minLate: 61, maxLate: 9999, percentage: 25 },
  { id: "P005", conditionAr: "غياب بدون عذر", conditionEn: "Absent without excuse", deductionAr: "خصم يوم كامل", deductionEn: "Full day deduction", minLate: -1, maxLate: -1, percentage: 100 },
];

/** Calculate penalty percentage for given minutes late. Returns 0 for warning-only. */
export function calcPenalty(minutesLate: number): number {
  if (minutesLate <= 0) return 0;
  const rule = penaltyRules.find((r) => minutesLate >= r.minLate && minutesLate <= r.maxLate);
  return rule?.percentage ?? 0;
}

/** Calculate daily salary */
export function calcDailySalary(emp: Employee): number {
  const gross = emp.salary.basic + emp.salary.housing + emp.salary.transport + emp.salary.other;
  return Math.round(gross / 30);
}

// ─── Geofence Configuration ─────────────────────────────────────────

export const geofenceConfig = {
  enabled: true,
  officeLat: 24.7136,
  officeLng: 46.6753,
  radiusMeters: 200,
  officeNameAr: "مقر نجد قيمز — الرياض",
  officeNameEn: "NJD Games HQ — Riyadh",
};

// ─── Salary Advance Requests ─────────────────────────────────────────

export interface SalaryAdvance {
  id: string;
  employeeId: string;
  amount: number;
  reasonAr: string;
  reasonEn: string;
  requestDate: string;
  status: "pending" | "approved" | "rejected";
  repaymentMonths: number;
  monthlyDeduction: number;
  remainingBalance: number;
  paidMonths: number;
}

export const salaryAdvances: SalaryAdvance[] = [];

// ─── Attendance Adjustment Requests ──────────────────────────────────

export interface AttendanceAdjustment {
  id: string;
  employeeId: string;
  date: string;
  originalIn: string;
  requestedIn: string;
  originalOut: string;
  requestedOut: string;
  reasonAr: string;
  reasonEn: string;
  status: "pending" | "approved" | "rejected";
}

export const attendanceAdjustments: AttendanceAdjustment[] = [];

// ─── Pending Employee Invitations ────────────────────────────────────

export interface PendingInvitation {
  id: string;
  email: string;
  nameAr: string;
  nameEn: string;
  department: string;
  positionAr: string;
  positionEn: string;
  sentDate: string;
  status: "pending" | "expired";
}

export const pendingInvitations: PendingInvitation[] = [];
