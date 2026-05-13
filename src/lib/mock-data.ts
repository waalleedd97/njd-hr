export interface UploadedDocument {
  name: string;
  type: string;
  size: number;
  uploadedAt: string;
}

export interface Employee {
  id: string;
  /** Human-friendly 3-digit staff number (e.g. "001"). Distinct from `id`
   *  which stays the technical Supabase UUID for FK joins. */
  employeeNumber?: string;
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
  passportNumber?: string;
  emergencyPhone?: string;
  bankName?: string;
  iban?: string;
  nationality?: string;
  gender?: string;
  universityMajorAr?: string;
  universityMajorEn?: string;
  baseSalary?: number;
  allowances?: number;
  documents?: {
    nationalIdDoc?: UploadedDocument;
    cv?: UploadedDocument;
    qualification?: UploadedDocument;
    passport?: UploadedDocument;
  };
  locationRequired?: boolean;
  /** Supabase UUID of the direct line manager — used by the Org Chart tab */
  managerId?: string | null;
}

// ─── Employee Assets (company-issued equipment) ─────────────────────

export type AssetType = "laptop" | "phone" | "vehicle" | "sim" | "access_card" | "other";
export type AssetStatus = "issued" | "returned" | "lost" | "damaged";

export interface EmployeeAsset {
  id: string;
  employeeId: string;
  assetType: AssetType;
  nameAr: string;
  nameEn: string;
  serialNumber?: string;
  notes?: string;
  issuedAt: string;        // ISO date (YYYY-MM-DD)
  returnedAt?: string | null;
  status: AssetStatus;
  issuedBy?: string | null; // UUID of admin who issued
}

/** Asset type → icon + color metadata for the UI */
export const ASSET_TYPES: Record<AssetType, { iconName: string; tone: string }> = {
  laptop:      { iconName: "laptop_mac",       tone: "text-blue-600 dark:text-blue-400" },
  phone:       { iconName: "smartphone",       tone: "text-emerald-600 dark:text-emerald-400" },
  vehicle:     { iconName: "directions_car",   tone: "text-amber-600 dark:text-amber-400" },
  sim:         { iconName: "sim_card",         tone: "text-tertiary" },
  access_card: { iconName: "badge",            tone: "text-purple-600 dark:text-purple-400" },
  other:       { iconName: "category",         tone: "text-on-surface-variant" },
};

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
  { typeKey: "unpaid", total: 30, used: 0, remaining: 30 },
];

export const leaveRequests: { id: string; employeeId: string; typeKey: string; startDate: string; endDate: string; days: number; status: "pending" | "approved" | "rejected"; reasonAr: string; reasonEn: string }[] = [];

export const employeeRequests: { id: string; employeeId: string; typeKey: string; date: string; status: "pending" | "in-review" | "approved" | "rejected"; detailsAr: string; detailsEn: string }[] = [];

// Settings entities — backed by Supabase tables (branches/custom_roles/compliance_items)
// after first refresh; defaults below ensure UI never shows empty tables.

export interface Branch {
  id: string;
  nameAr: string;
  nameEn: string;
  cityAr: string;
  cityEn: string;
  employeeCount: number;
  isMain: boolean;
}

export interface Role {
  id: string;
  nameAr: string;
  nameEn: string;
  users: number;
  permissions: string[];
}

export interface ComplianceItem {
  id: string;
  titleAr: string;
  titleEn: string;
  descAr: string;
  descEn: string;
  compliant: boolean;
  reviewedAt?: string;
}

export const branches: Branch[] = [
  { id: "BR001", nameAr: "المقر الرئيسي", nameEn: "Headquarters", cityAr: "الرياض", cityEn: "Riyadh", employeeCount: 1, isMain: true },
];

export const roles: Role[] = [
  { id: "R001", nameAr: "مدير النظام", nameEn: "System Admin", users: 1, permissions: ["all"] },
  { id: "R002", nameAr: "مدير الموارد البشرية", nameEn: "HR Manager", users: 0, permissions: ["employees", "attendance", "leaves", "payroll", "requests", "reports"] },
  { id: "R003", nameAr: "مشرف", nameEn: "Supervisor", users: 0, permissions: ["attendance", "leaves", "requests"] },
  { id: "R004", nameAr: "موظف", nameEn: "Employee", users: 0, permissions: ["self-service"] },
];

export const complianceItems: ComplianceItem[] = [
  { id: "C001", titleAr: "عقود العمل", titleEn: "Employment Contracts", descAr: "جميع الموظفين لديهم عقود عمل موقعة ومحدثة", descEn: "All employees have signed and updated contracts", compliant: true },
  { id: "C002", titleAr: "تسجيل التأمينات الاجتماعية", titleEn: "GOSI Registration", descAr: "جميع الموظفين مسجلين في نظام التأمينات الاجتماعية", descEn: "All employees registered in GOSI system", compliant: true },
  { id: "C003", titleAr: "نسبة السعودة", titleEn: "Saudization (Nitaqat)", descAr: "الشركة في النطاق الأخضر المرتفع", descEn: "Company in high green zone", compliant: true },
  { id: "C004", titleAr: "حماية الأجور", titleEn: "Wage Protection (WPS)", descAr: "تحويل الرواتب عبر نظام حماية الأجور", descEn: "Salaries transferred via WPS system", compliant: true },
  { id: "C005", titleAr: "ساعات العمل", titleEn: "Working Hours", descAr: "الالتزام بحد أقصى 48 ساعة عمل أسبوعياً", descEn: "Maximum 48 working hours per week observed", compliant: true },
  { id: "C006", titleAr: "الإجازات السنوية", titleEn: "Annual Leave", descAr: "توفير 21 يوم إجازة سنوية كحد أدنى", descEn: "Minimum 21 days annual leave provided", compliant: true },
  { id: "C007", titleAr: "سياسة نهاية الخدمة", titleEn: "End of Service Policy", descAr: "حساب مكافأة نهاية الخدمة وفق نظام العمل", descEn: "End of service benefits calculated per labor law", compliant: true },
  { id: "C008", titleAr: "التأمين الطبي", titleEn: "Medical Insurance", descAr: "توفير تأمين طبي لجميع الموظفين وعائلاتهم", descEn: "Medical insurance for all employees and families", compliant: false },
  { id: "C009", titleAr: "سياسة التحرش", titleEn: "Anti-Harassment Policy", descAr: "وجود سياسة مكتوبة لمنع التحرش في بيئة العمل", descEn: "Written anti-harassment workplace policy", compliant: true },
  { id: "C010", titleAr: "السلامة المهنية", titleEn: "Occupational Safety", descAr: "الالتزام بمعايير السلامة والصحة المهنية", descEn: "Compliance with OHS standards", compliant: false },
];

