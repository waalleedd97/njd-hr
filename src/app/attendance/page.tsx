"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useLanguage, useAuth } from "@/components/providers";
import { useData, haversineDistance } from "@/lib/data-store";
import {
  employees,
  calcDuration,
  geofenceConfig,
  penaltyRules,
} from "@/lib/mock-data";
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
  Clock,
  UserCheck,
  UserX,
  AlertTriangle,
  CalendarOff,
  MapPin,
  MapPinOff,
  ToggleLeft,
  ToggleRight,
  FileEdit,
  ShieldAlert,
  Info,
} from "lucide-react";

// ─── Scroll-style 12-hour Time Picker ─────────────────────────────────

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);
const ITEM_H = 36; // px per row

function to12h(time24: string): { hour: number; minute: number; period: "AM" | "PM" } {
  if (!time24) return { hour: 12, minute: 0, period: "AM" };
  const [h, m] = time24.split(":").map(Number);
  const period: "AM" | "PM" = h >= 12 ? "PM" : "AM";
  const hour = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return { hour, minute: m, period };
}

function to24h(hour: number, minute: number, period: "AM" | "PM"): string {
  let h = hour;
  if (period === "AM" && h === 12) h = 0;
  else if (period === "PM" && h !== 12) h += 12;
  return `${String(h).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function ScrollColumn({
  items,
  selected,
  onSelect,
}: {
  items: number[];
  selected: number;
  onSelect: (v: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const didMount = useRef(false);

  // Scroll selected item into view
  useEffect(() => {
    const idx = items.indexOf(selected);
    if (idx < 0 || !containerRef.current) return;
    const top = idx * ITEM_H;
    containerRef.current.scrollTo({ top, behavior: didMount.current ? "smooth" : "instant" });
    didMount.current = true;
  }, [selected, items]);

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto h-[180px] scrollbar-thin"
      style={{ scrollbarWidth: "thin" }}
    >
      {items.map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => onSelect(v)}
          className={cn(
            "w-full text-center text-sm tabular-nums transition-colors",
            v === selected
              ? "text-primary font-bold"
              : "text-muted-foreground hover:text-foreground"
          )}
          style={{ height: ITEM_H }}
        >
          {String(v).padStart(2, "0")}
        </button>
      ))}
    </div>
  );
}

function TimePicker({
  value,
  onChange,
  label,
  isAr,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  isAr: boolean;
}) {
  const parsed = to12h(value);
  const [hour, setHour] = useState(parsed.hour);
  const [minute, setMinute] = useState(parsed.minute);
  const [period, setPeriod] = useState<"AM" | "PM">(parsed.period);

  useEffect(() => {
    const p = to12h(value);
    setHour(p.hour);
    setMinute(p.minute);
    setPeriod(p.period);
  }, [value]);

  const emit = useCallback((h: number, m: number, p: "AM" | "PM") => {
    onChange(to24h(h, m, p));
  }, [onChange]);

  const selectHour = (h: number) => { setHour(h); emit(h, minute, period); };
  const selectMinute = (m: number) => { setMinute(m); emit(hour, m, period); };
  const selectPeriod = (p: "AM" | "PM") => { setPeriod(p); emit(hour, minute, p); };

  const amLabel = isAr ? "صباحاً" : "AM";
  const pmLabel = isAr ? "مساءً" : "PM";

  return (
    <div>
      <label className="text-sm font-medium text-foreground block mb-1.5">{label}</label>
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {/* Display header */}
        <div className="flex items-center justify-center gap-2 py-2.5 px-3 border-b border-border bg-muted/30">
          <Clock className="w-4 h-4 text-primary" />
          <span className="text-sm font-bold tabular-nums">
            {String(hour).padStart(2, "0")}:{String(minute).padStart(2, "0")}
          </span>
          <span className="text-xs font-medium text-muted-foreground">
            {period === "AM" ? amLabel : pmLabel}
          </span>
        </div>

        {/* AM / PM toggle */}
        <div className="flex border-b border-border">
          <button
            type="button"
            onClick={() => selectPeriod("AM")}
            className={cn(
              "flex-1 py-2 text-xs font-bold transition-colors",
              period === "AM"
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
            )}
          >
            {amLabel}
          </button>
          <button
            type="button"
            onClick={() => selectPeriod("PM")}
            className={cn(
              "flex-1 py-2 text-xs font-bold transition-colors",
              period === "PM"
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
            )}
          >
            {pmLabel}
          </button>
        </div>

        {/* Scroll columns */}
        <div className="flex divide-x divide-border">
          <ScrollColumn items={HOURS} selected={hour} onSelect={selectHour} />
          <ScrollColumn items={MINUTES} selected={minute} onSelect={selectMinute} />
        </div>
      </div>
    </div>
  );
}

const statusStyles: Record<string, string> = {
  present:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-400 border-0",
  absent:
    "bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-400 border-0",
  late:
    "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-400 border-0",
  "on-leave":
    "bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-400 border-0",
  "half-day":
    "bg-purple-100 text-purple-800 dark:bg-purple-500/15 dark:text-purple-400 border-0",
};

const statusLabels: Record<string, (t: ReturnType<typeof useLanguage>["t"]) => string> = {
  present: (t) => t.att.present,
  absent: (t) => t.att.absent,
  late: (t) => t.att.late,
  "on-leave": (t) => t.att.onLeave,
  "half-day": (t) => t.att.halfDay,
};

export default function AttendancePage() {
  const { t, lang } = useLanguage();
  const { isAdmin } = useAuth();
  const store = useData();
  const departments = store.departments;
  const isAr = lang === "ar";
  const [selectedDept, setSelectedDept] = useState("all");

  // Clock in/out state
  const [clockedIn, setClockedIn] = useState(false);
  const [clockInTime, setClockInTime] = useState<string | null>(null);
  const [clockOutTime, setClockOutTime] = useState<string | null>(null);
  const [clockMethod, setClockMethod] = useState<string>("geofence");

  // Geofence state
  const [isInsideGeofence, setIsInsideGeofence] = useState(true);
  const [geoChecked, setGeoChecked] = useState(false);

  // Real geolocation check
  useEffect(() => {
    if (clockMethod !== "geofence") return;
    if (!navigator.geolocation) {
      setGeoChecked(true);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const dist = haversineDistance(
          pos.coords.latitude,
          pos.coords.longitude,
          geofenceConfig.officeLat,
          geofenceConfig.officeLng
        );
        setIsInsideGeofence(dist <= geofenceConfig.radiusMeters);
        setGeoChecked(true);
      },
      () => {
        // Geolocation denied – fall back to demo toggle
        setGeoChecked(true);
      }
    );
  }, [clockMethod]);

  // Adjustment dialog state
  const [adjustDialogOpen, setAdjustDialogOpen] = useState(false);
  const [adjDate, setAdjDate] = useState("");
  const [adjOriginalIn, setAdjOriginalIn] = useState("");
  const [adjRequestedIn, setAdjRequestedIn] = useState("");
  const [adjOriginalOut, setAdjOriginalOut] = useState("");
  const [adjRequestedOut, setAdjRequestedOut] = useState("");
  const [adjReason, setAdjReason] = useState("");

  // Get current time formatted as HH:MM
  const getCurrentTime = () => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  };

  // Handle clock in
  const currentUserId = isAdmin ? null : "EMP003";
  const handleClockIn = () => {
    if (clockMethod === "geofence" && !isInsideGeofence) return;
    const time = getCurrentTime();
    setClockedIn(true);
    setClockInTime(time);
    setClockOutTime(null);
    if (currentUserId) {
      store.clockIn(currentUserId, time);
    }
  };

  // Handle clock out
  const handleClockOut = () => {
    const time = getCurrentTime();
    setClockedIn(false);
    setClockOutTime(time);
    if (currentUserId) {
      store.clockOut(currentUserId, time);
    }
  };

  // Handle adjustment submit
  const handleAdjustmentSubmit = () => {
    if (currentUserId) {
      store.submitAdjustment({
        employeeId: currentUserId,
        date: adjDate,
        originalIn: adjOriginalIn,
        requestedIn: adjRequestedIn,
        originalOut: adjOriginalOut,
        requestedOut: adjRequestedOut,
        reasonAr: adjReason,
        reasonEn: adjReason,
        status: "pending",
      });
    }
    setAdjustDialogOpen(false);
    setAdjDate("");
    setAdjOriginalIn("");
    setAdjRequestedIn("");
    setAdjOriginalOut("");
    setAdjRequestedOut("");
    setAdjReason("");
  };

  // Compute filtered records
  const filteredRecords = store.todayAttendance.filter((record) => {
    // Non-admin: only show own record
    if (!isAdmin) {
      return record.employeeId === currentUserId;
    }
    if (selectedDept === "all") return true;
    const emp = employees.find((e) => e.id === record.employeeId);
    return emp?.department === selectedDept;
  });

  // Summary counts
  const presentCount = filteredRecords.filter((r) => r.status === "present").length;
  const absentCount = filteredRecords.filter((r) => r.status === "absent").length;
  const lateCount = filteredRecords.filter((r) => r.status === "late").length;
  const onLeaveCount = filteredRecords.filter(
    (r) => r.status === "on-leave"
  ).length;

  const summaryCards = [
    {
      icon: UserCheck,
      label: t.att.present,
      count: presentCount,
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-500/10",
    },
    {
      icon: UserX,
      label: t.att.absent,
      count: absentCount,
      color: "text-red-600 dark:text-red-400",
      bg: "bg-red-500/10",
    },
    {
      icon: AlertTriangle,
      label: t.att.late,
      count: lateCount,
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-500/10",
    },
    {
      icon: CalendarOff,
      label: t.att.onLeave,
      count: onLeaveCount,
      color: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-500/10",
    },
  ];

  const methodOptions = [
    { key: "geofence", label: t.clock.geofence, icon: MapPin },
  ];

  const geofenceDisabled = !isInsideGeofence;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t.att.title}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t.att.today}</p>
      </div>

      {/* ───── Clock In/Out Section ───── */}
      <div className={cn("accent-card rounded-xl p-5 lg:p-6", !isAdmin && "ring-2 ring-primary/20")}>
        <div className="flex flex-col lg:flex-row lg:items-center gap-6">
          {/* Clock Button Area */}
          <div className="flex-1 flex flex-col items-center gap-4">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-5 h-5 text-primary" />
              <h3 className="font-bold text-lg">
                {clockedIn ? t.clock.clockOut : t.clock.clockIn}
              </h3>
            </div>

            {/* Status text */}
            <div className="text-center">
              {clockedIn && clockInTime ? (
                <p className="text-sm text-muted-foreground">
                  {t.clock.clockedInAt}: <span className="font-semibold text-foreground">{clockInTime}</span>
                </p>
              ) : clockOutTime ? (
                <p className="text-sm text-muted-foreground">
                  {t.clock.clockedOutAt}: <span className="font-semibold text-foreground">{clockOutTime}</span>
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">{t.clock.notClockedIn}</p>
              )}
            </div>

            {/* Big clock in/out button */}
            {!clockedIn ? (
              <button
                onClick={handleClockIn}
                disabled={geofenceDisabled}
                className={cn(
                  "w-36 h-36 rounded-full flex flex-col items-center justify-center gap-1 text-white font-bold text-lg shadow-lg transition-all hover-lift",
                  geofenceDisabled
                    ? "bg-muted text-muted-foreground cursor-not-allowed shadow-none"
                    : "bg-gradient-to-br from-emerald-500 to-emerald-700 hover:from-emerald-400 hover:to-emerald-600 active:scale-95"
                )}
              >
                <Clock className="w-8 h-8" />
                {t.clock.clockIn}
              </button>
            ) : (
              <button
                onClick={handleClockOut}
                className="w-36 h-36 rounded-full flex flex-col items-center justify-center gap-1 text-white font-bold text-lg shadow-lg bg-gradient-to-br from-red-500 to-red-700 hover:from-red-400 hover:to-red-600 active:scale-95 transition-all hover-lift"
              >
                <Clock className="w-8 h-8" />
                {t.clock.clockOut}
              </button>
            )}

            {/* Geofence warning when method is geofence and outside */}
            {geofenceDisabled && (
              <p className="text-xs text-red-500 font-medium flex items-center gap-1">
                <MapPinOff className="w-3.5 h-3.5" />
                {t.clock.geofenceRequired}
              </p>
            )}
          </div>

          {/* Right side: Method selector + Geofence indicator */}
          <div className="flex-1 space-y-5">
            {/* Method Selector */}
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-2">{t.clock.method}</p>
              <div className="flex gap-2">
                {methodOptions.map((opt) => {
                  const Icon = opt.icon;
                  const isActive = clockMethod === opt.key;
                  return (
                    <button
                      key={opt.key}
                      onClick={() => setClockMethod(opt.key)}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                        isActive
                          ? "bg-primary text-white"
                          : "bg-muted text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <Icon className="w-4 h-4" />
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Geofence Indicator */}
            <div className="glass-card rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium">{t.clock.officeLocation}</span>
                </div>
                <Badge
                  className={cn(
                    "text-[11px] font-medium border-0",
                    isInsideGeofence
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-400"
                      : "bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-400"
                  )}
                >
                  {isInsideGeofence ? t.clock.insideGeofence : t.clock.outsideGeofence}
                </Badge>
              </div>

              <div className="text-xs text-muted-foreground space-y-1">
                <p>{isAr ? geofenceConfig.officeNameAr : geofenceConfig.officeNameEn}</p>
                <p>
                  {t.clock.radius}: {geofenceConfig.radiusMeters} {t.clock.meters}
                </p>
              </div>

              {/* Demo toggle (fallback when real GPS is denied or unavailable) */}
              {geoChecked && (
                <button
                  onClick={() => setIsInsideGeofence((prev) => !prev)}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  {isInsideGeofence ? (
                    <ToggleRight className="w-5 h-5 text-emerald-500" />
                  ) : (
                    <ToggleLeft className="w-5 h-5 text-red-500" />
                  )}
                  {isAr ? "محاكاة تغيير الموقع" : "Simulate location change"}
                </button>
              )}
            </div>

            {/* Request Adjustment Button */}
            <Button
              variant="outline"
              size="lg"
              onClick={() => setAdjustDialogOpen(true)}
              className="w-full"
            >
              <FileEdit className="w-4 h-4" />
              {t.clock.requestAdjustment}
            </Button>
          </div>
        </div>
      </div>

      {/* ───── Summary Stats Row ───── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryCards.map((card, i) => {
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
                  <p className="text-2xl font-bold text-foreground">
                    {card.count}
                  </p>
                  <p className="text-sm text-muted-foreground truncate">
                    {card.label}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ───── Filter + Table ───── */}
      <div className="glass-card rounded-xl p-5 lg:p-6">
        {/* Filter Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            <h3 className="font-bold text-lg">{t.att.today}</h3>
          </div>

          {isAdmin && (
            <div className="flex items-center gap-2">
              <label className="text-sm text-muted-foreground whitespace-nowrap">
                {t.common.department}:
              </label>
              <select
                value={selectedDept}
                onChange={(e) => setSelectedDept(e.target.value)}
                className="h-9 rounded-lg border border-border bg-card px-3 text-sm outline-none"
              >
                <option value="all">{t.common.all}</option>
                {Object.entries(departments).map(([key, dept]) => (
                  <option key={key} value={key}>
                    {dept[lang]}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Attendance Table */}
        <div className="overflow-x-auto -mx-5 lg:-mx-6 px-5 lg:px-6">
          <table className="w-full min-w-[600px]">
            <thead>
              <tr className="text-xs text-muted-foreground border-b border-border">
                <th className="text-start pb-3 font-medium">
                  {t.att.employee}
                </th>
                <th className="text-start pb-3 font-medium">
                  {t.att.checkIn}
                </th>
                <th className="text-start pb-3 font-medium">
                  {t.att.checkOut}
                </th>
                <th className="text-start pb-3 font-medium">
                  {t.att.duration}
                </th>
                <th className="text-start pb-3 font-medium">
                  {t.common.status}
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.map((record) => {
                const emp = employees.find(
                  (e) => e.id === record.employeeId
                );
                if (!emp) return null;

                const name = isAr ? emp.nameAr : emp.nameEn;
                const deptName = departments[emp.department]?.[lang] ?? emp.department;
                const duration = calcDuration(record.checkIn, record.checkOut);

                return (
                  <tr
                    key={record.employeeId}
                    className="border-b border-border/50 last:border-0 hover:bg-accent/30 transition-colors"
                  >
                    {/* Employee */}
                    <td className="py-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar className="w-8 h-8">
                          <AvatarFallback
                            className={cn(
                              "text-white text-[10px] font-bold",
                              emp.color
                            )}
                          >
                            {emp.initials}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">
                            {name}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {deptName}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Check In */}
                    <td className="py-3 text-sm text-muted-foreground">
                      {record.checkIn ?? "-"}
                    </td>

                    {/* Check Out */}
                    <td className="py-3 text-sm text-muted-foreground">
                      {record.checkOut ?? "-"}
                    </td>

                    {/* Duration */}
                    <td className="py-3 text-sm text-muted-foreground">
                      {duration}
                    </td>

                    {/* Status */}
                    <td className="py-3">
                      <Badge
                        className={cn(
                          "text-[11px] font-medium",
                          statusStyles[record.status]
                        )}
                      >
                        {statusLabels[record.status]?.(t) ?? record.status}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Empty State */}
        {filteredRecords.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <CalendarOff className="w-10 h-10 mb-3 opacity-40" />
            <p className="text-sm">{t.common.noData}</p>
          </div>
        )}
      </div>

      {/* ───── Penalty Rules ───── */}
      <div className="glass-card rounded-xl p-5 lg:p-6">
        <div className="flex items-center gap-2 mb-4">
          <ShieldAlert className="w-5 h-5 text-primary" />
          <h3 className="font-bold text-lg">{t.penalty.rules}</h3>
        </div>

        <div className="overflow-x-auto -mx-5 lg:-mx-6 px-5 lg:px-6">
          <table className="w-full min-w-[400px]">
            <thead>
              <tr className="text-xs text-muted-foreground border-b border-border">
                <th className="text-start pb-3 font-medium">
                  {t.penalty.condition}
                </th>
                <th className="text-start pb-3 font-medium">
                  {t.penalty.deduction}
                </th>
              </tr>
            </thead>
            <tbody>
              {penaltyRules.map((rule) => (
                <tr
                  key={rule.id}
                  className="border-b border-border/50 last:border-0 hover:bg-accent/30 transition-colors"
                >
                  <td className="py-2.5 text-sm">
                    {isAr ? rule.conditionAr : rule.conditionEn}
                  </td>
                  <td className="py-2.5 text-sm text-muted-foreground">
                    {isAr ? rule.deductionAr : rule.deductionEn}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center gap-1.5 mt-4 text-xs text-muted-foreground">
          <Info className="w-3.5 h-3.5" />
          <span>{t.penalty.autoCalculated}</span>
        </div>
      </div>

      {/* ───── Attendance Adjustment Dialog ───── */}
      <Dialog open={adjustDialogOpen} onOpenChange={setAdjustDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t.clock.requestAdjustment}</DialogTitle>
            <DialogDescription>
              {isAr
                ? "قم بتعبئة البيانات لطلب تعديل سجل الحضور"
                : "Fill in the details to request an attendance adjustment"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Date */}
            <div>
              <label className="text-sm font-medium text-foreground block mb-1">
                {t.common.date}
              </label>
              <input
                type="date"
                value={adjDate}
                onChange={(e) => setAdjDate(e.target.value)}
                className="h-9 w-full rounded-lg border border-border bg-card px-3 text-sm outline-none"
              />
            </div>

            {/* Original / Requested Check-in */}
            <div className="grid grid-cols-2 gap-3">
              <TimePicker
                label={`${t.clock.originalTime} (${t.att.checkIn})`}
                value={adjOriginalIn}
                onChange={setAdjOriginalIn}
                isAr={isAr}
              />
              <TimePicker
                label={`${t.clock.requestedTime} (${t.att.checkIn})`}
                value={adjRequestedIn}
                onChange={setAdjRequestedIn}
                isAr={isAr}
              />
            </div>

            {/* Original / Requested Check-out */}
            <div className="grid grid-cols-2 gap-3">
              <TimePicker
                label={`${t.clock.originalTime} (${t.att.checkOut})`}
                value={adjOriginalOut}
                onChange={setAdjOriginalOut}
                isAr={isAr}
              />
              <TimePicker
                label={`${t.clock.requestedTime} (${t.att.checkOut})`}
                value={adjRequestedOut}
                onChange={setAdjRequestedOut}
                isAr={isAr}
              />
            </div>

            {/* Reason */}
            <div>
              <label className="text-sm font-medium text-foreground block mb-1">
                {t.clock.adjustmentReason}
              </label>
              <textarea
                value={adjReason}
                onChange={(e) => setAdjReason(e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none resize-none"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustDialogOpen(false)}>
              {t.common.cancel}
            </Button>
            <Button onClick={handleAdjustmentSubmit}>
              {t.common.submit}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
