"use client";

import { useState, useMemo } from "react";
import { useLanguage, useAuth } from "@/components/providers";
import { useData } from "@/lib/data-store";
import { saudiHolidays, type Employee } from "@/lib/mock-data";
import { formatDate } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import { useDataHydration } from "@/lib/hooks/use-data-hydration";
import type { LeavesSlice } from "@/lib/data/server";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm-dialog";

// ---------- constants ----------

const typeConfig: Record<string, { iconName: string; bg: string; bar: string; icon: string }> = {
  annual: {
    iconName: "beach_access",
    bg: "bg-emerald-500/15",
    bar: "from-emerald-400 to-emerald-600",
    icon: "text-emerald-600 dark:text-emerald-400",
  },
  sick: {
    iconName: "medical_services",
    bg: "bg-rose-500/15",
    bar: "from-rose-400 to-rose-600",
    icon: "text-rose-600 dark:text-rose-400",
  },
  personal: {
    iconName: "person",
    bg: "bg-blue-500/15",
    bar: "from-blue-400 to-blue-600",
    icon: "text-blue-600 dark:text-blue-400",
  },
  unpaid: {
    iconName: "block",
    bg: "bg-surface-container",
    bar: "from-gray-400 to-gray-600",
    icon: "text-on-surface-variant",
  },
  marriage: {
    iconName: "favorite",
    bg: "bg-pink-500/15",
    bar: "from-pink-400 to-pink-600",
    icon: "text-pink-600 dark:text-pink-400",
  },
  paternity: {
    iconName: "child_care",
    bg: "bg-cyan-500/15",
    bar: "from-cyan-400 to-cyan-600",
    icon: "text-cyan-600 dark:text-cyan-400",
  },
};

const statusBadgeVariant: Record<string, "warning" | "success" | "destructive" | "info"> = {
  pending: "warning",
  "in-review": "info",
  approved: "success",
  rejected: "destructive",
};

// ---------- helpers ----------

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function isDateInRange(date: Date, start: string, end: string) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const s = new Date(start + "T00:00:00");
  const e = new Date(end + "T00:00:00");
  return d >= s && d <= e;
}

function fmtDate(dateStr: string, lang: "ar" | "en") {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString(lang === "ar" ? "ar-SA-u-nu-latn" : "en-US", {
    month: "short",
    day: "numeric",
  });
}

function getHolidayForDate(date: Date) {
  return saudiHolidays.find((h) => isDateInRange(date, h.startDate, h.endDate));
}

// ---------- component ----------

type TabKey = "balance" | "requests" | "calendar";

// ── Helpers for the Team Timeline (Gantt) view ───────────────────────

function getMonthDays(refDate: Date): Date[] {
  const year = refDate.getFullYear();
  const month = refDate.getMonth();
  const last = new Date(year, month + 1, 0).getDate();
  return Array.from({ length: last }, (_, i) => new Date(year, month, i + 1));
}

function fmtMonthYear(d: Date, lang: "ar" | "en"): string {
  return d.toLocaleDateString(lang === "ar" ? "ar-SA-u-nu-latn" : "en-US", {
    month: "long",
    year: "numeric",
  });
}

interface LeaveOverlap {
  date: Date;
  employees: { id: string; nameAr: string; nameEn: string }[];
}

function detectOverlaps(
  monthDays: Date[],
  approvedLeaves: { employeeId: string; startDate: string; endDate: string }[],
  resolveEmp: (id: string) => { id: string; nameAr: string; nameEn: string }
): LeaveOverlap[] {
  const overlaps: LeaveOverlap[] = [];
  for (const day of monthDays) {
    const onLeave = approvedLeaves.filter((lr) =>
      isDateInRange(day, lr.startDate, lr.endDate)
    );
    if (onLeave.length >= 2) {
      overlaps.push({
        date: day,
        employees: onLeave.map((lr) => {
          const emp = resolveEmp(lr.employeeId);
          return { id: emp.id, nameAr: emp.nameAr, nameEn: emp.nameEn };
        }),
      });
    }
  }
  return overlaps;
}

