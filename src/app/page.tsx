"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/components/providers";
import { useData } from "@/lib/data-store";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Icon } from "@/components/ui/icon";
import { cn, formatDate } from "@/lib/utils";
import { useAuth } from "@/components/providers";

/** Next payroll: 27th of each month, adjusted for Saudi weekend (Fri/Sat). */
function getNextPayrollDate(): Date {
  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth();
  if (now.getDate() > 27) {
    month += 1;
    if (month > 11) { month = 0; year += 1; }
  }
  const d = new Date(year, month, 27);
  const day = d.getDay();
  if (day === 5) d.setDate(26);
  if (day === 6) d.setDate(28);
  return d;
}

function formatPayrollDate(d: Date, lang: string): string {
  const locale = lang === "ar" ? "ar-SA-u-nu-latn" : "en-US";
  return d.toLocaleDateString(locale, { day: "numeric", month: "long" });
}

/** Status badge variant → matches Badge component */
const statusVariant: Record<string, "warning" | "info" | "success" | "destructive"> = {
  pending: "warning",
  inReview: "info",
  approved: "success",
  rejected: "destructive",
};

interface StatCardData {
  iconName: string;
  value: string;
  label: string;
  trend?: string;
  trendTone?: "success" | "warning" | "info" | "primary";
  trendHref?: string;
  iconBg: string;
  iconColor: string;
}

