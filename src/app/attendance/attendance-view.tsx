"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useLanguage, useAuth } from "@/components/providers";
import { useData, haversineDistance } from "@/lib/data-store";
import {
  calcDuration,
  geofenceConfig,
  penaltyRules,
  earlyDepartureRules,
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
import { Icon } from "@/components/ui/icon";
import { cn, getKSAHour, getKSADateString, getKSATimeString, formatDate } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { useDataHydration } from "@/lib/hooks/use-data-hydration";
import type { AttendanceSlice, AttRecord } from "@/lib/data/server";

// ─── Helpers ──────────────────────────────────────────────────────────

function isBeforeCheckinTime(): boolean {
  return getKSAHour() < 6;
}

// ─── 12-hour Time Picker ──────────────────────────────────────────────

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);

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

function TimeDropdown({
  items,
  selected,
  onSelect,
  open,
  onToggle,
}: {
  items: number[];
  selected: number;
  onSelect: (v: number) => void;
  open: boolean;
  onToggle: () => void;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) onToggle();
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open, onToggle]);

  useEffect(() => {
    if (open && listRef.current) {
      const idx = items.indexOf(selected);
      if (idx >= 0) listRef.current.scrollTop = idx * 32 - 48;
    }
  }, [open, selected, items]);

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "h-10 w-full rounded-xl bg-surface-container-high px-2 text-sm font-bold tabular-nums text-center transition-all cursor-pointer",
          open ? "ring-2 ring-primary/50 shadow-primary-glow bg-surface-container-lowest" : "hover:bg-surface-container-highest"
        )}
      >
        {String(selected).padStart(2, "0")}
      </button>
      {open && (
        <div
          ref={listRef}
          className="absolute z-50 mt-1 w-full max-h-[160px] overflow-y-auto rounded-xl bg-surface-container-lowest shadow-xl"
          style={{ scrollbarWidth: "thin" }}
        >
          {items.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => { onSelect(v); onToggle(); }}
              className={cn(
                "w-full h-8 text-center text-sm tabular-nums transition-colors cursor-pointer",
                v === selected
                  ? "bg-primary-container/40 text-primary font-bold"
                  : "text-on-surface hover:bg-surface-container-low"
              )}
            >
              {String(v).padStart(2, "0")}
            </button>
          ))}
        </div>
      )}
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
  const [openField, setOpenField] = useState<"hour" | "minute" | null>(null);

  useEffect(() => {
    const p = to12h(value);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHour(p.hour);
    setMinute(p.minute);
    setPeriod(p.period);
  }, [value]);

  const emit = (h: number, m: number, p: "AM" | "PM") => onChange(to24h(h, m, p));

  const amLabel = isAr ? "ص" : "AM";
  const pmLabel = isAr ? "م" : "PM";

  return (
    <div>
      <label className="text-xs font-bold text-on-surface-variant block mb-1.5 text-center">{label}</label>
      <div className="flex items-center justify-center gap-1.5" dir="ltr">
        <div className="w-12">
          <TimeDropdown
            items={HOURS}
            selected={hour}
            onSelect={(h) => { setHour(h); emit(h, minute, period); }}
            open={openField === "hour"}
            onToggle={() => setOpenField(openField === "hour" ? null : "hour")}
          />
        </div>
        <span className="text-base font-bold text-on-surface-variant">:</span>
        <div className="w-12">
          <TimeDropdown
            items={MINUTES}
            selected={minute}
            onSelect={(m) => { setMinute(m); emit(hour, m, period); }}
            open={openField === "minute"}
            onToggle={() => setOpenField(openField === "minute" ? null : "minute")}
          />
        </div>
        <button
          type="button"
          onClick={() => {
            const next = period === "AM" ? "PM" : "AM";
            setPeriod(next);
            emit(hour, minute, next);
          }}
          className={cn(
            "h-10 px-3 rounded-xl text-xs font-bold transition-colors cursor-pointer",
            period === "AM"
              ? "bg-primary-container/40 text-primary"
              : "bg-tertiary-container/40 text-tertiary"
          )}
        >
          {period === "AM" ? amLabel : pmLabel}
        </button>
      </div>
    </div>
  );
}

const statusBadgeVariant: Record<string, "success" | "destructive" | "warning" | "info" | "secondary"> = {
  present: "success",
  absent: "destructive",
  late: "warning",
  "on-leave": "info",
  "half-day": "secondary",
};

const statusLabelFn: Record<string, (t: ReturnType<typeof useLanguage>["t"]) => string> = {
  present: (t) => t.att.present,
  absent: (t) => t.att.absent,
  late: (t) => t.att.late,
  "on-leave": (t) => t.att.onLeave,
  "half-day": (t) => t.att.halfDay,
};

