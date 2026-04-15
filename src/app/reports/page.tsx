"use client";

import { useLanguage } from "@/components/providers";
import { GOSI_RATE } from "@/lib/mock-data";
import { useData } from "@/lib/data-store";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

const deptBarColors = [
  "from-blue-400 to-blue-600",
  "from-emerald-400 to-emerald-600",
  "from-amber-400 to-amber-600",
  "from-rose-400 to-rose-600",
  "from-purple-400 to-purple-600",
  "from-cyan-400 to-cyan-600",
  "from-orange-400 to-orange-600",
];

const leaveColorMap: Record<string, string> = {
  annual: "from-emerald-400 to-emerald-600",
  sick: "from-rose-400 to-rose-600",
  personal: "from-blue-400 to-blue-600",
  unpaid: "from-gray-400 to-gray-600",
  marriage: "from-pink-400 to-pink-600",
  paternity: "from-cyan-400 to-cyan-600",
};

export default function ReportsPage() {
  const { t, lang } = useLanguage();
  const store = useData();
  const { initialLoaded } = store;
  const departments = store.departments;
  const employees = store.employees;
  const todayAttendance = store.todayAttendance;
  const leaveBalances = store.leaveBalances;
  const isAr = lang === "ar";

  const headcount = employees.length;

  const avgTenure = (() => {
    const now = new Date();
    const totalYears = employees.reduce((sum, emp) => {
      const joined = new Date(emp.joinDate);
      const diff = (now.getTime() - joined.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
      return sum + diff;
    }, 0);
    return employees.length > 0 ? (totalYears / employees.length).toFixed(1) : "0";
  })();

  const attendanceRate = (() => {
    if (employees.length === 0) return 0;
    const counted = todayAttendance.filter(
      (r) => r.status === "present" || r.status === "late" || r.status === "half-day"
    ).length;
    return Math.round((counted / employees.length) * 100);
  })();

  const kpiCards = [
    {
      iconName: "group",
      label: t.rep.headcount,
      value: headcount.toString(),
      bg: "bg-blue-500/15",
      color: "text-blue-600 dark:text-blue-400",
    },
    {
      iconName: "trending_down",
      label: t.rep.turnoverRate,
      value: headcount > 0
        ? ((employees.filter(e => e.status === "inactive").length / headcount) * 100).toFixed(1) + "%"
        : "0%",
      bg: "bg-amber-500/15",
      color: "text-amber-600 dark:text-amber-400",
    },
    {
      iconName: "schedule",
      label: t.rep.avgTenure,
      value: `${avgTenure} ${t.rep.years}`,
      bg: "bg-tertiary-container/40",
      color: "text-tertiary",
    },
    {
      iconName: "check_circle",
      label: t.rep.attendanceRate,
      value: `${attendanceRate}%`,
      bg: "bg-emerald-500/15",
      color: "text-emerald-600 dark:text-emerald-400",
    },
  ];

  const todayDayIndex = new Date().getDay();
  const todayRate = employees.length > 0
    ? Math.round((todayAttendance.filter(r => r.status === "present" || r.status === "late" || r.status === "half-day").length / employees.length) * 100)
    : 0;
  const weeklyData = [0, 0, 0, 0, 0].map((_, i) => i === Math.min(todayDayIndex, 4) ? todayRate : 0);
  const dayKeys: Array<keyof typeof t.days> = ["sun", "mon", "tue", "wed", "thu"];
  const maxBarHeight = 140;

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
  const maxDeptCount = Math.max(...deptCounts.map((d) => d.count), 1);

  const currentMonthlyPayroll = employees.reduce((sum, emp) => {
    const gross = emp.salary.basic + emp.salary.housing + emp.salary.transport + emp.salary.other;
    const gosi = emp.salary.basic * GOSI_RATE;
    return sum + gross - gosi;
  }, 0);
  const payrollData = [0, 0, 0, 0, 0, currentMonthlyPayroll];
  const now = new Date();
  const monthLabels = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
    return d.toLocaleDateString(isAr ? "ar-SA-u-nu-latn" : "en-US", { month: "short" });
  });
  const maxPayroll = Math.max(...payrollData, 1);

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-8">
      {/* Header */}
      <div>
        <h1 className="font-headline text-3xl md:text-4xl font-extrabold text-on-surface tracking-tight">
          {t.rep.title}
        </h1>
        <p className="text-sm text-on-surface-variant mt-2">{t.rep.workforceSummary}</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {kpiCards.map((card, i) => (
          <div key={i} className="bg-surface-container-lowest p-5 rounded-2xl shadow-sm hover:shadow-primary-glow-lg transition-all group">
            <div className="flex items-center gap-4">
              <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform", card.bg, card.color)}>
                <Icon name={card.iconName} size={26} fill />
              </div>
              <div className="min-w-0">
                <p className="font-headline text-3xl font-black text-on-surface tabular-nums min-h-[36px]">
                  {initialLoaded ? (
                    card.value
                  ) : (
                    <span className="inline-block w-16 h-7 rounded-lg bg-surface-container-highest animate-pulse align-middle" />
                  )}
                </p>
                <p className="text-sm text-on-surface-variant truncate font-medium">{card.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Weekly Attendance */}
        <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <span className="w-1.5 h-7 bg-primary rounded-full" />
            <h3 className="font-headline font-bold text-xl">{t.rep.attendanceTrend}</h3>
          </div>
          <div className="flex items-end justify-around gap-3" style={{ height: maxBarHeight + 40 }}>
            {weeklyData.map((value, i) => {
              const barHeight = Math.max(4, (value / 100) * maxBarHeight);
              return (
                <div key={i} className="flex flex-col items-center gap-2 flex-1">
                  <span className="text-xs font-bold text-on-surface tabular-nums">{value}%</span>
                  <div
                    className="w-full max-w-[48px] bg-gradient-to-t from-primary to-primary-container rounded-t-xl shadow-primary-glow transition-all duration-500"
                    style={{ height: barHeight }}
                  />
                  <span className="text-xs text-on-surface-variant font-bold">{t.days[dayKeys[i]]}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Department Distribution */}
        <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <span className="w-1.5 h-7 bg-tertiary rounded-full" />
            <h3 className="font-headline font-bold text-xl">{t.rep.deptDistribution}</h3>
          </div>
          <div className="space-y-4">
            {deptCounts.length === 0 && (
              <p className="text-sm text-on-surface-variant text-center py-4 font-medium">{t.common.noData}</p>
            )}
            {deptCounts.map((dept, i) => {
              const barWidth = (dept.count / maxDeptCount) * 100;
              const color = deptBarColors[i % deptBarColors.length];
              return (
                <div key={dept.key} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-on-surface font-bold">{dept.name}</span>
                    <span className="text-on-surface-variant font-bold tabular-nums">{dept.count}</span>
                  </div>
                  <div className="w-full h-3 bg-surface-container-highest rounded-full overflow-hidden">
                    <div
                      className={cn("h-full rounded-full bg-gradient-to-r transition-all duration-500", color)}
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Leave Usage */}
        <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <span className="w-1.5 h-7 bg-emerald-500 rounded-full" />
            <h3 className="font-headline font-bold text-xl">{t.rep.leaveUsage}</h3>
          </div>
          <div className="space-y-4">
            {leaveBalances.map((item) => {
              const usagePercent = item.total > 0 ? (item.used / item.total) * 100 : 0;
              const fillColor = leaveColorMap[item.typeKey] || "from-gray-400 to-gray-600";
              const typeName = t.lev[item.typeKey as keyof typeof t.lev] ?? item.typeKey;
              return (
                <div key={item.typeKey} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-on-surface font-bold">{typeName}</span>
                    <span className="text-on-surface-variant font-medium tabular-nums">
                      {item.used}/{item.total} {t.lev.days}
                    </span>
                  </div>
                  <div className="w-full h-3 bg-surface-container-highest rounded-full overflow-hidden">
                    <div
                      className={cn("h-full rounded-full bg-gradient-to-r transition-all duration-500", fillColor)}
                      style={{ width: `${usagePercent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Payroll Trend */}
        <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <span className="w-1.5 h-7 bg-amber-500 rounded-full" />
            <h3 className="font-headline font-bold text-xl">{t.rep.payrollTrend}</h3>
          </div>
          <div className="flex items-end justify-around gap-3" style={{ height: maxBarHeight + 40 }}>
            {payrollData.map((value, i) => {
              const barHeight = Math.max(4, (value / maxPayroll) * maxBarHeight);
              return (
                <div key={i} className="flex flex-col items-center gap-2 flex-1">
                  <span className="text-[10px] font-bold text-on-surface tabular-nums whitespace-nowrap">
                    {value > 0 ? value.toLocaleString("en-US") : "-"}
                  </span>
                  <div
                    className="w-full max-w-[48px] bg-gradient-to-t from-primary to-primary-container rounded-t-xl shadow-primary-glow transition-all duration-500"
                    style={{ height: barHeight }}
                  />
                  <span className="text-xs text-on-surface-variant font-bold">{monthLabels[i]}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
