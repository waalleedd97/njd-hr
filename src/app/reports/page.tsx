"use client";

import { useLanguage } from "@/components/providers";
import { employees, todayAttendance, leaveBalances } from "@/lib/mock-data";
import { useData } from "@/lib/data-store";
import { cn } from "@/lib/utils";
import { Users, TrendingDown, Clock, CheckCircle } from "lucide-react";

const barColors = [
  "bg-blue-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-purple-500",
  "bg-cyan-500",
  "bg-orange-500",
];

const leaveColorMap: Record<string, string> = {
  annual: "bg-emerald-500",
  sick: "bg-red-500",
  personal: "bg-blue-500",
  unpaid: "bg-gray-400",
  marriage: "bg-pink-500",
  paternity: "bg-cyan-500",
};

const leaveTrackMap: Record<string, string> = {
  annual: "bg-emerald-100 dark:bg-emerald-500/20",
  sick: "bg-red-100 dark:bg-red-500/20",
  personal: "bg-blue-100 dark:bg-blue-500/20",
  unpaid: "bg-gray-100 dark:bg-gray-500/20",
  marriage: "bg-pink-100 dark:bg-pink-500/20",
  paternity: "bg-cyan-100 dark:bg-cyan-500/20",
};

export default function ReportsPage() {
  const { t, lang } = useLanguage();
  const departments = useData().departments;
  const isAr = lang === "ar";

  // --- KPI Calculations ---

  const headcount = employees.length;

  const avgTenure = (() => {
    const now = new Date();
    const totalYears = employees.reduce((sum, emp) => {
      const joined = new Date(emp.joinDate);
      const diff = (now.getTime() - joined.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
      return sum + diff;
    }, 0);
    return (totalYears / employees.length).toFixed(1);
  })();

  const attendanceRate = (() => {
    const counted = todayAttendance.filter(
      (r) => r.status === "present" || r.status === "late" || r.status === "half-day"
    ).length;
    return Math.round((counted / todayAttendance.length) * 100);
  })();

  // --- KPI Card Definitions ---

  const kpiCards = [
    {
      icon: Users,
      label: t.rep.headcount,
      value: headcount.toString(),
      color: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-500/10",
    },
    {
      icon: TrendingDown,
      label: t.rep.turnoverRate,
      value: "4.2%",
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-500/10",
    },
    {
      icon: Clock,
      label: t.rep.avgTenure,
      value: `${avgTenure} ${t.rep.years}`,
      color: "text-purple-600 dark:text-purple-400",
      bg: "bg-purple-500/10",
    },
    {
      icon: CheckCircle,
      label: t.rep.attendanceRate,
      value: `${attendanceRate}%`,
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-500/10",
    },
  ];

  // --- Weekly Attendance Data ---

  const weeklyData = [85, 92, 78, 95, 88];
  const dayKeys: Array<keyof typeof t.days> = ["sun", "mon", "tue", "wed", "thu"];
  const maxBarHeight = 120;

  // --- Department Distribution ---

  const deptCounts: { key: string; name: string; count: number }[] = [];
  const deptMap: Record<string, number> = {};
  for (const emp of employees) {
    deptMap[emp.department] = (deptMap[emp.department] || 0) + 1;
  }
  for (const [key, count] of Object.entries(deptMap)) {
    deptCounts.push({
      key,
      name: departments[key]?.[lang] ?? key,
      count,
    });
  }
  deptCounts.sort((a, b) => b.count - a.count);
  const maxDeptCount = Math.max(...deptCounts.map((d) => d.count));

  // --- Payroll Trend ---

  const payrollData = [245000, 248000, 252000, 250000, 255000, 258000];
  const monthLabelsAr = ["أكتوبر", "نوفمبر", "ديسمبر", "يناير", "فبراير", "مارس"];
  const monthLabelsEn = ["Oct", "Nov", "Dec", "Jan", "Feb", "Mar"];
  const monthLabels = isAr ? monthLabelsAr : monthLabelsEn;
  const maxPayroll = Math.max(...payrollData);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t.rep.title}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t.rep.workforceSummary}</p>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((card, i) => {
          const Icon = card.icon;
          return (
            <div
              key={i}
              className="accent-card rounded-xl p-4 hover-lift cursor-default"
            >
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                    card.bg
                  )}
                >
                  <Icon className={cn("w-5 h-5", card.color)} />
                </div>
                <div className="min-w-0">
                  <p className="text-2xl font-bold text-foreground">{card.value}</p>
                  <p className="text-sm text-muted-foreground truncate">{card.label}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Weekly Attendance Bar Chart */}
        <div className="glass-card rounded-xl p-5 lg:p-6">
          <h3 className="font-bold text-lg mb-6">{t.rep.attendanceTrend}</h3>
          <div className="flex items-end justify-around gap-3" style={{ height: maxBarHeight + 40 }}>
            {weeklyData.map((value, i) => {
              const barHeight = (value / 100) * maxBarHeight;
              return (
                <div key={i} className="flex flex-col items-center gap-2 flex-1">
                  <span className="text-xs font-semibold text-foreground">{value}%</span>
                  <div
                    className="w-full max-w-[40px] bg-primary rounded-t-md transition-all duration-500"
                    style={{ height: barHeight }}
                  />
                  <span className="text-xs text-muted-foreground font-medium">
                    {t.days[dayKeys[i]]}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Department Distribution */}
        <div className="glass-card rounded-xl p-5 lg:p-6">
          <h3 className="font-bold text-lg mb-6">{t.rep.deptDistribution}</h3>
          <div className="space-y-4">
            {deptCounts.map((dept, i) => {
              const barWidth = (dept.count / maxDeptCount) * 100;
              const color = barColors[i % barColors.length];
              return (
                <div key={dept.key} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-foreground font-medium">{dept.name}</span>
                    <span className="text-muted-foreground font-semibold">{dept.count}</span>
                  </div>
                  <div className="w-full h-2.5 bg-secondary rounded-full overflow-hidden">
                    <div
                      className={cn("h-full rounded-full transition-all duration-500", color)}
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Leave Usage */}
        <div className="glass-card rounded-xl p-5 lg:p-6">
          <h3 className="font-bold text-lg mb-6">{t.rep.leaveUsage}</h3>
          <div className="space-y-4">
            {leaveBalances.map((item) => {
              const usagePercent = item.total > 0 ? (item.used / item.total) * 100 : 0;
              const fillColor = leaveColorMap[item.typeKey] || "bg-gray-400";
              const trackColor = leaveTrackMap[item.typeKey] || "bg-gray-100 dark:bg-gray-500/20";
              const typeName =
                t.lev[item.typeKey as keyof typeof t.lev] ?? item.typeKey;
              return (
                <div key={item.typeKey} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-foreground font-medium">{typeName}</span>
                    <span className="text-muted-foreground">
                      {item.used}/{item.total} {t.lev.days}
                    </span>
                  </div>
                  <div className={cn("w-full h-2.5 rounded-full overflow-hidden", trackColor)}>
                    <div
                      className={cn("h-full rounded-full transition-all duration-500", fillColor)}
                      style={{ width: `${usagePercent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Payroll Trend */}
        <div className="glass-card rounded-xl p-5 lg:p-6">
          <h3 className="font-bold text-lg mb-6">{t.rep.payrollTrend}</h3>
          <div className="flex items-end justify-around gap-3" style={{ height: maxBarHeight + 40 }}>
            {payrollData.map((value, i) => {
              const barHeight = (value / maxPayroll) * maxBarHeight;
              return (
                <div key={i} className="flex flex-col items-center gap-2 flex-1">
                  <span className="text-[10px] font-semibold text-foreground whitespace-nowrap">
                    {value.toLocaleString("en-US")}
                  </span>
                  <div
                    className="w-full max-w-[40px] bg-primary/80 rounded-t-md transition-all duration-500"
                    style={{ height: barHeight }}
                  />
                  <span className="text-xs text-muted-foreground font-medium">
                    {monthLabels[i]}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
