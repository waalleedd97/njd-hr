"use client";

import { useRouter } from "next/navigation";
import { useLanguage } from "@/components/providers";
import { useData } from "@/lib/data-store";
import {
  EmployeesIcon,
  LeavesIcon,
  RequestsIcon,
  PayrollIcon,
} from "@/components/icons/module-icons";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn, formatDate } from "@/lib/utils";
import { useAuth } from "@/components/providers";
import { employees as allEmployees } from "@/lib/mock-data";
import { UserPlus, FilePlus, BarChart3, Banknote, CalendarDays, Clock } from "lucide-react";

// Mock data
const mockRequests = [
  {
    nameAr: "فاطمة العتيبي",
    nameEn: "Fatima Al-Otaibi",
    typeKey: "leaveRequest" as const,
    dateAr: "14 مارس",
    dateEn: "Mar 14",
    statusKey: "pending" as const,
    initialsAr: "فع",
  },
  {
    nameAr: "محمد الشهري",
    nameEn: "Mohammed Al-Shahri",
    typeKey: "salaryCert" as const,
    dateAr: "13 مارس",
    dateEn: "Mar 13",
    statusKey: "inReview" as const,
    initialsAr: "مش",
  },
  {
    nameAr: "نورة القحطاني",
    nameEn: "Noura Al-Qahtani",
    typeKey: "permission" as const,
    dateAr: "13 مارس",
    dateEn: "Mar 13",
    statusKey: "approved" as const,
    initialsAr: "نق",
  },
  {
    nameAr: "خالد الدوسري",
    nameEn: "Khaled Al-Dosari",
    typeKey: "docRequest" as const,
    dateAr: "12 مارس",
    dateEn: "Mar 12",
    statusKey: "pending" as const,
    initialsAr: "خد",
  },
  {
    nameAr: "سارة الحربي",
    nameEn: "Sarah Al-Harbi",
    typeKey: "leaveRequest" as const,
    dateAr: "11 مارس",
    dateEn: "Mar 11",
    statusKey: "pending" as const,
    initialsAr: "سح",
  },
];

const teamOnLeave = [
  {
    nameAr: "عبدالله المطيري",
    nameEn: "Abdullah Al-Mutairi",
    deptAr: "تطوير البرمجيات",
    deptEn: "Software Dev",
    returnAr: "17 مارس",
    returnEn: "Mar 17",
    initialsAr: "عم",
    color: "bg-blue-500",
  },
  {
    nameAr: "هند الزهراني",
    nameEn: "Hind Al-Zahrani",
    deptAr: "التصميم",
    deptEn: "Design",
    returnAr: "16 مارس",
    returnEn: "Mar 16",
    initialsAr: "هز",
    color: "bg-emerald-500",
  },
  {
    nameAr: "يوسف العمري",
    nameEn: "Yousef Al-Amri",
    deptAr: "التسويق",
    deptEn: "Marketing",
    returnAr: "18 مارس",
    returnEn: "Mar 18",
    initialsAr: "يع",
    color: "bg-amber-500",
  },
];

const statusStyles: Record<string, string> = {
  pending:
    "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-400 border-0",
  inReview:
    "bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-400 border-0",
  approved:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-400 border-0",
  rejected:
    "bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-400 border-0",
};