/** Available permission keys used by Settings → Roles editor. */
export const ROLE_PERMISSIONS = [
  "all",
  "self-service",
  "employees",
  "attendance",
  "leaves",
  "payroll",
  "requests",
  "reports",
  "settings",
] as const;
export type RolePermission = typeof ROLE_PERMISSIONS[number];

export function getEmployeeById(id: string) {
  return employees.find((e) => e.id === id);
}

export function calcDuration(checkIn: string | null, checkOut: string | null): string {
  if (!checkIn || !checkOut) return "-";
  const [inH, inM] = checkIn.split(":").map(Number);
  const [outH, outM] = checkOut.split(":").map(Number);
  let mins = (outH * 60 + outM) - (inH * 60 + inM);
  // Check-out on next day (overnight shift): wrap around +24h.
  if (mins < 0) mins += 24 * 60;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}m`;
}

export const GOSI_RATE = 0.0975;
export const GOSI_RATE_COMPANY = 0.1225;

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

// Saudi public holidays for 2026.
// Note: Eid Al-Fitr and Eid Al-Adha follow the Hijri calendar — admin should
// confirm exact Gregorian dates each year via the official MHRSD announcement.
export const saudiHolidays: Holiday[] = [
  { id: "H001", nameAr: "يوم التأسيس", nameEn: "Founding Day", startDate: "2026-02-22", endDate: "2026-02-22", days: 1 },
  { id: "H002", nameAr: "عيد الفطر", nameEn: "Eid Al-Fitr", startDate: "2026-03-20", endDate: "2026-03-23", days: 4 },
  { id: "H003", nameAr: "عيد الأضحى", nameEn: "Eid Al-Adha", startDate: "2026-05-26", endDate: "2026-05-29", days: 4 },
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
  { id: "P001", conditionAr: "حضور 10:01 - 10:15 ص", conditionEn: "Check-in 10:01-10:15 AM", deductionAr: "بدون عقوبة (فترة سماح)", deductionEn: "No penalty (grace period)", minLate: 1, maxLate: 15, percentage: 0 },
  { id: "P002", conditionAr: "حضور 10:16 - 10:30 ص", conditionEn: "Check-in 10:16-10:30 AM", deductionAr: "تحذير", deductionEn: "Warning", minLate: 16, maxLate: 30, percentage: 0 },
  { id: "P003", conditionAr: "حضور 10:31 - 11:00 ص", conditionEn: "Check-in 10:31-11:00 AM", deductionAr: "5% من الراتب اليومي", deductionEn: "5% of daily salary", minLate: 31, maxLate: 60, percentage: 5 },
  { id: "P004", conditionAr: "حضور بعد 11:00 ص", conditionEn: "Check-in after 11:00 AM", deductionAr: "10% من الراتب اليومي", deductionEn: "10% of daily salary", minLate: 61, maxLate: 9999, percentage: 10 },
  { id: "P005", conditionAr: "غياب بدون عذر", conditionEn: "Absent without excuse", deductionAr: "خصم يوم كامل", deductionEn: "Full day deduction", minLate: -1, maxLate: -1, percentage: 100 },
];

export const earlyDepartureRules: PenaltyRule[] = [
  { id: "E001", conditionAr: "انصراف مبكر 1-15 دقيقة", conditionEn: "Left 1-15 min early", deductionAr: "بدون عقوبة", deductionEn: "No penalty", minLate: 1, maxLate: 15, percentage: 0 },
  { id: "E002", conditionAr: "انصراف مبكر 16-30 دقيقة", conditionEn: "Left 16-30 min early", deductionAr: "تحذير", deductionEn: "Warning", minLate: 16, maxLate: 30, percentage: 0 },
  { id: "E003", conditionAr: "انصراف مبكر 31-60 دقيقة", conditionEn: "Left 31-60 min early", deductionAr: "5% من الراتب اليومي", deductionEn: "5% of daily salary", minLate: 31, maxLate: 60, percentage: 5 },
  { id: "E004", conditionAr: "انصراف مبكر أكثر من 60 دقيقة", conditionEn: "Left > 60 min early", deductionAr: "10% من الراتب اليومي", deductionEn: "10% of daily salary", minLate: 61, maxLate: 9999, percentage: 10 },
  { id: "E005", conditionAr: "انصراف بدون تسجيل خروج", conditionEn: "Left without checking out", deductionAr: "خصم يوم كامل حتى التصحيح", deductionEn: "Full day deduction until corrected", minLate: -1, maxLate: -1, percentage: 100 },
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
  officeLat: 24.787278,
  officeLng: 46.614306,
  radiusMeters: 1000,
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
