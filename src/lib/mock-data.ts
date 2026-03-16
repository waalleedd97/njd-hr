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
  { id: "EMP001", nameAr: "أحمد الغامدي", nameEn: "Ahmed Al-Ghamdi", positionAr: "مدير الموارد البشرية", positionEn: "HR Manager", department: "hr", email: "ahmed@njdgames.com", phone: "+966 50 123 4567", status: "active", joinDate: "2022-01-15", salary: { basic: 15000, housing: 3750, transport: 1500, other: 500 }, initials: "أغ", color: "bg-blue-500" },
  { id: "EMP002", nameAr: "فاطمة العتيبي", nameEn: "Fatima Al-Otaibi", positionAr: "محاسبة أولى", positionEn: "Senior Accountant", department: "finance", email: "fatima@njdgames.com", phone: "+966 50 234 5678", status: "active", joinDate: "2022-03-20", salary: { basic: 12000, housing: 3000, transport: 1500, other: 300 }, initials: "فع", color: "bg-emerald-500" },
  { id: "EMP003", nameAr: "محمد الشهري", nameEn: "Mohammed Al-Shahri", positionAr: "مطور برمجيات أول", positionEn: "Senior Developer", department: "software-dev", email: "mohammed@njdgames.com", phone: "+966 55 345 6789", status: "active", joinDate: "2021-08-10", salary: { basic: 18000, housing: 4500, transport: 1500, other: 1000 }, initials: "مش", color: "bg-amber-500" },
  { id: "EMP004", nameAr: "نورة القحطاني", nameEn: "Noura Al-Qahtani", positionAr: "مصممة UI/UX", positionEn: "UI/UX Designer", department: "design", email: "noura@njdgames.com", phone: "+966 54 456 7890", status: "active", joinDate: "2023-02-01", salary: { basic: 13000, housing: 3250, transport: 1500, other: 500 }, initials: "نق", color: "bg-rose-500" },
  { id: "EMP005", nameAr: "خالد الدوسري", nameEn: "Khaled Al-Dosari", positionAr: "محلل بيانات", positionEn: "Data Analyst", department: "software-dev", email: "khaled@njdgames.com", phone: "+966 56 567 8901", status: "active", joinDate: "2023-06-15", salary: { basic: 11000, housing: 2750, transport: 1500, other: 300 }, initials: "خد", color: "bg-purple-500" },
  { id: "EMP006", nameAr: "سارة الحربي", nameEn: "Sarah Al-Harbi", positionAr: "أخصائية تسويق", positionEn: "Marketing Specialist", department: "marketing", email: "sarah@njdgames.com", phone: "+966 50 678 9012", status: "active", joinDate: "2023-09-01", salary: { basic: 10000, housing: 2500, transport: 1500, other: 200 }, initials: "سح", color: "bg-cyan-500" },
  { id: "EMP007", nameAr: "عبدالله المطيري", nameEn: "Abdullah Al-Mutairi", positionAr: "مطور ألعاب", positionEn: "Game Developer", department: "game-dev", email: "abdullah@njdgames.com", phone: "+966 55 789 0123", status: "on-leave", joinDate: "2022-05-20", salary: { basic: 16000, housing: 4000, transport: 1500, other: 800 }, initials: "عم", color: "bg-orange-500" },
  { id: "EMP008", nameAr: "هند الزهراني", nameEn: "Hind Al-Zahrani", positionAr: "أخصائية موارد بشرية", positionEn: "HR Specialist", department: "hr", email: "hind@njdgames.com", phone: "+966 54 890 1234", status: "on-leave", joinDate: "2023-01-10", salary: { basic: 9000, housing: 2250, transport: 1500, other: 200 }, initials: "هز", color: "bg-teal-500" },
  { id: "EMP009", nameAr: "يوسف العمري", nameEn: "Yousef Al-Amri", positionAr: "مصمم جرافيك", positionEn: "Graphic Designer", department: "design", email: "yousef@njdgames.com", phone: "+966 56 901 2345", status: "on-leave", joinDate: "2023-04-15", salary: { basic: 10000, housing: 2500, transport: 1500, other: 300 }, initials: "يع", color: "bg-pink-500" },
  { id: "EMP010", nameAr: "ريم السبيعي", nameEn: "Reem Al-Subaie", positionAr: "مديرة مشاريع", positionEn: "Project Manager", department: "project-mgmt", email: "reem@njdgames.com", phone: "+966 50 012 3456", status: "active", joinDate: "2022-11-01", salary: { basic: 14000, housing: 3500, transport: 1500, other: 600 }, initials: "رس", color: "bg-indigo-500" },
  { id: "EMP011", nameAr: "عمر الحازمي", nameEn: "Omar Al-Hazmi", positionAr: "مهندس DevOps", positionEn: "DevOps Engineer", department: "software-dev", email: "omar@njdgames.com", phone: "+966 55 123 4567", status: "active", joinDate: "2023-07-20", salary: { basic: 17000, housing: 4250, transport: 1500, other: 900 }, initials: "عح", color: "bg-lime-600" },
  { id: "EMP012", nameAr: "لمى الراشد", nameEn: "Lama Al-Rashed", positionAr: "محللة أعمال", positionEn: "Business Analyst", department: "project-mgmt", email: "lama@njdgames.com", phone: "+966 54 234 5678", status: "active", joinDate: "2024-01-05", salary: { basic: 11000, housing: 2750, transport: 1500, other: 400 }, initials: "لر", color: "bg-red-500" },
  { id: "EMP013", nameAr: "تركي المالكي", nameEn: "Turki Al-Malki", positionAr: "مطور واجهات أمامية", positionEn: "Frontend Developer", department: "software-dev", email: "turki@njdgames.com", phone: "+966 56 345 6789", status: "active", joinDate: "2024-02-15", salary: { basic: 14000, housing: 3500, transport: 1500, other: 500 }, initials: "تم", color: "bg-violet-500" },
];