export default function DashboardPage() {
  const { t, lang } = useLanguage();
  const { isAdmin, user } = useAuth();
  const store = useData();
  const router = useRouter();
  const isAr = lang === "ar";

  const hour = new Date().getHours();
  const greeting =
    hour < 12
      ? t.greeting.morning
      : hour < 18
        ? t.greeting.afternoon
        : t.greeting.evening;

  const today = formatDate(new Date(), lang, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const adminStats = [
    { icon: EmployeesIcon, value: String(store.employees.length), label: t.stats.totalEmployees, trend: "+3" },
    { icon: LeavesIcon, value: String(store.employees.filter(e => e.status === "on-leave").length), label: t.stats.onLeave, trend: null },
    { icon: RequestsIcon, value: String(store.employeeRequests.filter(r => r.status === "pending").length), label: t.stats.pendingRequests, trend: "+5" },
    { icon: PayrollIcon, value: isAr ? "28 مارس" : "Mar 28", label: t.stats.nextPayroll, trend: null },
  ];

  const employeeStats = [
    { icon: LeavesIcon, value: String(store.leaveBalances.find(b => b.typeKey === "annual")?.remaining ?? 0), label: isAr ? "أيام إجازة متبقية" : "Leave Days Left", trend: null },
    { icon: RequestsIcon, value: String(store.employeeRequests.filter(r => r.employeeId === user.id && r.status === "pending").length), label: isAr ? "طلباتي المعلقة" : "My Pending Requests", trend: null },
    { icon: PayrollIcon, value: isAr ? "28 مارس" : "Mar 28", label: t.stats.nextPayroll, trend: null },
    { icon: EmployeesIcon, value: isAr ? "08:02" : "08:02", label: isAr ? "وقت الحضور اليوم" : "Today's Check-in", trend: null },
  ];

  const stats = isAdmin ? adminStats : employeeStats;

  const adminQuickActions = [
    { icon: UserPlus, label: t.actions.addEmployee, color: "bg-primary/10 text-primary", href: "/employees" },
    { icon: FilePlus, label: t.actions.newRequest, color: "bg-blue-500/10 text-blue-600 dark:text-blue-400", href: "/requests" },
    { icon: BarChart3, label: t.actions.viewReports, color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400", href: "/reports" },
    { icon: Banknote, label: t.actions.runPayroll, color: "bg-amber-500/10 text-amber-600 dark:text-amber-400", href: "/payroll" },
  ];

  const employeeQuickActions = [
    { icon: FilePlus, label: t.actions.newRequest, color: "bg-blue-500/10 text-blue-600 dark:text-blue-400", href: "/requests" },
    { icon: CalendarDays, label: isAr ? "طلب إجازة" : "Request Leave", color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400", href: "/leaves" },
    { icon: Clock, label: isAr ? "سجل الحضور" : "Attendance Log", color: "bg-amber-500/10 text-amber-600 dark:text-amber-400", href: "/attendance" },
    { icon: BarChart3, label: isAr ? "كشف الراتب" : "My Payslip", color: "bg-primary/10 text-primary", href: "/payroll" },
  ];

  const quickActions = isAdmin ? adminQuickActions : employeeQuickActions;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Greeting Card */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#7C52D9] to-[#4C2A8A] p-6 lg:p-8 text-white">
        <div className="relative z-10">
          <h2 className="text-2xl lg:text-3xl font-bold">
            {greeting}، {(isAr ? user.nameAr : user.nameEn).split(" ")[0]}{" "}
            <span className="inline-block animate-[wave_1.5s_ease-in-out_infinite]">
              👋
            </span>
          </h2>
          <p className="text-white/80 mt-1.5 text-sm lg:text-base">
            {t.greeting.subtitle}
          </p>
          <p className="text-white/60 text-sm mt-3">{today}</p>
        </div>
        {/* Decorative elements */}
        <div className="absolute top-0 end-0 w-64 h-64 opacity-10">
          <div className="absolute top-4 end-4 w-32 h-32 rounded-full border-[3px] border-white" />
          <div className="absolute top-12 end-12 w-48 h-48 rounded-full border-[3px] border-white" />
          <div className="absolute -top-4 end-20 w-20 h-20 rounded-full bg-white" />
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <div
              key={i}
              className="accent-card rounded-xl p-4 hover-lift cursor-default"
            >
              <div className="flex items-start gap-3">
                <Icon className="w-12 h-12 shrink-0" />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-2xl font-bold text-foreground">
                      {stat.value}
                    </p>
                    {stat.trend && (
                      <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-500/15 px-1.5 py-0.5 rounded-full">
                        {stat.trend}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5 truncate">
                    {stat.label}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Requests — admin sees all, employee sees own */}
        <div className="lg:col-span-2 glass-card rounded-xl p-5 lg:p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-bold text-lg">
              {isAdmin ? t.recentRequests : (isAr ? "طلباتي الأخيرة" : "My Recent Requests")}
            </h3>
            {isAdmin && (
              <button onClick={() => router.push("/requests")} className="text-sm text-primary hover:text-primary/80 font-medium transition-colors">
                {t.common.viewAll}
              </button>
            )}
          </div>
          {(() => {
            // Admin: show all from mock, Employee: show own from store
            const displayRequests = isAdmin
              ? mockRequests
              : store.employeeRequests
                  .filter((r) => r.employeeId === user.id)
                  .slice(0, 5)
                  .map((r) => {
                    const emp = allEmployees.find((e) => e.id === r.employeeId);
                    return {
                      nameAr: emp?.nameAr ?? "",
                      nameEn: emp?.nameEn ?? "",
                      typeKey: r.typeKey as "leaveRequest" | "salaryCert" | "permission" | "docRequest",
                      dateAr: formatDate(r.date, "ar", { month: "short", day: "numeric" }),
                      dateEn: formatDate(r.date, "en", { month: "short", day: "numeric" }),
                      statusKey: (r.status === "in-review" ? "inReview" : r.status) as "pending" | "inReview" | "approved" | "rejected",
                      initialsAr: emp?.initials ?? "",
                    };
                  });

            if (displayRequests.length === 0) {
              return (
                <p className="text-sm text-muted-foreground text-center py-8">
                  {t.common.noData}
                </p>
              );
            }

            return (
              <div className="overflow-x-auto -mx-5 lg:-mx-6 px-5 lg:px-6">
                <table className="w-full min-w-[500px]">
                  <thead>
                    <tr className="text-xs text-muted-foreground border-b border-border">
                      <th className="text-start pb-3 font-medium">{t.common.name}</th>
                      <th className="text-start pb-3 font-medium">{t.common.type}</th>
                      <th className="text-start pb-3 font-medium">{t.common.date}</th>
                      <th className="text-start pb-3 font-medium">{t.common.status}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayRequests.map((req, i) => (
                      <tr key={i} className="border-b border-border/50 last:border-0 hover:bg-accent/30 transition-colors">
                        <td className="py-3">
                          <div className="flex items-center gap-2.5">
                            <Avatar className="w-7 h-7">
                              <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-bold">
                                {req.initialsAr}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-sm font-medium">
                              {isAr ? req.nameAr : req.nameEn}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 text-sm text-muted-foreground">
                          {t.requestTypes[req.typeKey]}
                        </td>
                        <td className="py-3 text-sm text-muted-foreground">
                          {isAr ? req.dateAr : req.dateEn}
                        </td>
                        <td className="py-3">
                          <Badge className={cn("text-[11px] font-medium", statusStyles[req.statusKey])}>
                            {t.statuses[req.statusKey]}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })()}
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Admin: Team on Leave — Employee: My Leave Balance */}
          {isAdmin ? (
            <div className="glass-card rounded-xl p-5">
              <h3 className="font-bold mb-4">{t.teamOnLeave}</h3>
              <div className="space-y-3">
                {teamOnLeave.map((person, i) => (
                  <div key={i} className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/30 transition-colors">
                    <Avatar className="w-9 h-9">
                      <AvatarFallback className={cn("text-white text-xs font-bold", person.color)}>
                        {person.initialsAr}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">
                        {isAr ? person.nameAr : person.nameEn}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {isAr ? person.deptAr : person.deptEn} ·{" "}
                        {isAr ? `العودة ${person.returnAr}` : `Returns ${person.returnEn}`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="glass-card rounded-xl p-5">
              <h3 className="font-bold mb-4">
                {isAr ? "رصيد إجازاتي" : "My Leave Balance"}
              </h3>
              <div className="space-y-3">
                {store.leaveBalances.slice(0, 4).map((lb) => (
                  <div key={lb.typeKey} className="flex items-center justify-between p-2 rounded-lg hover:bg-accent/30 transition-colors">
                    <span className="text-sm font-medium">
                      {t.lev[lb.typeKey as keyof typeof t.lev] ?? lb.typeKey}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold text-primary">{lb.remaining}</span>
                      <span className="text-xs text-muted-foreground">/ {lb.total} {t.lev.days}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick Actions */}
          <div className="glass-card rounded-xl p-5">
            <h3 className="font-bold mb-4">{t.quickActions}</h3>
            <div className="grid grid-cols-2 gap-3">
              {quickActions.map((action, i) => {
                const Icon = action.icon;
                return (
                  <button
                    key={i}
                    onClick={() => router.push(action.href)}
                    className="flex flex-col items-center gap-2 p-4 rounded-xl border border-border hover:border-primary/30 hover:bg-accent/50 transition-all duration-200 hover:scale-[1.02] group"
                  >
                    <div
                      className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110",
                        action.color
                      )}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-medium text-center leading-tight">
                      {action.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