export function LeavesView({ initialSlice, initialTab }: { initialSlice: LeavesSlice; initialTab?: string }) {
  useDataHydration(initialSlice);
  const { t, lang } = useLanguage();
  const { isAdmin, user } = useAuth();
  const store = useData();
  const toast = useToast();
  const { confirm } = useConfirm();
  const { leaveBalances, leaveRequests: allLeaveRequests } = store;
  const employees = store.employees;
  const getEmployee = (id: string) => employees.find((e) => e.id === id || e.email === id);
  const resolveEmployee = (id: string): Employee =>
    getEmployee(id) ?? {
      id,
      nameAr: "موظف غير مربوط",
      nameEn: "Unlinked Employee",
      positionAr: "",
      positionEn: "",
      department: "",
      email: id.includes("@") ? id : "",
      phone: "",
      status: "active",
      joinDate: "",
      salary: { basic: 0, housing: 0, transport: 0, other: 0 },
      initials: (id[0] || "?").toUpperCase(),
      color: "bg-slate-500",
      profileCompleted: true,
    };
  const isAr = lang === "ar";

  const leaveRequests = isAdmin
    ? allLeaveRequests
    : allLeaveRequests.filter((lr) => lr.employeeId === user.id || lr.employeeId === user.email);

  const [activeTab, setActiveTab] = useState<TabKey>(
    initialTab === "requests" || initialTab === "calendar" ? initialTab : "balance"
  );
  const [dialogOpen, setDialogOpen] = useState(false);

  const [submitError, setSubmitError] = useState("");
  const [formType, setFormType] = useState("annual");
  const [formStart, setFormStart] = useState("");
  const [formEnd, setFormEnd] = useState("");
  const [formReason, setFormReason] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const totalHolidayDays = useMemo(() => saudiHolidays.reduce((sum, h) => sum + h.days, 0), []);

  // Team Timeline state — month navigation
  const [timelineMonth, setTimelineMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const monthDays = useMemo(() => getMonthDays(timelineMonth), [timelineMonth]);
  const today = useMemo(() => new Date(), []);
  const upcomingHolidays = useMemo(() => {
    const t = new Date();
    const horizon = new Date(t.getFullYear() + 1, t.getMonth(), t.getDate());
    return saudiHolidays
      .filter((h) => {
        if (!h.startDate) return false;
        const d = new Date(h.startDate);
        return d >= t && d <= horizon;
      })
      .slice(0, 4);
  }, []);

  const approvedLeaves = useMemo(
    () => leaveRequests.filter((lr) => lr.status === "approved"),
    [leaveRequests]
  );
  const overlaps = useMemo(
    () => detectOverlaps(monthDays, approvedLeaves, resolveEmployee),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [monthDays, approvedLeaves]
  );
  const pendingLeaves = useMemo(
    () => leaveRequests.filter((lr) => lr.status === "pending").length,
    [leaveRequests]
  );

  // Employees on leave anywhere in the visible month (deduped count)
  const employeesOnLeave = useMemo(() => {
    const ids = new Set<string>();
    for (const lr of approvedLeaves) {
      const start = new Date(lr.startDate + "T00:00:00");
      const end = new Date(lr.endDate + "T00:00:00");
      const monthStart = monthDays[0];
      const monthEnd = monthDays[monthDays.length - 1];
      if (end >= monthStart && start <= monthEnd) ids.add(lr.employeeId);
    }
    return ids.size;
  }, [approvedLeaves, monthDays]);

  // Early-resumption requests = approved leaves that the employee returned
  // from before endDate (heuristic: there's an attendance record on or after
  // the original return). For now we surface leaves whose endDate is in
  // the future but a check-in exists for today (cheap heuristic; precise
  // detection would query attendance.date > today which we don't have here).
  const earlyResumptionCandidates = useMemo(() => {
    const todayStr = new Date().toISOString().split("T")[0];
    return approvedLeaves
      .filter((lr) => lr.endDate > todayStr)
      .slice(0, 4)
      .map((lr) => ({
        ...lr,
        employee: resolveEmployee(lr.employeeId),
      }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [approvedLeaves]);

  const tabs: { key: TabKey; label: string }[] = isAdmin
    ? [
        { key: "balance", label: t.lev.balance },
        { key: "requests", label: t.lev.requests },
        { key: "calendar", label: t.lev.teamCalendar },
      ]
    : [
        { key: "balance", label: t.lev.balance },
        { key: "requests", label: t.lev.requests },
      ];

  const leaveTypeOptions = ["annual", "sick", "unpaid", "marriage", "paternity"] as const;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formStart || !formEnd) return;
    setSubmitError("");

    const start = new Date(formStart + "T00:00:00");
    const end = new Date(formEnd + "T00:00:00");
    if (end < start) return;
    const diffMs = end.getTime() - start.getTime();
    const days = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1);

    if (formType !== "unpaid") {
      const balance = leaveBalances.find((b) => b.typeKey === formType);
      const remaining = balance ? balance.remaining : 0;
      if (days > remaining) {
        const typeName = t.lev[formType as keyof typeof t.lev] || formType;
        setSubmitError(
          isAr
            ? `عدد الأيام المطلوبة (${days}) يتجاوز رصيدك المتبقي (${remaining} يوم) لـ${typeName}`
            : `Requested days (${days}) exceeds your remaining balance (${remaining} days) for ${typeName}`
        );
        return;
      }
    }

    try {
      await store.submitLeaveRequest({
        employeeId: user.id,
        typeKey: formType,
        startDate: formStart,
        endDate: formEnd,
        days,
        status: "pending",
        reasonAr: formReason,
        reasonEn: formReason,
      });
    } catch (error) {
      console.error("[HR] leave request submission failed:", error);
      setSubmitError(isAr ? "فشل إرسال الطلب. حاول مرة أخرى." : "Failed to submit request. Please try again.");
      return;
    }

    setSubmitSuccess(true);
    setTimeout(() => {
      setSubmitSuccess(false);
      setDialogOpen(false);
      setFormType("annual");
      setFormStart("");
      setFormEnd("");
      setFormReason("");
    }, 5000);
  }

  function formatHolidayRange(startDate: string, endDate: string) {
    const start = formatDate(startDate + "T00:00:00", lang, { month: "long", day: "numeric" });
    if (startDate === endDate) return start;
    const end = formatDate(endDate + "T00:00:00", lang, { month: "long", day: "numeric" });
    return `${start} — ${end}`;
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="font-headline text-3xl md:text-4xl font-extrabold text-on-surface tracking-tight">
          {t.lev.title}
        </h1>
        <Button size="lg" onClick={() => setDialogOpen(true)}>
          <Icon name="add" size={20} />
          {t.lev.applyLeave}
        </Button>
      </div>

      {/* Tabs (pill style) */}
      <div className="inline-flex items-center bg-surface-container rounded-full p-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "px-5 py-2 rounded-full text-sm font-bold transition-all",
              activeTab === tab.key
                ? "gradient-btn shadow-primary-glow"
                : "text-on-surface-variant hover:text-on-surface"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── BALANCE TAB ───────────────────────────────── */}
      {activeTab === "balance" && (
        <div className="space-y-6">
          {/* Leave Balance Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {leaveBalances.map((lb) => {
              const config = typeConfig[lb.typeKey] ?? typeConfig.annual;
              const pct = lb.total > 0 ? (lb.remaining / lb.total) * 100 : 0;
              const levKey = lb.typeKey as keyof typeof t.lev;

              return (
                <div
                  key={lb.typeKey}
                  className="bg-surface-container-lowest p-5 rounded-2xl shadow-sm hover:shadow-primary-glow-lg transition-all group"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform", config.bg, config.icon)}>
                      <Icon name={config.iconName} size={26} fill />
                    </div>
                    <h3 className="font-headline font-bold text-base">{t.lev[levKey]}</h3>
                  </div>

                  <div className="flex items-end justify-between mb-3">
                    <div>
                      <span className="font-headline text-4xl font-black tabular-nums">{lb.remaining}</span>
                      <span className="text-sm text-on-surface-variant ms-2 font-medium">{t.lev.days}</span>
                    </div>
                    <p className="text-xs text-on-surface-variant font-medium">
                      {t.lev.used} {lb.used} / {lb.total}
                    </p>
                  </div>

                  <div className="h-2 w-full rounded-full bg-surface-container-highest overflow-hidden">
                    <div className={cn("h-full rounded-full bg-gradient-to-r transition-all shadow-primary-glow", config.bar)} style={{ width: `${pct}%` }} />
                  </div>

                  <p className="text-xs text-on-surface-variant mt-2 font-medium">
                    {t.lev.remaining}: {lb.remaining} {t.lev.days}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Saudi Public Holidays */}
          <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-amber-500/15">
                <Icon name="star" size={26} fill className="text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <h3 className="font-headline font-bold text-xl">{t.holiday.saudiHolidays}</h3>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  {totalHolidayDays} {t.lev.days} {t.holiday.title.toLowerCase()}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {saudiHolidays.map((h) => (
                <div
                  key={h.id}
                  className="flex items-center justify-between gap-4 rounded-2xl p-4 transition-colors bg-surface-container/50"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-2 h-2 rounded-full flex-shrink-0 bg-on-surface-variant/40" />
                    <div className="min-w-0">
                      <p className="font-bold text-sm">
                        {isAr ? h.nameAr : h.nameEn}
                      </p>
                      <p className="text-xs mt-0.5 text-on-surface-variant">
                        {formatHolidayRange(h.startDate, h.endDate)}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline">
                    {h.days} {h.days === 1 ? t.holiday.day : t.holiday.daysCount}
                  </Badge>
                </div>
              ))}
            </div>

            <div className="mt-5 pt-5 flex items-center justify-between">
              <span className="text-sm font-bold text-on-surface-variant">
                {t.lev.total} {t.holiday.title}
              </span>
              <span className="font-headline text-lg font-black tabular-nums">
                {totalHolidayDays} {t.lev.days}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── REQUESTS TAB ──────────────────────────────── */}
      {activeTab === "requests" && (
        <div className="bg-surface-container-lowest rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr className="bg-surface-container/30">
                  <th className="text-start px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">{t.common.name}</th>
                  <th className="text-start px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">{t.lev.leaveType}</th>
                  <th className="text-start px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">{t.lev.startDate}</th>
                  <th className="text-start px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">{t.lev.endDate}</th>
                  <th className="text-start px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">{t.lev.daysCount}</th>
                  <th className="text-start px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">{t.common.status}</th>
                  {isAdmin && <th className="text-start px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">{t.common.actions}</th>}
                </tr>
              </thead>
              <tbody>
                {leaveRequests.length === 0 && (
                  <tr>
                    <td colSpan={isAdmin ? 7 : 6} className="text-center py-14 text-on-surface-variant">
                      <Icon name="event_busy" size={44} className="mb-3 opacity-40" />
                      <p className="text-sm font-medium">{t.common.noData}</p>
                    </td>
                  </tr>
                )}
                {leaveRequests.map((lr) => {
                  const emp = resolveEmployee(lr.employeeId);
                  const levKey = lr.typeKey as keyof typeof t.lev;
                  const statusKey = lr.status as keyof typeof t.statuses;

                  return (
                    <tr key={lr.id} className="hover:bg-surface-container-low transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <Avatar className="w-8 h-8">
                            <AvatarFallback className={cn("text-white text-[11px] font-bold", emp.color)}>
                              {emp.initials}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm font-bold">{isAr ? emp.nameAr : emp.nameEn}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-on-surface-variant font-medium">{t.lev[levKey]}</td>
                      <td className="px-6 py-4 text-sm text-on-surface-variant font-medium tabular-nums">{fmtDate(lr.startDate, lang)}</td>
                      <td className="px-6 py-4 text-sm text-on-surface-variant font-medium tabular-nums">{fmtDate(lr.endDate, lang)}</td>
                      <td className="px-6 py-4 text-sm text-on-surface-variant font-medium">{lr.days} {t.lev.days}</td>
                      <td className="px-6 py-4">
                        <Badge variant={statusBadgeVariant[lr.status] ?? "warning"}>
                          {t.statuses[statusKey]}
                        </Badge>
                      </td>
                      {isAdmin && (
                        <td className="px-6 py-4">
                          {lr.status === "pending" && (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={async () => {
                                  const ok = await confirm({
                                    title: isAr ? "تأكيد الموافقة" : "Approve Request",
                                    description: isAr ? "هل أنت متأكد من الموافقة على هذا الطلب؟" : "Are you sure you want to approve this request?",
                                    confirmLabel: isAr ? "موافقة" : "Approve",
                                    cancelLabel: isAr ? "إلغاء" : "Cancel",
                                  });
                                  if (!ok) return;
                                  try {
                                    await store.approveLeaveRequest(lr.id);
                                    toast.success(isAr ? "تمت الموافقة" : "Approved");
                                  } catch (e) {
                                    console.error("[HR] approve failed:", e);
                                    toast.error(isAr ? "فشل تنفيذ الإجراء" : "Action failed");
                                  }
                                }}
                                className="p-2 rounded-full text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/15 transition-colors"
                                title={isAr ? "موافقة" : "Approve"}
                                aria-label={isAr ? "موافقة" : "Approve"}
                              >
                                <Icon name="check" size={18} />
                              </button>
                              <button
                                onClick={async () => {
                                  const ok = await confirm({
                                    title: isAr ? "تأكيد الرفض" : "Reject Request",
                                    description: isAr ? "هل أنت متأكد من رفض هذا الطلب؟" : "Are you sure you want to reject this request?",
                                    confirmLabel: isAr ? "رفض" : "Reject",
                                    cancelLabel: isAr ? "إلغاء" : "Cancel",
                                    variant: "danger",
                                  });
                                  if (!ok) return;
                                  try {
                                    await store.rejectLeaveRequest(lr.id);
                                    toast.success(isAr ? "تم الرفض" : "Rejected");
                                  } catch (e) {
                                    console.error("[HR] reject failed:", e);
                                    toast.error(isAr ? "فشل تنفيذ الإجراء" : "Action failed");
                                  }
                                }}
                                className="p-2 rounded-full text-md-error hover:bg-error-container/20 transition-colors"
                                title={isAr ? "رفض" : "Reject"}
                                aria-label={isAr ? "رفض" : "Reject"}
                              >
                                <Icon name="close" size={18} />
                              </button>
                            </div>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TEAM CALENDAR TAB ─────────────────────────── */}
      {activeTab === "calendar" && (
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
          {/* Main timeline column */}
          <div className="xl:col-span-3 space-y-6">
            {/* Header with month navigation */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Icon name="calendar_month" size={22} className="text-primary" />
                <h3 className="font-headline font-bold text-xl">
                  {isAr ? "الجدول الزمني للفريق" : "Team Timeline"}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setTimelineMonth(new Date(timelineMonth.getFullYear(), timelineMonth.getMonth() - 1, 1))}
                  className="w-9 h-9 rounded-xl bg-surface-container-high hover:bg-surface-container-highest flex items-center justify-center transition-colors"
                  aria-label={isAr ? "الشهر السابق" : "Previous month"}
                >
                  <Icon name={isAr ? "chevron_right" : "chevron_left"} size={18} />
                </button>
                <span className="text-sm font-bold tabular-nums px-3 py-2 bg-surface-container-high rounded-xl min-w-[140px] text-center">
                  {fmtMonthYear(timelineMonth, lang)}
                </span>
                <button
                  onClick={() => setTimelineMonth(new Date(timelineMonth.getFullYear(), timelineMonth.getMonth() + 1, 1))}
                  className="w-9 h-9 rounded-xl bg-surface-container-high hover:bg-surface-container-highest flex items-center justify-center transition-colors"
                  aria-label={isAr ? "الشهر التالي" : "Next month"}
                >
                  <Icon name={isAr ? "chevron_left" : "chevron_right"} size={18} />
                </button>
                <button
                  onClick={() => setTimelineMonth(new Date(today.getFullYear(), today.getMonth(), 1))}
                  className="px-3 h-9 rounded-xl bg-primary-container/30 text-primary text-sm font-bold hover:bg-primary-container/50 transition-colors"
                >
                  {isAr ? "اليوم" : "Today"}
                </button>
              </div>
            </div>

            {/* KPI cards (Employees on leave / Overlaps / Pending) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-surface-container-lowest p-5 rounded-2xl shadow-sm">
                <p className="text-sm text-on-surface-variant font-medium">
                  {isAr ? "موظفون في إجازة" : "Employees on leave"}
                </p>
                <p className="font-headline text-3xl font-black text-on-surface tabular-nums mt-2">
                  {employeesOnLeave}
                </p>
              </div>
              <div className="bg-surface-container-lowest p-5 rounded-2xl shadow-sm">
                <p className="text-sm text-on-surface-variant font-medium flex items-center gap-1.5">
                  {isAr ? "أيام تداخل" : "Overlap days"}
                  {overlaps.length > 0 && (
                    <Icon name="warning" size={14} fill className="text-amber-600 dark:text-amber-400" />
                  )}
                </p>
                <p className="font-headline text-3xl font-black text-on-surface tabular-nums mt-2">
                  {overlaps.length}
                </p>
              </div>
              <div className="bg-surface-container-lowest p-5 rounded-2xl shadow-sm">
                <p className="text-sm text-on-surface-variant font-medium">
                  {isAr ? "طلبات معلّقة" : "Pending requests"}
                </p>
                <p className="font-headline text-3xl font-black text-on-surface tabular-nums mt-2">
                  {pendingLeaves}
                </p>
              </div>
            </div>

            {/* Gantt-style monthly timeline */}
            <div className="bg-surface-container-lowest rounded-2xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <div className="min-w-[900px]">
                  {/* Day header strip */}
                  <div className="flex border-b border-outline-variant/20">
                    <div className="w-48 shrink-0 px-4 py-3 text-xs font-bold uppercase text-on-surface-variant bg-surface-container/30">
                      {isAr ? "الموظف" : "Employee"}
                    </div>
                    <div className="flex flex-1">
                      {monthDays.map((d) => {
                        const isToday = isSameDay(d, today);
                        const isWeekend = d.getDay() === 5 || d.getDay() === 6;
                        const holiday = getHolidayForDate(d);
                        return (
                          <div
                            key={d.getTime()}
                            className={cn(
                              "flex-1 min-w-[28px] py-2 text-center text-[10px] font-bold tabular-nums border-l border-outline-variant/10 first:border-l-0",
                              isToday && "bg-primary-container/30 text-primary",
                              !isToday && holiday && "bg-amber-500/10 text-amber-700 dark:text-amber-400",
                              !isToday && !holiday && isWeekend && "bg-surface-container/40 text-on-surface-variant",
                            )}
                            title={holiday ? (isAr ? holiday.nameAr : holiday.nameEn) : ""}
                          >
                            {d.getDate()}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* One row per employee with approved leaves in this month */}
                  {(() => {
                    const empMap = new Map<string, typeof approvedLeaves>();
                    for (const lr of approvedLeaves) {
                      const arr = empMap.get(lr.employeeId) || [];
                      arr.push(lr);
                      empMap.set(lr.employeeId, arr);
                    }
                    const rows = Array.from(empMap.entries()).filter(([, leaves]) =>
                      leaves.some((lr) => {
                        const start = new Date(lr.startDate + "T00:00:00");
                        const end = new Date(lr.endDate + "T00:00:00");
                        return end >= monthDays[0] && start <= monthDays[monthDays.length - 1];
                      })
                    );
                    if (rows.length === 0) {
                      return (
                        <div className="px-6 py-12 text-center text-on-surface-variant">
                          <Icon name="event_available" size={36} className="opacity-40 mb-2" />
                          <p className="text-sm font-medium">
                            {isAr ? "لا إجازات معتمدة في هذا الشهر" : "No approved leaves this month"}
                          </p>
                        </div>
                      );
                    }
                    return rows.map(([empId, leaves]) => {
                      const emp = resolveEmployee(empId);
                      return (
                        <div key={empId} className="flex border-b border-outline-variant/10 last:border-0 hover:bg-surface-container-low/30 transition-colors">
                          <div className="w-48 shrink-0 px-4 py-3 flex items-center gap-2">
                            <Avatar className="w-7 h-7">
                              <AvatarFallback className={cn("text-white text-[10px] font-bold", emp.color)}>
                                {emp.initials}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-xs font-bold truncate">
                              {isAr ? emp.nameAr : emp.nameEn}
                            </span>
                          </div>
                          <div className="flex flex-1 relative items-center py-2">
                            {monthDays.map((d) => {
                              const lr = leaves.find((x) => isDateInRange(d, x.startDate, x.endDate));
                              const config = lr ? typeConfig[lr.typeKey] ?? typeConfig.annual : null;
                              return (
                                <div
                                  key={d.getTime()}
                                  className={cn(
                                    "flex-1 min-w-[28px] h-6 border-l border-outline-variant/5 first:border-l-0",
                                    lr && "bg-gradient-to-r " + (config?.bar ?? "from-emerald-400 to-emerald-600") + " opacity-80",
                                  )}
                                  title={lr ? `${lr.startDate} → ${lr.endDate}` : ""}
                                />
                              );
                            })}
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar (right) */}
          <div className="xl:col-span-1 space-y-6">
            {/* Upcoming holidays */}
            <div className="bg-surface-container-lowest rounded-2xl shadow-sm p-5">
              <div className="flex items-center gap-2 mb-3">
                <Icon name="event" size={18} className="text-primary" />
                <h4 className="font-headline font-bold text-sm">
                  {isAr ? "العطل القادمة" : "Upcoming holidays"}
                </h4>
              </div>
              {upcomingHolidays.length === 0 ? (
                <p className="text-xs text-on-surface-variant text-center py-4">
                  {isAr ? "لا عطل قادمة قريباً" : "No upcoming holidays"}
                </p>
              ) : (
                <ul className="space-y-2">
                  {upcomingHolidays.map((h) => (
                    <li key={h.id} className="flex items-center gap-2 px-2 py-2 rounded-xl bg-amber-500/10">
                      <Icon name="star" size={14} fill className="text-amber-600 dark:text-amber-400 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold truncate">
                          {isAr ? h.nameAr : h.nameEn}
                        </p>
                        <p className="text-[10px] text-on-surface-variant tabular-nums">
                          {h.startDate}
                          {h.endDate && h.startDate !== h.endDate ? ` → ${h.endDate}` : ""}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Overlaps panel */}
            {overlaps.length > 0 && (
              <div className="bg-surface-container-lowest rounded-2xl shadow-sm p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Icon name="warning" size={18} fill className="text-amber-600 dark:text-amber-400" />
                  <h4 className="font-headline font-bold text-sm">
                    {isAr ? "أيام التداخل" : "Overlap days"}
                  </h4>
                </div>
                <ul className="space-y-2 max-h-64 overflow-y-auto">
                  {overlaps.slice(0, 8).map((o) => (
                    <li key={o.date.getTime()} className="text-xs">
                      <p className="font-bold tabular-nums text-amber-700 dark:text-amber-400">
                        {fmtDate(o.date.toISOString().split("T")[0], lang)}
                      </p>
                      <p className="text-on-surface-variant text-[11px] mt-0.5">
                        {o.employees.length} {isAr ? "موظف في إجازة" : "employees on leave"}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Early resumption candidates */}
            {earlyResumptionCandidates.length > 0 && (
              <div className="bg-surface-container-lowest rounded-2xl shadow-sm p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Icon name="history" size={18} className="text-blue-600 dark:text-blue-400" />
                  <h4 className="font-headline font-bold text-sm">
                    {isAr ? "إجازات جارية" : "Active leaves"}
                  </h4>
                </div>
                <ul className="space-y-2">
                  {earlyResumptionCandidates.map((er) => (
                    <li key={er.id} className="flex items-center gap-2 px-2 py-2 rounded-xl bg-surface-container-low">
                      <Avatar className="w-7 h-7">
                        <AvatarFallback className={cn("text-white text-[10px] font-bold", er.employee.color)}>
                          {er.employee.initials}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold truncate">
                          {isAr ? er.employee.nameAr : er.employee.nameEn}
                        </p>
                        <p className="text-[10px] text-on-surface-variant tabular-nums">
                          → {er.endDate}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── APPLY LEAVE DIALOG ────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={(v) => { if (!submitSuccess) setDialogOpen(v); }}>
        <DialogContent className="sm:max-w-md">
          {submitSuccess ? (
            <div className="flex flex-col items-center justify-center py-8 gap-4">
              <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center shadow-[0_0_30px_rgba(16,185,129,0.4)]">
                <Icon name="check_circle" size={48} fill className="text-emerald-500" />
              </div>
              <div className="text-center">
                <p className="font-headline text-xl font-bold text-on-surface">
                  {isAr ? "تم إرسال الطلب بنجاح" : "Request Submitted Successfully"}
                </p>
                <p className="text-sm text-on-surface-variant mt-2">
                  {isAr ? "سيتم مراجعة طلبك من قبل المسؤول" : "Your request will be reviewed by the administrator"}
                </p>
              </div>
            </div>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>{t.lev.applyLeave}</DialogTitle>
                <DialogDescription>
                  {isAr ? "قم بتعبئة البيانات التالية لتقديم طلب الإجازة" : "Fill in the details below to submit your leave request"}
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-bold">{t.lev.leaveType}</label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value)}
                    className="w-full h-11 rounded-xl bg-surface-container-high px-4 text-sm outline-none focus:ring-2 focus:ring-primary/40"
                  >
                    {leaveTypeOptions.map((opt) => (
                      <option key={opt} value={opt}>{t.lev[opt as keyof typeof t.lev]}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-bold">{t.lev.startDate}</label>
                  <input
                    type="date"
                    required
                    value={formStart}
                    onChange={(e) => setFormStart(e.target.value)}
                    className="w-full h-11 rounded-xl bg-surface-container-high px-4 text-sm outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-bold">{t.lev.endDate}</label>
                  <input
                    type="date"
                    required
                    value={formEnd}
                    onChange={(e) => setFormEnd(e.target.value)}
                    className="w-full h-11 rounded-xl bg-surface-container-high px-4 text-sm outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-bold">{t.lev.reason}</label>
                  <textarea
                    value={formReason}
                    onChange={(e) => setFormReason(e.target.value)}
                    rows={3}
                    placeholder={isAr ? "اكتب سبب الإجازة..." : "Enter leave reason..."}
                    className="w-full rounded-xl bg-surface-container-high px-4 py-3 text-sm outline-none resize-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>

                {submitError && (
                  <p className="text-sm text-md-error font-bold">{submitError}</p>
                )}

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => { setDialogOpen(false); setSubmitError(""); }}
                  >
                    {t.common.cancel}
                  </Button>
                  <Button type="submit">{t.common.submit}</Button>
                </DialogFooter>
              </form>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