export const todayAttendance = [
  { employeeId: "EMP001", checkIn: "08:02", checkOut: "17:05", status: "present" as const },
  { employeeId: "EMP002", checkIn: "07:55", checkOut: "17:00", status: "present" as const },
  { employeeId: "EMP003", checkIn: "08:35", checkOut: "17:30", status: "late" as const },
  { employeeId: "EMP004", checkIn: "08:00", checkOut: "17:10", status: "present" as const },
  { employeeId: "EMP005", checkIn: "09:10", checkOut: "17:00", status: "late" as const },
  { employeeId: "EMP006", checkIn: "08:05", checkOut: null, status: "present" as const },
  { employeeId: "EMP007", checkIn: null, checkOut: null, status: "on-leave" as const },
  { employeeId: "EMP008", checkIn: null, checkOut: null, status: "on-leave" as const },
  { employeeId: "EMP009", checkIn: null, checkOut: null, status: "on-leave" as const },
  { employeeId: "EMP010", checkIn: "08:00", checkOut: "17:15", status: "present" as const },
  { employeeId: "EMP011", checkIn: null, checkOut: null, status: "absent" as const },
  { employeeId: "EMP012", checkIn: "07:50", checkOut: "12:00", status: "half-day" as const },
  { employeeId: "EMP013", checkIn: "08:10", checkOut: "17:00", status: "present" as const },
];

export const leaveBalances = [
  { typeKey: "annual", total: 21, used: 8, remaining: 13 },
  { typeKey: "sick", total: 10, used: 2, remaining: 8 },
  { typeKey: "personal", total: 5, used: 1, remaining: 4 },
  { typeKey: "unpaid", total: 30, used: 0, remaining: 30 },
  { typeKey: "marriage", total: 5, used: 0, remaining: 5 },
  { typeKey: "paternity", total: 3, used: 0, remaining: 3 },
];