export function AttendanceView({ initialSlice }: { initialSlice: AttendanceSlice }) {
  useDataHydration({
    todayAttendance: initialSlice.todayAttendance,
    employees: initialSlice.employees,
    attendanceAdjustments: initialSlice.attendanceAdjustments,
  });
  const { t, lang } = useLanguage();
	  const { isAdmin, user } = useAuth();
	  const store = useData();
	  const { initialLoaded } = store;
  const employees = store.employees;
  const departments = store.departments;
  const isAr = lang === "ar";
  const [selectedDept, setSelectedDept] = useState("all");
  // Overview vs Tracking — admin-only toggle. Default Overview for KPI bird's-eye.
  const [adminTab, setAdminTab] = useState<"overview" | "tracking">("overview");

  // Roster date picker — admin can browse attendance for any past day.
  // When rosterDate === today, the roster panel reuses store.todayAttendance
  // (already kept fresh by DataProvider). For any other date, fetch directly
  // from Supabase into rosterRecords. KPI tiles deliberately stay bound to
  // store.todayAttendance so they always reflect the actual current day.
  const todayDateStr = getKSADateString();
  const [rosterDate, setRosterDate] = useState<string>(todayDateStr);
  const [rosterRecords, setRosterRecords] = useState<AttRecord[]>([]);
  const [rosterLoading, setRosterLoading] = useState(false);

  const currentUserId = isAdmin ? null : user.id;
  const existingRecord = currentUserId
    ? store.todayAttendance.find((a) => a.employeeId === currentUserId)
    : null;

  const [clockedIn, setClockedIn] = useState(() => !!existingRecord?.checkIn && !existingRecord?.checkOut);
  const [clockInTime, setClockInTime] = useState<string | null>(() => existingRecord?.checkIn ?? null);
  const [clockOutTime, setClockOutTime] = useState<string | null>(() => existingRecord?.checkOut ?? null);

  useEffect(() => {
    if (!currentUserId) return;
    const record = store.todayAttendance.find((a) => a.employeeId === currentUserId);
    if (record) {
      setClockedIn(!!record.checkIn && !record.checkOut);
      setClockInTime(record.checkIn ?? null);
      setClockOutTime(record.checkOut ?? null);
    }
  }, [currentUserId, store.todayAttendance]);

  const [isInsideGeofence, setIsInsideGeofence] = useState(true);
  const [locationRequired, setLocationRequired] = useState(initialSlice.locationRequired);
  const [locationLoaded, setLocationLoaded] = useState(false);
  const [geolocationDenied, setGeolocationDenied] = useState(false);

  const fetchFreshLocationRequired = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) {
        setLocationRequired(true);
        return true;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("location_required")
        .eq("id", session.user.id)
        .maybeSingle();

      if (error) {
        console.error("[attendance] location_required fetch failed:", error.message);
        setLocationRequired(true);
        return true;
      }

      const required = data?.location_required ?? true;
      setLocationRequired(required);
      return required;
    } catch (err) {
      console.error("[attendance] location_required fetch threw:", err);
      setLocationRequired(true);
      return true;
    } finally {
      setLocationLoaded(true);
    }
  }, []);

  useEffect(() => {
    void fetchFreshLocationRequired();
  }, [fetchFreshLocationRequired]);

  useEffect(() => {
    if (!locationLoaded || !locationRequired) return;
    if (!navigator.geolocation) {
      setGeolocationDenied(true);
      setIsInsideGeofence(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeolocationDenied(false);
        const dist = haversineDistance(
          pos.coords.latitude,
          pos.coords.longitude,
          geofenceConfig.officeLat,
          geofenceConfig.officeLng
        );
        setIsInsideGeofence(dist <= geofenceConfig.radiusMeters);
      },
      () => {
        setGeolocationDenied(true);
        setIsInsideGeofence(false);
      }
    );
  }, [locationLoaded, locationRequired]);

  const [adjustDialogOpen, setAdjustDialogOpen] = useState(false);
  const [adjDate, setAdjDate] = useState("");
  const [adjOriginalIn, setAdjOriginalIn] = useState("");
  const [adjRequestedIn, setAdjRequestedIn] = useState("");
  const [adjOriginalOut, setAdjOriginalOut] = useState("");
  const [adjRequestedOut, setAdjRequestedOut] = useState("");
  const [adjReason, setAdjReason] = useState("");

  const getCurrentTime = () => {
    return getKSATimeString();
  };

  const [tooEarly, setTooEarly] = useState(isBeforeCheckinTime());
  useEffect(() => {
    const id = setInterval(() => setTooEarly(isBeforeCheckinTime()), 30000);
    return () => clearInterval(id);
  }, []);

  const [checkoutOutside, setCheckoutOutside] = useState(false);
  const [checkoutLocationLoading, setCheckoutLocationLoading] = useState(false);

  const [reportOpen, setReportOpen] = useState(false);
  const [reportText, setReportText] = useState("");
  const [reportFiles, setReportFiles] = useState<File[]>([]);
  const [reportUploading, setReportUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const rosterDateInputRef = useRef<HTMLInputElement>(null);

  // Programmatically open the native date picker. The browser's own
  // calendar-picker-indicator is hidden via CSS so we need to trigger
  // showPicker() ourselves on any click within the pill. Wrapped in a
  // try/catch because showPicker() throws InvalidStateError if invoked
  // without user activation, and is undefined on older browsers — in
  // both cases we degrade gracefully to focus().
  const openRosterDatePicker = () => {
    const input = rosterDateInputRef.current;
    if (!input) return;
    if (typeof input.showPicker === "function") {
      try {
        input.showPicker();
        return;
      } catch {
        /* fall through to focus() */
      }
    }
    input.focus();
  };

  // Fetch attendance for a non-today date when the admin browses backwards.
  // On today: the effect early-returns (no fetch, no state mutation) and the
  // UI falls back to store.todayAttendance via the `visibleRoster` derivation.
  // Stale rosterRecords from a previous date are simply ignored while on today.
  useEffect(() => {
    if (!isAdmin) return;
    if (rosterDate === todayDateStr) return;
    let cancelled = false;
    (async () => {
      setRosterLoading(true);
      const { data } = await supabase
        .from("attendance")
        .select("*")
        .eq("date", rosterDate)
        .order("created_at", { ascending: false });
      if (cancelled) return;
      setRosterLoading(false);
      if (!data) {
        setRosterRecords([]);
        return;
      }
      const mapped: AttRecord[] = data.map((r: Record<string, unknown>) => ({
        id: r.id as string,
        employeeId: r.employee_id as string,
        date: r.date as string,
        checkIn: r.check_in ? String(r.check_in).slice(0, 5) : null,
        checkOut: r.check_out ? String(r.check_out).slice(0, 5) : null,
        status: ((r.status as string) || "present") as AttRecord["status"],
      }));
      setRosterRecords(mapped);
    })();
    return () => {
      cancelled = true;
    };
  }, [rosterDate, isAdmin, todayDateStr]);

  const handleClockIn = async () => {
    if (tooEarly) return;
    const freshLocationRequired = await fetchFreshLocationRequired();
    if (freshLocationRequired && !isInsideGeofence) return;
    const time = getCurrentTime();
    setClockedIn(true);
    setClockInTime(time);
    setClockOutTime(null);
    await store.clockIn(time);
  };

  const handleClockOut = async () => {
    const freshLocationRequired = await fetchFreshLocationRequired();
    if (freshLocationRequired && navigator.geolocation) {
      setCheckoutLocationLoading(true);
      setCheckoutOutside(false);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const dist = haversineDistance(
            pos.coords.latitude, pos.coords.longitude,
            geofenceConfig.officeLat, geofenceConfig.officeLng
          );
          const outside = dist > geofenceConfig.radiusMeters;
          setCheckoutOutside(outside);
          setCheckoutLocationLoading(false);
          if (!outside) setReportOpen(true);
        },
        () => {
          setCheckoutOutside(true);
          setCheckoutLocationLoading(false);
        }
      );
    } else {
      setCheckoutOutside(false);
      setReportOpen(true);
    }
  };

  const handleSubmitReport = async () => {
    if (!reportText.trim()) return;
    setReportUploading(true);

    const time = getCurrentTime();
    const today = getKSADateString();
    const attachments: { name: string; url: string; type: string }[] = [];

    if (currentUserId && reportFiles.length > 0) {
      for (const file of reportFiles) {
        const path = `${currentUserId}/${today}/${file.name}`;
        const { data } = await supabase.storage
          .from("daily-reports")
          .upload(path, file, { upsert: true });
        if (data) {
          attachments.push({ name: file.name, url: data.path, type: file.type });
        }
      }
    }

    if (currentUserId) {
      await supabase.from("daily_reports").upsert({
        user_id: currentUserId,
        report_date: today,
        content: reportText,
        attachments,
      }, { onConflict: "user_id,report_date" });
    }

    setClockedIn(false);
    setClockOutTime(time);
    await store.clockOut(time);

    setReportOpen(false);
    setReportText("");
    setReportFiles([]);
    setReportUploading(false);
    setCheckoutOutside(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const valid = files.filter((f) => f.size <= 10 * 1024 * 1024);
    setReportFiles((prev) => [...prev, ...valid].slice(0, 5));
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeFile = (index: number) => {
    setReportFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAdjustmentSubmit = async () => {
    await store.submitAdjustment({
      employeeId: currentUserId || user.id,
      date: adjDate,
      originalIn: adjOriginalIn,
      requestedIn: adjRequestedIn,
      originalOut: adjOriginalOut,
      requestedOut: adjRequestedOut,
      reasonAr: adjReason,
      reasonEn: adjReason,
      status: "pending",
    });
    setAdjustDialogOpen(false);
    setAdjDate("");
    setAdjOriginalIn("");
    setAdjRequestedIn("");
    setAdjOriginalOut("");
    setAdjRequestedOut("");
    setAdjReason("");
  };

  const filteredRecords = store.todayAttendance.filter((record) => {
    if (!isAdmin) return record.employeeId === currentUserId;
    if (selectedDept === "all") return true;
    const emp = employees.find((e) => e.id === record.employeeId);
    return emp?.department === selectedDept;
  });

  const presentCount = filteredRecords.filter((r) => r.status === "present").length;
  const absentCount = filteredRecords.filter((r) => r.status === "absent").length;
  const lateCount = filteredRecords.filter((r) => r.status === "late").length;
  const onLeaveCount = filteredRecords.filter((r) => r.status === "on-leave").length;

  const summaryCards = [
    { iconName: "how_to_reg", label: t.att.present, count: presentCount, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/15" },
    { iconName: "person_off", label: t.att.absent, count: absentCount, color: "text-md-error", bg: "bg-error-container/20" },
    { iconName: "schedule", label: t.att.late, count: lateCount, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/15" },
    { iconName: "event_busy", label: t.att.onLeave, count: onLeaveCount, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-500/15" },
  ];

  // ── Overview KPIs (admin only) ──
  const totalEmployees = employees.length;
  // Employees scheduled today but have no attendance record at all = unscheduled / no-show
  const unscheduledCount = Math.max(
    0,
    totalEmployees - store.todayAttendance.length - onLeaveCount
  );

  // ── Roster panel data source (admin only) ──
  // On today: reuse the live store. On any other day: use the fetched snapshot.
  const isTodayRoster = rosterDate === todayDateStr;
  const visibleRoster: AttRecord[] = isTodayRoster ? store.todayAttendance : rosterRecords;
  const visiblePresentCount = visibleRoster.filter((r) => r.checkIn).length;
  // Mask a stale `rosterLoading=true` flag that may linger when the user
  // switches back to today before a prior fetch resolves.
  const showRosterLoading = !isTodayRoster && rosterLoading;
  // Cross-feature pending counters
  const pendingAdjustments = store.attendanceAdjustments.filter((a) => a.status === "pending").length;
  const pendingLeaveRequests = store.leaveRequests.filter((r) => r.status === "pending").length;
  const pendingEmployeeRequests = store.employeeRequests.filter((r) => r.status === "pending").length;
  const totalPendingRequests = pendingAdjustments + pendingLeaveRequests + pendingEmployeeRequests;
  const totalPendingActions = pendingAdjustments; // attendance-specific actions awaiting admin
  const readyForPayroll = store.salaryAdvances.filter((a) => a.status === "approved" && a.remainingBalance > 0).length;

  const geofenceDisabled = locationRequired && !isInsideGeofence;

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-8">
      {/* Page Header */}
      <div>
        <h1 className="font-headline text-3xl md:text-4xl font-extrabold text-on-surface tracking-tight">
          {t.att.title}
        </h1>
        <p className="text-sm text-on-surface-variant mt-2">{t.att.today}</p>
      </div>

      {/* Admin tabs (Overview / Tracking) — employees see only their own clock UI */}
      {isAdmin && (
        <div className="inline-flex items-center bg-surface-container rounded-full p-1">
          <button
            onClick={() => setAdminTab("overview")}
            className={cn(
              "px-5 py-2 rounded-full text-sm font-bold transition-all",
              adminTab === "overview"
                ? "gradient-btn shadow-primary-glow"
                : "text-on-surface-variant hover:text-on-surface"
            )}
          >
            {isAr ? "نظرة عامة" : "Overview"}
          </button>
          <button
            onClick={() => setAdminTab("tracking")}
            className={cn(
              "px-5 py-2 rounded-full text-sm font-bold transition-all",
              adminTab === "tracking"
                ? "gradient-btn shadow-primary-glow"
                : "text-on-surface-variant hover:text-on-surface"
            )}
          >
            {isAr ? "تتبّع تفصيلي" : "Tracking"}
          </button>
        </div>
      )}

      {/* ── Admin Overview ─────────────────────────────── */}
      {isAdmin && adminTab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main KPIs (left two-thirds) */}
          <div className="lg:col-span-2 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { iconName: "person_off", label: isAr ? "غياب" : "Absence", count: absentCount, sub: isAr ? "موظف" : "employees", color: "text-md-error", bg: "bg-error-container/20" },
                { iconName: "schedule", label: isAr ? "تأخّر" : "Late", count: lateCount, sub: isAr ? "موظف" : "employees", color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/15" },
                { iconName: "event_busy", label: isAr ? "غير مجدول" : "Unscheduled", count: unscheduledCount, sub: isAr ? "موظف" : "employees", color: "text-on-surface-variant", bg: "bg-surface-container-high" },
              ].map((c, i) => (
                <div
                  key={i}
                  className="bg-surface-container-lowest p-5 rounded-2xl shadow-sm border border-outline-variant/40 flex flex-col gap-4"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-on-surface-variant whitespace-nowrap">
                      {c.label}
                    </span>
                    <div
                      className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                        c.bg,
                        c.color
                      )}
                    >
                      <Icon name={c.iconName} size={20} fill />
                    </div>
                  </div>
	                  <div className="flex items-baseline gap-2">
	                    <span className="font-headline text-4xl font-black text-on-surface tabular-nums leading-none">
	                      {initialLoaded ? (
	                        c.count
	                      ) : (
	                        <span className="inline-block h-9 w-14 rounded-lg bg-surface-container-highest animate-pulse align-middle" />
	                      )}
	                    </span>
                    <span className="text-xs text-on-surface-variant/70 font-medium">
                      {c.sub}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Pending counters bar */}
            <div className="bg-surface-container-lowest rounded-2xl shadow-sm p-2">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-1">
                <a href="/requests?status=pending" className="px-5 py-3 rounded-xl hover:bg-surface-container-low transition-colors flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-on-surface-variant">
                    {isAr ? "طلبات معلّقة" : "Pending requests"}
                  </span>
                  <span className="font-headline text-lg font-black text-on-surface tabular-nums bg-amber-500/15 text-amber-600 dark:text-amber-400 rounded-full min-w-[28px] h-7 inline-flex items-center justify-center px-2">
                    {totalPendingRequests}
                  </span>
                </a>
                <a href="/requests?status=pending&type=attendanceAdjust" className="px-5 py-3 rounded-xl hover:bg-surface-container-low transition-colors flex items-center justify-between gap-2 border-x border-outline-variant/10">
                  <span className="text-sm font-medium text-on-surface-variant">
                    {isAr ? "إجراءات معلّقة" : "Pending actions"}
                  </span>
                  <span className="font-headline text-lg font-black text-on-surface tabular-nums bg-blue-500/15 text-blue-600 dark:text-blue-400 rounded-full min-w-[28px] h-7 inline-flex items-center justify-center px-2">
                    {totalPendingActions}
                  </span>
                </a>
                <a href="/payroll" className="px-5 py-3 rounded-xl hover:bg-surface-container-low transition-colors flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-on-surface-variant">
                    {isAr ? "جاهز للرواتب" : "Ready for payroll"}
                  </span>
                  <span className="font-headline text-lg font-black text-on-surface tabular-nums bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 rounded-full min-w-[28px] h-7 inline-flex items-center justify-center px-2">
                    {readyForPayroll}
                  </span>
                </a>
              </div>
            </div>

            {/* Attendance Roster — admin can browse any past day via the date picker */}
            <div className="bg-surface-container-lowest rounded-2xl shadow-sm overflow-hidden">
              {/* Top row: section icon + title + present/total tally.
                  Header icon intentionally non-calendar (groups) so it does
                  not visually compete with the date picker's calendar icon. */}
              <div className="flex items-center justify-between px-5 py-4">
                <div className="flex items-center gap-2">
                  <Icon name="groups" size={18} className="text-primary" />
                  <h3 className="font-headline font-bold text-base">
                    {isAr ? "سجلّ الحضور" : "Attendance Roster"}
                  </h3>
                </div>
                <span className="text-xs text-on-surface-variant tabular-nums">
                  {visiblePresentCount}/{employees.length} {isAr ? "حاضر" : "present"}
                </span>
              </div>
              {/* Toolbar row: single clean date-picker pill on the start,
                  human-readable day on the end. Native browser indicator is
                  suppressed via the .njd-date-input CSS class so only ONE
                  calendar icon is visible. Clicking anywhere on the <label>
                  pill opens the native picker. */}
              <div className="flex items-center justify-between gap-3 px-5 pb-3 border-b border-outline-variant/10 flex-wrap">
                <div className="flex items-center gap-2">
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={openRosterDatePicker}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        openRosterDatePicker();
                      }
                    }}
                    className="flex items-center gap-2 bg-surface-container-high rounded-xl px-3 py-2 cursor-pointer hover:bg-surface-container-highest transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40"
                  >
                    <Icon name="calendar_today" size={16} className="text-primary" />
                    <input
                      ref={rosterDateInputRef}
                      type="date"
                      value={rosterDate}
                      max={todayDateStr}
                      onChange={(e) => setRosterDate(e.target.value || todayDateStr)}
                      onClick={(e) => e.stopPropagation()}
                      className="njd-date-input bg-transparent text-sm font-medium outline-none cursor-pointer tabular-nums"
                    />
                  </div>
                  {!isTodayRoster && (
                    <button
                      type="button"
                      onClick={() => setRosterDate(todayDateStr)}
                      className="text-xs font-bold text-primary hover:underline"
                    >
                      {isAr ? "اليوم" : "Today"}
                    </button>
                  )}
                </div>
                <span className="text-xs text-on-surface-variant">
                  {isTodayRoster
                    ? isAr ? "تعرض بيانات اليوم" : "Showing today"
                    : formatDate(rosterDate, lang, {
                        weekday: "long",
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                </span>
              </div>
              {showRosterLoading ? (
                <div className="py-12 text-center text-sm text-on-surface-variant">
                  <Icon name="hourglass_empty" size={28} className="opacity-50 mb-2 inline-block animate-pulse" />
                  <p className="font-medium">{isAr ? "جارٍ التحميل…" : "Loading…"}</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[520px]">
                    <thead>
                      <tr className="bg-surface-container/30">
                        <th className="text-start px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                          {t.att.employee}
                        </th>
                        <th className="text-start px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                          {t.att.checkIn}
                        </th>
                        <th className="text-start px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                          {t.att.checkOut}
                        </th>
                        <th className="text-start px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                          {t.common.status}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {employees.map((emp) => {
                        const record = visibleRoster.find((a) => a.employeeId === emp.id);
                        const status = record?.status ?? "absent";
                        const dept = departments[emp.department];
                        return (
                          <tr key={emp.id} className="hover:bg-surface-container-low transition-colors">
                            <td className="px-5 py-3">
                              <div className="flex items-center gap-3">
                                <Avatar className="w-8 h-8">
                                  <AvatarFallback className={cn("text-white text-[10px] font-bold", emp.color)}>
                                    {emp.initials}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="min-w-0">
                                  <p className="text-sm font-bold truncate">
                                    {isAr ? emp.nameAr : emp.nameEn}
                                  </p>
                                  {dept && (
                                    <p className="text-[10px] text-on-surface-variant truncate">
                                      {isAr ? dept.ar : dept.en}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-5 py-3 text-sm text-on-surface-variant tabular-nums font-medium">
                              {record?.checkIn ?? "—"}
                            </td>
                            <td className="px-5 py-3 text-sm text-on-surface-variant tabular-nums font-medium">
                              {record?.checkOut ?? "—"}
                            </td>
                            <td className="px-5 py-3">
                              {record ? (
                                <Badge variant={statusBadgeVariant[status] ?? "secondary"}>
                                  {statusLabelFn[status]?.(t) ?? status}
                                </Badge>
                              ) : (
                                <Badge variant="warning">
                                  {isAr ? "لم يسجّل" : "Not checked in"}
                                </Badge>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                      {employees.length === 0 && (
                        <tr>
                          <td colSpan={4} className="py-12 text-center text-on-surface-variant">
                            <Icon name="event_busy" size={36} className="opacity-40 mb-2" />
                            <p className="text-sm font-medium">{t.common.noData}</p>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>{/* /lg:col-span-2 */}

          {/* Policies sidebar (right third) */}
          <div className="bg-surface-container-lowest rounded-2xl shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <Icon name="gavel" size={20} className="text-primary" />
              <h3 className="font-headline font-bold text-base">{isAr ? "السياسات" : "Policies"}</h3>
            </div>
            <ul className="space-y-2">
              {[
                { icon: "schedule", label: isAr ? "سياسة العمل الإضافي" : "Overtime Policy", href: "/settings#penalties" },
                { icon: "task_alt", label: isAr ? "الأعذار" : "Excuses", href: "/requests?type=permission" },
                { icon: "money_off", label: isAr ? "إعفاءات الخصم" : "Deduction exemptions", href: "/settings#penalties" },
                { icon: "rule", label: isAr ? "قواعد الجزاءات" : "Penalty rules", href: "/settings#penalties" },
              ].map((p, i) => (
                <li key={i}>
                  <a
                    href={p.href}
                    className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl hover:bg-surface-container-low transition-colors text-sm group"
                  >
                    <span className="flex items-center gap-2 text-on-surface font-medium">
                      <Icon name={p.icon} size={16} className="text-on-surface-variant" />
                      {p.label}
                    </span>
                    <Icon
                      name={isAr ? "arrow_back" : "arrow_forward"}
                      size={14}
                      className="text-on-surface-variant opacity-0 group-hover:opacity-100 transition-opacity"
                    />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* ── Tracking-only sections (clock + table + penalty rules) ─── */}
      {(!isAdmin || adminTab === "tracking") && (
      <div className="space-y-8">
      {/* ── Clock In/Out Panel ─────────────────────────── */}
      <div className="bg-surface-container-lowest rounded-2xl p-6 lg:p-8 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center gap-8">
          {/* Clock Button Area */}
          <div className="flex-1 flex flex-col items-center gap-4">
            <div className="flex items-center gap-2 mb-1">
              <Icon name="schedule" size={22} className="text-primary" />
              <h3 className="font-headline font-bold text-lg">
                {clockOutTime && !clockedIn ? t.clock.alreadyCheckedOut : clockedIn ? t.clock.clockOut : t.clock.clockIn}
              </h3>
            </div>

            {/* Status text */}
            <div className="text-center min-h-[44px]">
              {clockOutTime && !clockedIn ? (
                <p className="text-sm text-on-surface-variant">
                  {t.clock.clockedInAt}: <span className="font-bold text-on-surface tabular-nums">{clockInTime}</span>
                  {" — "}
                  {t.clock.clockedOutAt}: <span className="font-bold text-on-surface tabular-nums">{clockOutTime}</span>
                </p>
              ) : clockedIn && clockInTime ? (
                <p className="text-sm text-on-surface-variant">
                  {t.clock.clockedInAt}: <span className="font-bold text-on-surface tabular-nums">{clockInTime}</span>
                </p>
              ) : (
                <p className="text-sm text-on-surface-variant">{t.clock.notClockedIn}</p>
              )}
            </div>

            {/* Big clock button (3 states) */}
            {clockOutTime && !clockedIn ? (
              <div className="flex flex-col items-center gap-3">
                <div className="w-40 h-40 rounded-full flex flex-col items-center justify-center gap-1 font-bold text-sm leading-tight text-center bg-surface-container-high text-on-surface-variant cursor-not-allowed px-3">
                  <Icon name="check_circle" size={36} fill />
                  {t.clock.alreadyCheckedOut}
                </div>
                <p className="text-xs text-on-surface-variant text-center max-w-[300px]">
                  {t.clock.alreadyCheckedOutDesc}
                </p>
              </div>
            ) : !clockedIn ? (
              <button
                onClick={handleClockIn}
                disabled={geofenceDisabled || tooEarly}
                className={cn(
                  "w-40 h-40 rounded-full flex flex-col items-center justify-center gap-1.5 font-bold text-lg transition-all duration-300 active:scale-95",
                  (geofenceDisabled || tooEarly)
                    ? "bg-surface-container-high text-on-surface-variant cursor-not-allowed"
                    : "bg-gradient-to-br from-emerald-500 to-emerald-700 text-white shadow-xl shadow-emerald-500/40 hover:shadow-2xl hover:shadow-emerald-500/50 hover:-translate-y-1"
                )}
              >
                <Icon name="schedule" size={36} fill />
                {t.clock.clockIn}
              </button>
            ) : (
              <button
                onClick={handleClockOut}
                disabled={checkoutLocationLoading}
                className={cn(
                  "w-40 h-40 rounded-full flex flex-col items-center justify-center gap-1.5 font-bold text-lg transition-all duration-300 active:scale-95",
                  checkoutLocationLoading
                    ? "bg-surface-container-high text-on-surface-variant cursor-not-allowed"
                    : "bg-gradient-to-br from-rose-500 to-red-700 text-white shadow-xl shadow-rose-500/40 hover:shadow-2xl hover:shadow-rose-500/50 hover:-translate-y-1"
                )}
              >
                {checkoutLocationLoading ? (
                  <Icon name="progress_activity" size={36} className="animate-spin" />
                ) : (
                  <Icon name="logout" size={36} fill />
                )}
                {checkoutLocationLoading ? t.clock.verifyingLocation : t.clock.clockOut}
              </button>
            )}

            {tooEarly && (
              <p className="text-xs text-md-error font-bold flex items-center gap-1">
                <Icon name="schedule" size={14} />
                {isAr ? "وقت تسجيل الحضور يبدأ من الساعة 6:00 صباحاً" : "Check-in starts at 6:00 AM"}
              </p>
            )}
            {!tooEarly && !clockedIn && geofenceDisabled && (
              <p className="text-xs text-md-error font-bold flex items-center gap-1">
                <Icon name="location_off" size={14} />
                {t.clock.geofenceRequired}
              </p>
            )}
            {clockedIn && checkoutOutside && (
              <p className="text-xs text-md-error font-bold flex items-center gap-1">
                <Icon name="location_off" size={14} />
                {t.clock.geofenceRequired}
              </p>
            )}
            {locationRequired && geolocationDenied && (
              <p className="text-xs text-amber-600 dark:text-amber-400 font-bold flex items-center gap-1.5 max-w-[300px] text-center" role="alert">
                <Icon name="warning" size={14} fill />
                {isAr
                  ? "تم رفض إذن الموقع. السماح بالوصول للموقع مطلوب لتسجيل الحضور — تواصل مع المسؤول إذا كنت موظف عن بُعد."
                  : "Location permission denied. Location access is required to clock in — contact your administrator if you work remotely."}
              </p>
            )}
          </div>

          {/* Right side: Method + Geofence + Adjustment */}
          <div className="flex-1 space-y-5">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2">
                {t.clock.method}
              </p>
              <div className="flex gap-2">
                <div className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold gradient-btn shadow-primary-glow">
                  <Icon name="my_location" size={18} />
                  {t.clock.geofence}
                </div>
              </div>
            </div>

            {locationRequired && (
              <div className="bg-surface-container-low rounded-2xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon name="my_location" size={18} className="text-primary" />
                    <span className="text-sm font-bold">{t.clock.officeLocation}</span>
                  </div>
                  <Badge variant={isInsideGeofence ? "success" : "destructive"}>
                    {isInsideGeofence ? t.clock.insideGeofence : t.clock.outsideGeofence}
                  </Badge>
                </div>
                <div className="text-xs text-on-surface-variant space-y-1">
                  <p className="font-medium">{isAr ? geofenceConfig.officeNameAr : geofenceConfig.officeNameEn}</p>
                  <p>
                    {t.clock.radius}: {geofenceConfig.radiusMeters >= 1000 ? `${geofenceConfig.radiusMeters / 1000} ${isAr ? "كم" : "km"}` : `${geofenceConfig.radiusMeters} ${t.clock.meters}`}
                  </p>
                </div>
              </div>
            )}

            <Button
              variant="outline"
              size="lg"
              onClick={() => setAdjustDialogOpen(true)}
              className="w-full"
            >
              <Icon name="edit_note" size={20} />
              {t.clock.requestAdjustment}
            </Button>
          </div>
        </div>
      </div>

      {/* ── Summary Stats ─────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {summaryCards.map((card, i) => (
          <div
            key={i}
            className="bg-surface-container-lowest p-5 rounded-2xl shadow-sm hover:shadow-primary-glow-lg transition-all duration-500 group"
          >
            <div className="flex items-center gap-3">
              <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform", card.bg, card.color)}>
                <Icon name={card.iconName} size={26} fill />
              </div>
	              <div className="min-w-0">
	                <p className="font-headline text-3xl font-black text-on-surface tabular-nums">
	                  {initialLoaded ? (
	                    card.count
	                  ) : (
	                    <span className="inline-block h-8 w-12 rounded-lg bg-surface-container-highest animate-pulse align-middle" />
	                  )}
	                </p>
                <p className="text-sm text-on-surface-variant truncate font-medium">
                  {card.label}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Attendance Table ──────────────────────────── */}
      <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
          <div className="flex items-center gap-3">
            <span className="w-1.5 h-7 bg-primary rounded-full" />
            <h3 className="font-headline font-bold text-xl">{t.att.today}</h3>
          </div>

          {isAdmin && (
            <div className="flex items-center gap-2">
              <label className="text-sm text-on-surface-variant whitespace-nowrap font-medium">
                {t.common.department}:
              </label>
              <select
                value={selectedDept}
                onChange={(e) => setSelectedDept(e.target.value)}
                className="h-10 rounded-xl bg-surface-container-high px-4 text-sm outline-none focus:ring-2 focus:ring-primary/40"
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

        <div className="overflow-x-auto -mx-6 px-6">
          <table className="w-full min-w-[600px]">
            <thead>
              <tr className="bg-surface-container/30">
                <th className="text-start px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">{t.att.employee}</th>
                <th className="text-start px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">{t.att.checkIn}</th>
                <th className="text-start px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">{t.att.checkOut}</th>
                <th className="text-start px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">{t.att.duration}</th>
                <th className="text-start px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">{t.common.status}</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.map((record) => {
                const emp = employees.find((e) => e.id === record.employeeId) ?? {
                  id: record.employeeId,
                  nameAr: "موظف غير مربوط",
                  nameEn: "Unlinked Employee",
                  positionAr: "",
                  positionEn: "",
                  department: "",
                  email: "",
                  phone: "",
                  status: "active" as const,
                  joinDate: "",
                  salary: { basic: 0, housing: 0, transport: 0, other: 0 },
                  initials: (record.employeeId[0] || "?").toUpperCase(),
                  color: "bg-slate-500",
                  profileCompleted: true,
                };
                const name = isAr ? emp.nameAr : emp.nameEn;
                const deptName = departments[emp.department]?.[lang] ?? emp.department;
                const duration = calcDuration(record.checkIn, record.checkOut);

                return (
                  <tr
                    key={record.employeeId}
                    className="hover:bg-surface-container-low transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="w-9 h-9">
                          <AvatarFallback className={cn("text-white text-xs font-bold", emp.color)}>
                            {emp.initials}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="text-sm font-bold truncate">{name}</p>
                          <p className="text-[11px] text-on-surface-variant truncate">{deptName}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-on-surface-variant tabular-nums font-medium">
                      {record.checkIn ?? "-"}
                    </td>
                    <td className="px-4 py-3 text-sm text-on-surface-variant tabular-nums font-medium">
                      {record.checkOut ?? "-"}
                    </td>
                    <td className="px-4 py-3 text-sm text-on-surface-variant tabular-nums font-medium">
                      {duration}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={statusBadgeVariant[record.status]}>
                        {statusLabelFn[record.status]?.(t) ?? record.status}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredRecords.length === 0 && (
          <div className="flex flex-col items-center justify-center py-14 text-on-surface-variant">
            <Icon name="event_busy" size={44} className="mb-3 opacity-40" />
            <p className="text-sm font-medium">{t.common.noData}</p>
          </div>
        )}
      </div>

      {/* ── Penalty Rules ─────────────────────────────── */}
      <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-5">
          <span className="w-1.5 h-7 bg-primary rounded-full" />
          <Icon name="gavel" size={22} className="text-primary" />
          <h3 className="font-headline font-bold text-xl">{t.penalty.rules}</h3>
        </div>

        <div className="overflow-x-auto -mx-6 px-6">
          <table className="w-full min-w-[400px]">
            <thead>
              <tr className="bg-surface-container/30">
                <th className="text-start px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">{t.penalty.condition}</th>
                <th className="text-start px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">{t.penalty.deduction}</th>
              </tr>
            </thead>
            <tbody>
              {penaltyRules.map((rule) => (
                <tr key={rule.id} className="hover:bg-surface-container-low transition-colors">
                  <td className="px-4 py-3 text-sm font-medium">
                    {isAr ? rule.conditionAr : rule.conditionEn}
                  </td>
                  <td className="px-4 py-3 text-sm text-on-surface-variant">
                    {isAr ? rule.deductionAr : rule.deductionEn}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center gap-3 mt-8 mb-5">
          <Icon name="logout" size={22} className="text-amber-600 dark:text-amber-400" />
          <h3 className="font-headline font-bold text-xl">
            {isAr ? "جزاءات الانصراف المبكر" : "Early Departure Penalties"}
          </h3>
        </div>

        <div className="overflow-x-auto -mx-6 px-6">
          <table className="w-full min-w-[400px]">
            <thead>
              <tr className="bg-surface-container/30">
                <th className="text-start px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">{t.penalty.condition}</th>
                <th className="text-start px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">{t.penalty.deduction}</th>
              </tr>
            </thead>
            <tbody>
              {earlyDepartureRules.map((rule) => (
                <tr key={rule.id} className="hover:bg-surface-container-low transition-colors">
                  <td className="px-4 py-3 text-sm font-medium">
                    {isAr ? rule.conditionAr : rule.conditionEn}
                  </td>
                  <td className="px-4 py-3 text-sm text-on-surface-variant">
                    {isAr ? rule.deductionAr : rule.deductionEn}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-5 p-4 rounded-2xl bg-blue-500/10">
          <p className="text-xs font-bold text-blue-700 dark:text-blue-300 flex items-center gap-2">
            <Icon name="info" size={16} fill />
            {isAr ? "الموظفون عن بُعد معفيون من قواعد الجزاءات" : "Remote employees are exempt from penalty rules"}
          </p>
        </div>

        <div className="flex items-center gap-2 mt-4 text-xs text-on-surface-variant">
          <Icon name="info" size={14} />
          <span>{t.penalty.autoCalculated}</span>
        </div>
      </div>
      </div>
      )}

      {/* ── Adjustment Dialog ─────────────────────────── */}
      <Dialog open={adjustDialogOpen} onOpenChange={setAdjustDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t.clock.requestAdjustment}</DialogTitle>
            <DialogDescription>
              {isAr ? "قم بتعبئة البيانات لطلب تعديل سجل الحضور" : "Fill in the details to request an attendance adjustment"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-bold text-on-surface block mb-1.5">{t.common.date}</label>
              <input
                type="date"
                value={adjDate}
                onChange={(e) => setAdjDate(e.target.value)}
                className="h-11 w-full rounded-xl bg-surface-container-high px-4 text-sm outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <TimePicker label={`${t.clock.originalTime} (${t.att.checkIn})`} value={adjOriginalIn} onChange={setAdjOriginalIn} isAr={isAr} />
              <TimePicker label={`${t.clock.requestedTime} (${t.att.checkIn})`} value={adjRequestedIn} onChange={setAdjRequestedIn} isAr={isAr} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <TimePicker label={`${t.clock.originalTime} (${t.att.checkOut})`} value={adjOriginalOut} onChange={setAdjOriginalOut} isAr={isAr} />
              <TimePicker label={`${t.clock.requestedTime} (${t.att.checkOut})`} value={adjRequestedOut} onChange={setAdjRequestedOut} isAr={isAr} />
            </div>

            <div>
              <label className="text-sm font-bold text-on-surface block mb-1.5">{t.clock.adjustmentReason}</label>
              <textarea
                value={adjReason}
                onChange={(e) => setAdjReason(e.target.value)}
                rows={3}
                className="w-full rounded-xl bg-surface-container-high px-4 py-3 text-sm outline-none resize-none focus:ring-2 focus:ring-primary/40"
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

      {/* ── Daily Report Modal ────────────────────────── */}
      <Dialog open={reportOpen} onOpenChange={(v) => { if (!v) return; }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{isAr ? "تقرير نهاية اليوم" : "End of Day Report"}</DialogTitle>
            <DialogDescription>
              {isAr ? "اكتب ملخص لما أنجزته اليوم قبل تسجيل الانصراف" : "Write a summary of what you accomplished today before checking out"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <textarea
              value={reportText}
              onChange={(e) => setReportText(e.target.value)}
              rows={6}
              dir={isAr ? "rtl" : "ltr"}
              style={{ textAlign: isAr ? "right" : "left" }}
              placeholder={isAr
                ? "• أنجزت تصميم واجهة صفحة الإعدادات\n• راجعت كود المهمة رقم 42"
                : "• Completed settings page UI design\n• Reviewed task #42 code"}
              className="w-full rounded-xl bg-surface-container-high px-4 py-3 text-sm outline-none resize-none focus:ring-2 focus:ring-primary/40"
            />

            <div>
              <p className="text-sm font-bold mb-2">
                {isAr ? "إرفاق ملفات (اختياري)" : "Attach files (optional)"}
              </p>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,video/mp4,video/quicktime,.pdf,.doc,.docx,.zip"
                onChange={handleFileSelect}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={reportFiles.length >= 5}
                className="flex items-center gap-2 px-4 py-3 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-sm text-on-surface font-medium transition-colors w-full justify-center"
              >
                <Icon name="upload" size={18} />
                {isAr ? "اختر ملفات" : "Choose files"}
                <span className="text-xs text-on-surface-variant">({reportFiles.length}/5)</span>
              </button>

              {reportFiles.length > 0 && (
                <div className="mt-3 space-y-2">
                  {reportFiles.map((file, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-surface-container-low text-sm">
                      <Icon
                        name={file.type.startsWith("image/") ? "image" : file.type.startsWith("video/") ? "movie" : "description"}
                        size={18}
                        className={file.type.startsWith("image/") ? "text-blue-500" : file.type.startsWith("video/") ? "text-tertiary" : "text-amber-500"}
                      />
                      <span className="truncate flex-1 font-medium">{file.name}</span>
                      <span className="text-xs text-on-surface-variant shrink-0">
                        {(file.size / 1024 / 1024).toFixed(1)}MB
                      </span>
                      <button
                        onClick={() => removeFile(i)}
                        className="text-on-surface-variant hover:text-md-error transition-colors"
                      >
                        <Icon name="close" size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-xs text-on-surface-variant mt-2">
                {isAr ? "الحد الأقصى: 10MB لكل ملف" : "Max: 10MB per file"}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setReportOpen(false);
                setReportText("");
                setReportFiles([]);
                setCheckoutOutside(false);
              }}
            >
              {t.common.cancel}
            </Button>
            <Button onClick={handleSubmitReport} disabled={!reportText.trim() || reportUploading}>
              {reportUploading
                ? (isAr ? "جاري الإرسال..." : "Submitting...")
                : (isAr ? "إرسال وتسجيل الانصراف" : "Submit & Check Out")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
