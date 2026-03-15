"use client";

import { useState, useMemo } from "react";
import { useLanguage, useAuth } from "@/components/providers";
import { useData } from "@/lib/data-store";
import { employees, saudiHolidays } from "@/lib/mock-data";
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
import { cn } from "@/lib/utils";
import {
  Plus,
  Calendar,
  Palmtree,
  Stethoscope,
  User,
  Ban,
  Heart,
  Baby,
  Star,
  Check,
  X,
} from "lucide-react";

// ---------- constants ----------

const typeColors: Record<string, { bg: string; bar: string; icon: string }> = {
  annual: {
    bg: "bg-emerald-50 dark:bg-emerald-500/10",
    bar: "bg-emerald-500",
    icon: "text-emerald-600 dark:text-emerald-400",
  },
  sick: {
    bg: "bg-red-50 dark:bg-red-500/10",
    bar: "bg-red-500",
    icon: "text-red-600 dark:text-red-400",
  },
  personal: {
    bg: "bg-blue-50 dark:bg-blue-500/10",
    bar: "bg-blue-500",
    icon: "text-blue-600 dark:text-blue-400",
  },
  unpaid: {
    bg: "bg-gray-50 dark:bg-gray-500/10",
    bar: "bg-gray-500",
    icon: "text-gray-600 dark:text-gray-400",
  },
  marriage: {
    bg: "bg-pink-50 dark:bg-pink-500/10",
    bar: "bg-pink-500",
    icon: "text-pink-600 dark:text-pink-400",
  },
  paternity: {
    bg: "bg-cyan-50 dark:bg-cyan-500/10",
    bar: "bg-cyan-500",
    icon: "text-cyan-600 dark:text-cyan-400",
  },
};

const typeIcons: Record<string, React.ElementType> = {
  annual: Palmtree,
  sick: Stethoscope,
  personal: User,
  unpaid: Ban,
  marriage: Heart,
  paternity: Baby,
};

const statusStyles: Record<string, string> = {
  pending:
    "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-400 border-0",
  approved:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-400 border-0",
  rejected:
    "bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-400 border-0",
};

// ---------- helpers ----------

function getEmployee(id: string) {
  return employees.find((e) => e.id === id);
}

function getWeekDays(refDate: Date) {
  const day = refDate.getDay(); // 0=Sun
  const sun = new Date(refDate);
  sun.setDate(refDate.getDate() - day);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(sun);
    d.setDate(sun.getDate() + i);
    return d;
  });
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
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

/** Check if a given date falls within any Saudi holiday range */
function getHolidayForDate(date: Date) {
  return saudiHolidays.find((h) => isDateInRange(date, h.startDate, h.endDate));
}

// ---------- component ----------

type TabKey = "balance" | "requests" | "calendar";