export default function DashboardPage() {
  const { t, lang } = useLanguage();
  const { isAdmin, user } = useAuth();
  const store = useData();
  const { initialLoaded } = store;
  const router = useRouter();
  const isAr = lang === "ar";

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? t.greeting.morning
      : hour < 18 ? t.greeting.afternoon
        : t.greeting.evening;

  const today = formatDate(new Date(), lang, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const nextPayroll = formatPayrollDate(getNextPayrollDate(), lang);

  // ── Live work hours counter (employee only) ──
  const myAttendance = useMemo(() => {
    return store.todayAttendance.find((a) => a.employeeId === user.id);
  }, [store.todayAttendance, user.id]);

  const [elapsed, setElapsed] = useState("00:00");
  const [elapsedMinutes, setElapsedMinutes] = useState(0);

  useEffect(() => {
    function calc() {
      if (!myAttendance?.checkIn) {
        setElapsed("00:00");
        setElapsedMinutes(0);
        return;
      }
      const [inH, inM] = myAttendance.checkIn.split(":").map(Number);
      let endH: number, endM: number;
      if (myAttendance.checkOut) {
        [endH, endM] = myAttendance.checkOut.split(":").map(Number);
      } else {
        const now = new Date();
        endH = now.getHours();
        endM = now.getMinutes();
      }
      const total = (endH * 60 + endM) - (inH * 60 + inM);
      const mins = Math.max(0, total);
      setElapsedMinutes(mins);
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      setElapsed(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
    calc();
    if (myAttendance?.checkIn && !myAttendance?.checkOut) {
      const timer = setInterval(calc, 60000);
      return () => clearInterval(timer);
    }
  }, [myAttendance]);

  const workTarget = 420; // 7 hours
  const progressPct = Math.min(100, Math.round((elapsedMinutes / workTarget) * 100));

  // ── Stats cards data ──
  const adminStats: StatCardData[] = [
    {
      iconName: "badge",
      value: String(store.employees.length),
      label: t.stats.totalEmployees,
      iconBg: "bg-primary-container/40",
      iconColor: "text-primary",
    },
    {
      iconName: "beach_access",
      value: String(store.employees.filter(e => e.status === "on-leave").length),
      label: t.stats.onLeave,
      iconBg: "bg-tertiary-container/40",
      iconColor: "text-tertiary",
    },
    {
      iconName: "pending_actions",
      value: String(
        store.employeeRequests.filter(r => r.status === "pending").length +
        store.leaveRequests.filter(r => r.status === "pending").length
      ),
      label: t.stats.pendingRequests,
      trend: t.stats.needsAction,
      trendTone: "warning",
      trendHref: "/requests?status=pending",
      iconBg: "bg-amber-500/15",
      iconColor: "text-amber-600 dark:text-amber-400",
    },
    {
      iconName: "account_balance_wallet",
      value: nextPayroll,
      label: t.stats.nextPayroll,
      iconBg: "bg-blue-500/15",
      iconColor: "text-blue-600 dark:text-blue-400",
    },
  ];

  const employeeStats: StatCardData[] = [
    {
      iconName: "event_available",
      value: String(store.leaveBalances.find(b => b.typeKey === "annual")?.remaining ?? 0),
      label: t.stats.leaveDaysLeft,
      iconBg: "bg-emerald-500/15",
      iconColor: "text-emerald-600 dark:text-emerald-400",
    },
    {
      iconName: "pending_actions",
      value: String(
        store.employeeRequests.filter(r => r.employeeId === user.id && r.status === "pending").length +
        store.leaveRequests.filter(r => r.employeeId === user.id && r.status === "pending").length
      ),
      label: t.stats.myPendingRequests,
      iconBg: "bg-amber-500/15",
      iconColor: "text-amber-600 dark:text-amber-400",
    },
    {
      iconName: "account_balance_wallet",
      value: nextPayroll,
      label: t.stats.nextPayroll,
      iconBg: "bg-blue-500/15",
      iconColor: "text-blue-600 dark:text-blue-400",
    },
    {
      iconName: "schedule",
      value: myAttendance?.checkIn ?? "-",
      label: t.stats.todayCheckIn,
      iconBg: "bg-primary-container/40",
      iconColor: "text-primary",
    },
  ];

  const stats = isAdmin ? adminStats : employeeStats;

  // ── Quick actions ──
  const adminQuickActions = [
    { iconName: "person_add", label: t.actions.addEmployee, href: "/employees" },
    { iconName: "add_circle", label: t.actions.newRequest, href: "/requests" },
    { iconName: "bar_chart", label: t.actions.viewReports, href: "/reports" },
    { iconName: "payments", label: t.actions.runPayroll, href: "/payroll" },
  ];

  const employeeQuickActions = [
    { iconName: "add_circle", label: t.actions.newRequest, href: "/requests" },
    { iconName: "event_busy", label: t.stats.requestLeave, href: "/leaves" },
    { iconName: "calendar_today", label: t.stats.attendanceLog, href: "/attendance" },
    { iconName: "receipt_long", label: t.stats.myPayslip, href: "/payroll" },
  ];

  const quickActions = isAdmin ? adminQuickActions : employeeQuickActions;

  // ── Recent requests ──
  const sourceRequests = isAdmin
    ? store.employeeRequests.slice(0, 5)
    : store.employeeRequests.filter((r) => r.employeeId === user.id).slice(0, 5);

  const displayRequests = sourceRequests.map((r) => {
    const emp = store.employees.find((e) => e.id === r.employeeId);
    return {
      id: r.id,
      nameAr: emp?.nameAr ?? "",
      nameEn: emp?.nameEn ?? "",
      positionAr: emp?.positionAr ?? "",
      positionEn: emp?.positionEn ?? "",
      typeKey: r.typeKey as "leaveRequest" | "salaryCert" | "permission" | "docRequest",
      dateAr: formatDate(r.date, "ar", { month: "short", day: "numeric" }),
      dateEn: formatDate(r.date, "en", { month: "short", day: "numeric" }),
      statusKey: (r.status === "in-review" ? "inReview" : r.status) as "pending" | "inReview" | "approved" | "rejected",
      initials: emp?.initials ?? "",
      color: emp?.color ?? "bg-primary",
    };
  });

  const typeIconMap: Record<string, string> = {
    leaveRequest: "travel",
    salaryCert: "workspace_premium",
    permission: "description",
    docRequest: "article",
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 lg:space-y-10 pb-8">
      {/* ── Welcome Section ───────────────────────────────── */}
      <section className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pt-2">
        <div>
          <h2 className="font-headline text-3xl md:text-4xl lg:text-5xl font-extrabold text-on-surface tracking-tight">
            {greeting}، {(isAr ? user.nameAr : user.nameEn).split(" ")[0]}
            <span className="inline-block animate-wave ms-2" role="img" aria-label={isAr ? "تحية" : "wave"}>👋</span>
          </h2>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-on-surface-variant mt-5">
            <div className="flex items-center gap-1.5">
              <Icon name="calendar_month" size={18} />
              <span className="text-sm font-medium">{today}</span>
            </div>
            <div className="w-1 h-1 bg-outline-variant rounded-full hidden sm:block" />
            <div className="flex items-center gap-1.5">
              <Icon name="location_on" size={18} />
              <span className="text-sm font-medium">
                {t.stats.officeName}
              </span>
            </div>
          </div>
        </div>

        {/* Live Shift Tracker (employee only) */}
        {!isAdmin && (
          <div className="bg-primary-container/30 dark:bg-primary-container/20 p-5 rounded-2xl relative overflow-hidden group min-w-[320px]">
            {/* Decorative clock icon */}
            <div className="absolute top-3 end-3 opacity-20 group-hover:scale-110 transition-transform pointer-events-none">
              <Icon name="timer" size={56} className="text-primary" />
            </div>

            {/* Title */}
            <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-2">
              {t.stats.liveShiftTracker}
            </p>

            {/* Time display */}
            <div className="flex items-baseline gap-2 mb-3" dir="ltr">
              <span className="font-headline text-4xl md:text-5xl font-black text-primary tabular-nums leading-none">
                {myAttendance?.checkIn ? elapsed : "--:--"}
              </span>
              <span className="text-lg font-bold text-primary-dim">/ 07:00</span>
            </div>

            {/* Progress bar + action button row */}
            <div className="flex items-center gap-3">
              {/* Action button — state-dependent */}
              {myAttendance?.checkIn && !myAttendance?.checkOut ? (
                <button
                  onClick={() => router.push("/attendance")}
                  className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-container-lowest text-xs font-bold text-md-error hover:bg-error-container/20 transition-colors"
                >
                  <Icon name="logout" size={14} />
                  {t.clock.clockOut}
                </button>
              ) : myAttendance?.checkOut ? (
                <span className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/15 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  <Icon name="check_circle" size={14} fill />
                  {t.clock.alreadyCheckedOut}
                </span>
              ) : (
                <button
                  onClick={() => router.push("/attendance")}
                  className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full gradient-btn text-xs font-bold shadow-primary-glow"
                >
                  <Icon name="schedule" size={14} />
                  {t.clock.clockIn}
                </button>
              )}

              {/* Progress bar */}
              <div className="flex-1 h-2 bg-surface-container rounded-full overflow-hidden">
                <div
                  className="h-full gradient-btn rounded-full shadow-primary-glow transition-all duration-500"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ── Bento Grid Stat Cards ─────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {stats.map((stat, i) => (
          <div
            key={i}
            className="bg-surface-container-lowest p-6 rounded-2xl shadow-sm hover:shadow-primary-glow-lg transition-all duration-500 group"
          >
            <div className="flex justify-between items-start mb-4">
              <div className={cn(
                "w-12 h-12 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300",
                stat.iconBg,
                stat.iconColor,
              )}>
                <Icon name={stat.iconName} size={28} fill />
              </div>
              {stat.trend && (
                stat.trendHref ? (
                  <button
                    onClick={(e) => { e.stopPropagation(); router.push(stat.trendHref!); }}
                    className="cursor-pointer hover:scale-105 active:scale-95 transition-transform focus-visible:ring-2 focus-visible:ring-primary/40 rounded-full outline-none"
                    aria-label={stat.trend}
                  >
                    <Badge variant={stat.trendTone === "warning" ? "warning" : stat.trendTone === "success" ? "success" : "info"}>
                      {stat.trend}
                    </Badge>
                  </button>
                ) : (
                  <Badge variant={stat.trendTone === "warning" ? "warning" : stat.trendTone === "success" ? "success" : "info"}>
                    {stat.trend}
                  </Badge>
                )
              )}
            </div>
            <p className="text-on-surface-variant text-sm font-medium mb-1">
              {stat.label}
            </p>
            <h3 className="font-headline text-3xl font-black text-on-surface tracking-tight min-h-[36px]">
              {initialLoaded ? (
                stat.value
              ) : (
                <span
                  className="inline-block w-16 h-7 rounded-lg bg-surface-container-highest animate-pulse align-middle"
                  aria-label={isAr ? "جاري التحميل" : "Loading"}
                />
              )}
            </h3>
          </div>
        ))}
      </div>

      {/* ── Split Grid: Quick Actions + Recent Requests ──── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 items-start">
        {/* Left Column: Quick Actions + Team/Balance */}
        <div className="xl:col-span-1 space-y-6">
          {/* Quick Actions */}
          <div>
            <h4 className="font-headline text-xl font-bold flex items-center gap-3 mb-5">
              <span className="w-1.5 h-7 bg-primary rounded-full" />
              {t.quickActions}
            </h4>
            <div className="grid grid-cols-2 gap-4">
              {quickActions.map((action, i) => (
                <button
                  key={i}
                  onClick={() => router.push(action.href)}
                  className="flex flex-col items-center justify-center p-5 bg-surface-container-lowest rounded-2xl shadow-sm hover:bg-primary hover:text-on-primary transition-all duration-300 group hover:shadow-primary-glow-lg active:scale-[0.97]"
                >
                  <Icon
                    name={action.iconName}
                    size={30}
                    className="mb-3 text-primary group-hover:text-on-primary transition-colors"
                  />
                  <span className="text-sm font-bold text-center leading-tight">
                    {action.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Admin: Team on Leave — Employee: My Leave Balance */}
          {isAdmin ? (
            <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm">
              <h4 className="font-headline text-lg font-bold flex items-center gap-3 mb-5">
                <span className="w-1.5 h-6 bg-tertiary rounded-full" />
                {t.teamOnLeave}
              </h4>
              <div className="space-y-3">
                {store.employees.filter((e) => e.status === "on-leave").length === 0 ? (
                  <p className="text-sm text-on-surface-variant text-center py-4">
                    {t.common.noData}
                  </p>
                ) : (
                  store.employees
                    .filter((e) => e.status === "on-leave")
                    .map((person) => (
                      <div
                        key={person.id}
                        className="flex items-center gap-3 p-2 rounded-xl hover:bg-surface-container-low transition-colors"
                      >
                        <Avatar className="w-10 h-10">
                          <AvatarFallback className={cn("text-white text-xs font-bold", person.color)}>
                            {person.initials}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold truncate">
                            {isAr ? person.nameAr : person.nameEn}
                          </p>
                          <p className="text-xs text-on-surface-variant truncate">
                            {isAr ? person.positionAr : person.positionEn}
                          </p>
                        </div>
                      </div>
                    ))
                )}
              </div>
            </div>
          ) : (
            <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm">
              <h4 className="font-headline text-lg font-bold flex items-center gap-3 mb-5">
                <span className="w-1.5 h-6 bg-primary rounded-full" />
                {t.stats.myLeaveBalance}
              </h4>
              <div className="space-y-4">
                {store.leaveBalances
                  .filter((lb) => ["annual", "sick", "unpaid"].includes(lb.typeKey))
                  .map((lb) => {
                    const pct = lb.total > 0 ? Math.round((lb.remaining / lb.total) * 100) : 0;
                    return (
                      <div key={lb.typeKey}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-semibold text-on-surface">
                            {t.lev[lb.typeKey as keyof typeof t.lev] ?? lb.typeKey}
                          </span>
                          <span className="text-xs text-on-surface-variant tabular-nums">
                            <span className="font-bold text-on-surface">{lb.remaining}</span>
                            <span className="mx-1">/</span>
                            {lb.total} {t.lev.days}
                          </span>
                        </div>
                        <div className="h-2 w-full bg-surface-container-highest rounded-full overflow-hidden">
                          <div
                            className="h-full gradient-btn rounded-full shadow-primary-glow transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Recent Requests (2 cols) */}
        <div className="xl:col-span-2">
          <div className="flex items-center justify-between mb-5">
            <h4 className="font-headline text-xl font-bold flex items-center gap-3">
              <span className="w-1.5 h-7 bg-primary rounded-full" />
              {isAdmin ? t.recentRequests : t.stats.myRecentRequests}
            </h4>
            <button
              onClick={() => router.push("/requests")}
              className="text-primary font-bold text-sm flex items-center gap-1 hover:gap-2 transition-all"
            >
              {t.common.viewAll}
              <Icon name={isAr ? "arrow_back" : "arrow_forward"} size={16} />
            </button>
          </div>

          <div className="bg-surface-container-lowest rounded-2xl overflow-hidden shadow-sm">
            {displayRequests.length === 0 ? (
              <div className="p-12 text-center">
                <Icon name="inbox" size={48} className="text-on-surface-variant/40 mb-2" />
                <p className="text-sm text-on-surface-variant">{t.common.noData}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-start border-collapse">
                  <thead>
                    <tr className="bg-surface-container/30">
                      <th className="px-6 py-4 text-start text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                        {t.common.name}
                      </th>
                      <th className="px-6 py-4 text-start text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                        {t.common.type}
                      </th>
                      <th className="px-6 py-4 text-start text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                        {t.common.date}
                      </th>
                      <th className="px-6 py-4 text-start text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                        {t.common.status}
                      </th>
                      {isAdmin && (
                        <th className="px-6 py-4 text-start text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                          {t.common.actions}
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {displayRequests.map((req) => (
                      <tr
                        key={req.id}
                        className="hover:bg-surface-container-low transition-colors"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <Avatar className="w-8 h-8">
                              <AvatarFallback className={cn("text-white text-[11px] font-bold", req.color)}>
                                {req.initials}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="text-sm font-bold truncate">
                                {isAr ? req.nameAr : req.nameEn}
                              </p>
                              <p className="text-[10px] text-on-surface-variant truncate">
                                {isAr ? req.positionAr : req.positionEn}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <Icon
                              name={typeIconMap[req.typeKey] ?? "description"}
                              size={18}
                              className="text-on-surface-variant"
                            />
                            <span className="text-sm font-medium">
                              {t.requestTypes[req.typeKey]}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-on-surface-variant font-medium">
                          {isAr ? req.dateAr : req.dateEn}
                        </td>
                        <td className="px-6 py-4">
                          <Badge variant={statusVariant[req.statusKey]}>
                            {t.statuses[req.statusKey]}
                          </Badge>
                        </td>
                        {isAdmin && (
                          <td className="px-6 py-4">
                            <button
                              onClick={() => router.push("/requests")}
                              className="p-2 hover:bg-primary-container/30 rounded-full transition-colors text-primary"
                              title={t.common.viewAll}
                            >
                              <Icon name="visibility" size={18} />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