export const leaveRequests = [
  { id: "LR001", employeeId: "EMP007", typeKey: "annual", startDate: "2026-03-14", endDate: "2026-03-17", days: 4, status: "approved" as const, reasonAr: "إجازة عائلية", reasonEn: "Family vacation" },
  { id: "LR002", employeeId: "EMP008", typeKey: "sick", startDate: "2026-03-15", endDate: "2026-03-16", days: 2, status: "approved" as const, reasonAr: "مراجعة طبية", reasonEn: "Medical appointment" },
  { id: "LR003", employeeId: "EMP002", typeKey: "annual", startDate: "2026-03-20", endDate: "2026-03-22", days: 3, status: "pending" as const, reasonAr: "سفر شخصي", reasonEn: "Personal travel" },
  { id: "LR004", employeeId: "EMP009", typeKey: "personal", startDate: "2026-03-15", endDate: "2026-03-18", days: 4, status: "approved" as const, reasonAr: "ظروف شخصية", reasonEn: "Personal matters" },
  { id: "LR005", employeeId: "EMP006", typeKey: "annual", startDate: "2026-03-25", endDate: "2026-03-27", days: 3, status: "pending" as const, reasonAr: "إجازة قصيرة", reasonEn: "Short break" },
  { id: "LR006", employeeId: "EMP013", typeKey: "sick", startDate: "2026-03-28", endDate: "2026-03-28", days: 1, status: "pending" as const, reasonAr: "كشف طبي", reasonEn: "Medical check-up" },
];

export const employeeRequests = [
  { id: "REQ001", employeeId: "EMP002", typeKey: "leaveRequest", date: "2026-03-14", status: "pending" as const, detailsAr: "طلب إجازة سنوية لمدة 3 أيام", detailsEn: "3-day annual leave request" },
  { id: "REQ002", employeeId: "EMP003", typeKey: "salaryCert", date: "2026-03-13", status: "in-review" as const, detailsAr: "شهادة راتب لتقديم طلب تمويل", detailsEn: "Salary cert for loan application" },
  { id: "REQ003", employeeId: "EMP004", typeKey: "permission", date: "2026-03-13", status: "approved" as const, detailsAr: "إذن خروج مبكر الساعة 3 عصراً", detailsEn: "Early leave at 3 PM" },
  { id: "REQ004", employeeId: "EMP005", typeKey: "docRequest", date: "2026-03-12", status: "pending" as const, detailsAr: "طلب خطاب تعريف بالراتب", detailsEn: "Salary introduction letter" },
  { id: "REQ005", employeeId: "EMP006", typeKey: "leaveRequest", date: "2026-03-11", status: "pending" as const, detailsAr: "طلب إجازة سنوية لمدة 3 أيام", detailsEn: "3-day annual leave request" },
  { id: "REQ006", employeeId: "EMP010", typeKey: "salaryCert", date: "2026-03-10", status: "approved" as const, detailsAr: "شهادة راتب للسفارة", detailsEn: "Salary cert for embassy" },
  { id: "REQ007", employeeId: "EMP001", typeKey: "permission", date: "2026-03-09", status: "approved" as const, detailsAr: "إذن تأخر صباحي", detailsEn: "Late arrival permission" },
  { id: "REQ008", employeeId: "EMP013", typeKey: "leaveRequest", date: "2026-03-08", status: "rejected" as const, detailsAr: "طلب إجازة مرضية يوم واحد", detailsEn: "1-day sick leave" },
];

export const branches = [
  { id: "BR001", nameAr: "المقر الرئيسي", nameEn: "Headquarters", cityAr: "الرياض", cityEn: "Riyadh", employeeCount: 85, isMain: true },
  { id: "BR002", nameAr: "فرع جدة", nameEn: "Jeddah Branch", cityAr: "جدة", cityEn: "Jeddah", employeeCount: 28, isMain: false },
  { id: "BR003", nameAr: "فرع الدمام", nameEn: "Dammam Branch", cityAr: "الدمام", cityEn: "Dammam", employeeCount: 14, isMain: false },
];