export default function LeavesPage() {
  const { t, lang } = useLanguage();
  const { isAdmin, user } = useAuth();
  const store = useData();
  const { leaveBalances, leaveRequests: allLeaveRequests } = store;
  const isAr = lang === "ar";

  // Employees see only their own leave records
  const leaveRequests = isAdmin
    ? allLeaveRequests
    : allLeaveRequests.filter((lr) => lr.employeeId === user.id);

  const [activeTab, setActiveTab] = useState<TabKey>("balance");
  const [dialogOpen, setDialogOpen] = useState(false);

  // form state
  const [formType, setFormType] = useState("annual");
  const [formStart, setFormStart] = useState("");
  const [formEnd, setFormEnd] = useState("");
  const [formReason, setFormReason] = useState("");

  const weekDays = useMemo(() => getWeekDays(new Date()), []);

  const today = useMemo(() => new Date(), []);

  const totalHolidayDays = useMemo(
    () => saudiHolidays.reduce((sum, h) => sum + h.days, 0),
    []
  );

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

  const leaveTypeOptions = [
    "annual",
    "sick",
    "personal",
    "unpaid",
    "marriage",
    "paternity",
  ] as const;

  const dayKeys = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Calculate days between start and end
    const start = new Date(formStart + "T00:00:00");
    const end = new Date(formEnd + "T00:00:00");
    const diffMs = end.getTime() - start.getTime();
    const days = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1);

    store.submitLeaveRequest({
      employeeId: user.id ?? "EMP003",
      typeKey: formType,
      startDate: formStart,
      endDate: formEnd,
      days,
      status: "pending",
      reasonAr: formReason,
      reasonEn: formReason,
    });

    setDialogOpen(false);
    setFormType("annual");
    setFormStart("");
    setFormEnd("");
    setFormReason("");
  }

  /** Format a holiday date range for display */
  function formatHolidayRange(startDate: string, endDate: string) {
    const start = formatDate(startDate + "T00:00:00", lang, {
      month: "long",
      day: "numeric",
    });
    if (startDate === endDate) return start;
    const end = formatDate(endDate + "T00:00:00", lang, {
      month: "long",
      day: "numeric",
    });
    return `${start} — ${end}`;
  }

  /** Check if a holiday is upcoming (end date >= today) */
  function isUpcoming(endDate: string) {
    const end = new Date(endDate + "T00:00:00");
    const todayNorm = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate()
    );
    return end >= todayNorm;
  }

  // ---------- render ----------
  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t.lev.title}</h1>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="w-4 h-4" />
          {t.lev.applyLeave}
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
              activeTab === tab.key
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ==================== BALANCE TAB ==================== */}
      {activeTab === "balance" && (
        <div className="space-y-6">
          {/* Leave Balance Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {leaveBalances.map((lb) => {
              const colors = typeColors[lb.typeKey] ?? typeColors.annual;
              const Icon = typeIcons[lb.typeKey] ?? Palmtree;
              const pct = lb.total > 0 ? (lb.used / lb.total) * 100 : 0;
              const levKey = lb.typeKey as keyof typeof t.lev;

              return (
                <div
                  key={lb.typeKey}
                  className="glass-card rounded-xl p-5 hover-lift"
                >
                  {/* icon + title */}
                  <div className="flex items-center gap-3 mb-4">
                    <div
                      className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center",
                        colors.bg
                      )}
                    >
                      <Icon className={cn("w-5 h-5", colors.icon)} />
                    </div>
                    <h3 className="font-semibold">{t.lev[levKey]}</h3>
                  </div>

                  {/* numbers */}
                  <div className="flex items-end justify-between mb-3">
                    <div>
                      <span className="text-3xl font-bold">{lb.remaining}</span>
                      <span className="text-sm text-muted-foreground ms-1">
                        {t.lev.days}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t.lev.used} {lb.used} / {t.lev.total} {lb.total}
                    </p>
                  </div>

                  {/* progress bar (styled div, NOT shadcn Progress) */}
                  <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className={cn("h-full rounded-full transition-all", colors.bar)}
                      style={{ width: `${pct}%` }}
                    />
                  </div>

                  {/* label */}
                  <p className="text-xs text-muted-foreground mt-2">
                    {t.lev.remaining}: {lb.remaining} {t.lev.days}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Saudi Public Holidays Section */}
          <div className="glass-card rounded-xl p-5 lg:p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-amber-50 dark:bg-amber-500/10">
                <Star className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <h3 className="font-bold text-lg">{t.holiday.saudiHolidays}</h3>
                <p className="text-xs text-muted-foreground">
                  {totalHolidayDays} {t.lev.days} {t.holiday.title.toLowerCase()}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {saudiHolidays.map((h) => {
                const upcoming = isUpcoming(h.endDate);
                return (
                  <div
                    key={h.id}
                    className={cn(
                      "flex items-center justify-between gap-4 rounded-lg border p-4 transition-colors",
                      upcoming
                        ? "border-emerald-200 bg-emerald-50/50 dark:border-emerald-500/20 dark:bg-emerald-500/5"
                        : "border-border/50 bg-muted/30"
                    )}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={cn(
                          "w-2 h-2 rounded-full flex-shrink-0",
                          upcoming
                            ? "bg-emerald-500"
                            : "bg-gray-300 dark:bg-gray-600"
                        )}
                      />
                      <div className="min-w-0">
                        <p
                          className={cn(
                            "font-semibold text-sm",
                            !upcoming && "text-muted-foreground"
                          )}
                        >
                          {isAr ? h.nameAr : h.nameEn}
                        </p>
                        <p
                          className={cn(
                            "text-xs mt-0.5",
                            upcoming
                              ? "text-muted-foreground"
                              : "text-muted-foreground/60"
                          )}
                        >
                          {formatHolidayRange(h.startDate, h.endDate)}
                        </p>
                      </div>
                    </div>

                    <Badge
                      className={cn(
                        "text-[11px] font-medium flex-shrink-0 border-0",
                        upcoming
                          ? "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-400"
                          : "bg-gray-100 text-gray-500 dark:bg-gray-500/15 dark:text-gray-400"
                      )}
                    >
                      {h.days}{" "}
                      {h.days === 1 ? t.holiday.day : t.holiday.daysCount}
                    </Badge>
                  </div>
                );
              })}
            </div>

            {/* Total holiday days footer */}
            <div className="mt-4 pt-4 border-t border-border/50 flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">
                {t.lev.total} {t.holiday.title}
              </span>
              <span className="text-sm font-bold">
                {totalHolidayDays} {t.lev.days}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ==================== REQUESTS TAB ==================== */}
      {activeTab === "requests" && (
        <div className="glass-card rounded-xl p-5 lg:p-6">
          <div className="overflow-x-auto -mx-5 lg:-mx-6 px-5 lg:px-6">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr className="text-xs text-muted-foreground border-b border-border">
                  <th className="text-start pb-3 font-medium">
                    {t.common.name}
                  </th>
                  <th className="text-start pb-3 font-medium">
                    {t.lev.leaveType}
                  </th>
                  <th className="text-start pb-3 font-medium">
                    {t.lev.startDate}
                  </th>
                  <th className="text-start pb-3 font-medium">
                    {t.lev.endDate}
                  </th>
                  <th className="text-start pb-3 font-medium">
                    {t.lev.daysCount}
                  </th>
                  <th className="text-start pb-3 font-medium">
                    {t.common.status}
                  </th>
                  {isAdmin && (
                    <th className="text-start pb-3 font-medium">
                      {t.common.actions}
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {leaveRequests.map((lr) => {
                  const emp = getEmployee(lr.employeeId);
                  if (!emp) return null;
                  const levKey = lr.typeKey as keyof typeof t.lev;
                  const statusKey = lr.status as keyof typeof t.statuses;

                  return (
                    <tr
                      key={lr.id}
                      className="border-b border-border/50 last:border-0 hover:bg-accent/30 transition-colors"
                    >
                      {/* Employee */}
                      <td className="py-3">
                        <div className="flex items-center gap-2.5">
                          <Avatar className="w-7 h-7">
                            <AvatarFallback
                              className={cn(
                                "text-white text-[10px] font-bold",
                                emp.color
                              )}
                            >
                              {emp.initials}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm font-medium">
                            {isAr ? emp.nameAr : emp.nameEn}
                          </span>
                        </div>
                      </td>
                      {/* Type */}
                      <td className="py-3 text-sm text-muted-foreground">
                        {t.lev[levKey]}
                      </td>
                      {/* Start */}
                      <td className="py-3 text-sm text-muted-foreground">
                        {fmtDate(lr.startDate, lang)}
                      </td>
                      {/* End */}
                      <td className="py-3 text-sm text-muted-foreground">
                        {fmtDate(lr.endDate, lang)}
                      </td>
                      {/* Days */}
                      <td className="py-3 text-sm text-muted-foreground">
                        {lr.days} {t.lev.days}
                      </td>
                      {/* Status */}
                      <td className="py-3">
                        <Badge
                          className={cn(
                            "text-[11px] font-medium",
                            statusStyles[lr.status]
                          )}
                        >
                          {t.statuses[statusKey]}
                        </Badge>
                      </td>
                      {/* Admin Actions */}
                      {isAdmin && (
                        <td className="py-3">
                          {lr.status === "pending" && (
                            <div className="flex items-center gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-500/10"
                                onClick={() => store.approveItem("leaveRequests", lr.id)}
                              >
                                <Check className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-500/10"
                                onClick={() => store.rejectItem("leaveRequests", lr.id)}
                              >
                                <X className="w-4 h-4" />
                              </Button>
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

      {/* ==================== TEAM CALENDAR TAB ==================== */}
      {activeTab === "calendar" && (
        <div className="glass-card rounded-xl p-5 lg:p-6">
          <div className="flex items-center gap-2 mb-5">
            <Calendar className="w-5 h-5 text-primary" />
            <h3 className="font-bold text-lg">{t.lev.teamCalendar}</h3>
          </div>

          <div className="grid grid-cols-7 gap-2">
            {/* Day headers */}
            {weekDays.map((wd, i) => {
              const isToday = isSameDay(wd, new Date());
              return (
                <div key={i} className="text-center">
                  <p className="text-xs font-medium text-muted-foreground mb-1">
                    {t.days[dayKeys[i]]}
                  </p>
                  <p
                    className={cn(
                      "text-sm font-semibold mb-2 inline-flex items-center justify-center w-7 h-7 rounded-full",
                      isToday && "bg-primary text-primary-foreground"
                    )}
                  >
                    {wd.getDate()}
                  </p>
                </div>
              );
            })}

            {/* People on leave per day + holiday markers */}
            {weekDays.map((wd, i) => {
              const onLeave = leaveRequests
                .filter(
                  (lr) =>
                    lr.status === "approved" &&
                    isDateInRange(wd, lr.startDate, lr.endDate)
                )
                .map((lr) => getEmployee(lr.employeeId))
                .filter(Boolean);

              const holiday = getHolidayForDate(wd);

              return (
                <div
                  key={`ppl-${i}`}
                  className={cn(
                    "min-h-[80px] rounded-lg border border-border/50 p-1.5 space-y-1",
                    isSameDay(wd, new Date()) && "bg-primary/5 border-primary/20",
                    holiday && !isSameDay(wd, new Date()) && "bg-amber-50/50 dark:bg-amber-500/5 border-amber-200/50 dark:border-amber-500/15"
                  )}
                >
                  {/* Holiday badge */}
                  {holiday && (
                    <div className="flex items-center gap-1 rounded-md bg-amber-100 dark:bg-amber-500/15 px-1.5 py-1">
                      <Star className="w-3 h-3 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                      <span className="text-[10px] font-medium text-amber-700 dark:text-amber-400 truncate">
                        {isAr ? holiday.nameAr : holiday.nameEn}
                      </span>
                    </div>
                  )}

                  {onLeave.length === 0 && !holiday && (
                    <p className="text-[10px] text-muted-foreground/50 text-center mt-4">
                      -
                    </p>
                  )}
                  {onLeave.map((emp) => (
                    <div
                      key={emp!.id}
                      className="flex items-center gap-1 rounded-md bg-accent/50 px-1.5 py-1"
                    >
                      <Avatar className="w-5 h-5" size="sm">
                        <AvatarFallback
                          className={cn(
                            "text-white text-[8px] font-bold",
                            emp!.color
                          )}
                        >
                          {emp!.initials}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-[10px] font-medium truncate">
                        {isAr ? emp!.nameAr.split(" ")[0] : emp!.nameEn.split(" ")[0]}
                      </span>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ==================== APPLY LEAVE DIALOG ==================== */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t.lev.applyLeave}</DialogTitle>
            <DialogDescription>
              {isAr
                ? "قم بتعبئة البيانات التالية لتقديم طلب الإجازة"
                : "Fill in the details below to submit your leave request"}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Leave Type */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t.lev.leaveType}</label>
              <select
                value={formType}
                onChange={(e) => setFormType(e.target.value)}
                className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/50"
              >
                {leaveTypeOptions.map((opt) => {
                  const levKey = opt as keyof typeof t.lev;
                  return (
                    <option key={opt} value={opt}>
                      {t.lev[levKey]}
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Start Date */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t.lev.startDate}</label>
              <input
                type="date"
                required
                value={formStart}
                onChange={(e) => setFormStart(e.target.value)}
                className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/50"
              />
            </div>

            {/* End Date */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t.lev.endDate}</label>
              <input
                type="date"
                required
                value={formEnd}
                onChange={(e) => setFormEnd(e.target.value)}
                className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/50"
              />
            </div>

            {/* Reason */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t.lev.reason}</label>
              <textarea
                value={formReason}
                onChange={(e) => setFormReason(e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none resize-none focus:border-ring focus:ring-2 focus:ring-ring/50"
                placeholder={
                  isAr ? "اكتب سبب الإجازة..." : "Enter leave reason..."
                }
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                {t.common.cancel}
              </Button>
              <Button type="submit">{t.common.submit}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
