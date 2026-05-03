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

function getWeekDays(refDate: Date) {
  const day = refDate.getDay();
  const sun = new Date(refDate);
  sun.setDate(refDate.getDate() - day);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(sun);
    d.setDate(sun.getDate() + i);
    return d;
  });
}

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

  const weekDays = useMemo(() => getWeekDays(new Date()), []);
  const totalHolidayDays = useMemo(() => saudiHolidays.reduce((sum, h) => sum + h.days, 0), []);

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
  const dayKeys = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

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
        <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-5">
            <span className="w-1.5 h-7 bg-primary rounded-full" />
            <Icon name="calendar_month" size={22} className="text-primary" />
            <h3 className="font-headline font-bold text-xl">{t.lev.teamCalendar}</h3>
          </div>

          <div className="grid grid-cols-7 gap-2">
            {weekDays.map((wd, i) => {
              const isToday = isSameDay(wd, new Date());
              return (
                <div key={i} className="text-center">
                  <p className="text-xs font-bold uppercase text-on-surface-variant mb-1.5">{t.days[dayKeys[i]]}</p>
                  <p className={cn(
                    "text-sm font-bold mb-2 inline-flex items-center justify-center w-8 h-8 rounded-full tabular-nums transition-all",
                    isToday ? "gradient-btn shadow-primary-glow" : "text-on-surface"
                  )}>
                    {wd.getDate()}
                  </p>
                </div>
              );
            })}

            {weekDays.map((wd, i) => {
              const onLeave = leaveRequests
                .filter((lr) => lr.status === "approved" && isDateInRange(wd, lr.startDate, lr.endDate))
                .map((lr) => resolveEmployee(lr.employeeId));
              const holiday = getHolidayForDate(wd);

              return (
                <div
                  key={`ppl-${i}`}
                  className={cn(
                    "min-h-[90px] rounded-2xl p-2 space-y-1",
                    isSameDay(wd, new Date()) ? "bg-primary-container/20" :
                    holiday ? "bg-amber-500/10" : "bg-surface-container-low"
                  )}
                >
                  {holiday && (
                    <div className="flex items-center gap-1 rounded-xl bg-amber-500/20 px-2 py-1">
                      <Icon name="star" size={12} fill className="text-amber-600 dark:text-amber-400 flex-shrink-0" />
                      <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 truncate">
                        {isAr ? holiday.nameAr : holiday.nameEn}
                      </span>
                    </div>
                  )}

                  {onLeave.length === 0 && !holiday && (
                    <p className="text-xs text-on-surface-variant/50 text-center mt-6">-</p>
                  )}
                  {onLeave.map((emp) => (
                    <div key={emp.id} className="flex items-center gap-1 rounded-xl bg-surface-container-lowest px-2 py-1">
                      <Avatar className="w-5 h-5" size="sm">
                        <AvatarFallback className={cn("text-white text-[8px] font-bold", emp.color)}>
                          {emp.initials}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-[10px] font-bold truncate">
                        {isAr ? emp.nameAr.split(" ")[0] : emp.nameEn.split(" ")[0]}
                      </span>
                    </div>
                  ))}
                </div>
              );
            })}
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