export const roles = [
  { id: "R001", nameAr: "مدير النظام", nameEn: "System Admin", users: 2, permissions: ["all"] },
  { id: "R002", nameAr: "مدير الموارد البشرية", nameEn: "HR Manager", users: 3, permissions: ["employees", "attendance", "leaves", "payroll", "requests", "reports"] },
  { id: "R003", nameAr: "مشرف", nameEn: "Supervisor", users: 5, permissions: ["attendance", "leaves", "requests"] },
  { id: "R004", nameAr: "موظف", nameEn: "Employee", users: 118, permissions: ["self-service"] },
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

export const notifications: Notification[] = [
  { id: "N001", type: "leave", titleAr: "إجازة موافق عليها", titleEn: "Leave Approved", descAr: "تمت الموافقة على طلب إجازة فاطمة العتيبي (3 أيام)", descEn: "Fatima Al-Otaibi's leave request approved (3 days)", time: 5, read: false, href: "/leaves" },
  { id: "N002", type: "request", titleAr: "طلب جديد", titleEn: "New Request", descAr: "طلب شهادة راتب جديد من محمد الشهري", descEn: "New salary certificate request from Mohammed Al-Shahri", time: 18, read: false, href: "/requests" },
  { id: "N003", type: "payroll", titleAr: "تحويل الرواتب", titleEn: "Payroll Transfer", descAr: "تم تحويل رواتب شهر مارس بنجاح عبر نظام حماية الأجور", descEn: "March salaries transferred successfully via WPS", time: 45, read: false, href: "/payroll" },
  { id: "N004", type: "attendance", titleAr: "تنبيه حضور", titleEn: "Attendance Alert", descAr: "تأخر خالد الدوسري عن الحضور اليوم 70 دقيقة", descEn: "Khaled Al-Dosari was 70 minutes late today", time: 90, read: false, href: "/attendance" },
  { id: "N005", type: "request", titleAr: "طلب جديد", titleEn: "New Request", descAr: "طلب إذن خروج مبكر من نورة القحطاني", descEn: "Early leave permission request from Noura Al-Qahtani", time: 120, read: true, href: "/requests" },
  { id: "N006", type: "system", titleAr: "تنبيه النظام", titleEn: "System Alert", descAr: "اقتراب موعد انتهاء عقد عمر الحازمي — 15 أبريل 2026", descEn: "Omar Al-Hazmi's contract expiring — April 15, 2026", time: 180, read: true, href: "/employees" },
  { id: "N007", type: "system", titleAr: "تحديث السياسات", titleEn: "Policy Update", descAr: "تم تحديث سياسة الإجازات السنوية — يرجى المراجعة", descEn: "Annual leave policy updated — please review", time: 300, read: true, href: "/settings" },
];

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

export const salaryAdvances: SalaryAdvance[] = [
  { id: "ADV001", employeeId: "EMP003", amount: 10000, reasonAr: "ظروف شخصية", reasonEn: "Personal circumstances", requestDate: "2026-02-15", status: "approved", repaymentMonths: 3, monthlyDeduction: 3334, remainingBalance: 6666, paidMonths: 1 },
  { id: "ADV002", employeeId: "EMP006", amount: 5000, reasonAr: "حالة طارئة", reasonEn: "Emergency", requestDate: "2026-03-10", status: "pending", repaymentMonths: 2, monthlyDeduction: 2500, remainingBalance: 5000, paidMonths: 0 },
];

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

export const attendanceAdjustments: AttendanceAdjustment[] = [
  { id: "ADJ001", employeeId: "EMP003", date: "2026-03-14", originalIn: "08:35", requestedIn: "08:05", originalOut: "17:30", requestedOut: "17:30", reasonAr: "خطأ في تسجيل البصمة", reasonEn: "Fingerprint registration error", status: "pending" },
  { id: "ADJ002", employeeId: "EMP005", date: "2026-03-13", originalIn: "09:10", requestedIn: "08:00", originalOut: "17:00", requestedOut: "17:00", reasonAr: "نسيت تسجيل الحضور", reasonEn: "Forgot to clock in", status: "approved" },
];

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

export const pendingInvitations: PendingInvitation[] = [
  { id: "INV001", email: "ali.ahmed@njdgames.com", nameAr: "علي أحمد", nameEn: "Ali Ahmed", department: "game-dev", positionAr: "مطور ألعاب مبتدئ", positionEn: "Junior Game Developer", sentDate: "2026-03-13", status: "pending" },
  { id: "INV002", email: "maha.saeed@njdgames.com", nameAr: "مها سعيد", nameEn: "Maha Saeed", department: "marketing", positionAr: "منسقة تسويق", positionEn: "Marketing Coordinator", sentDate: "2026-03-10", status: "expired" },
];
