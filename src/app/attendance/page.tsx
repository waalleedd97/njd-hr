"use client";

import { useState, useEffect, useRef } from "react";
import { useLanguage, useAuth } from "@/components/providers";
import { useData, haversineDistance } from "@/lib/data-store";
import {
  employees,
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
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import {
  Clock,
  UserCheck,
  UserX,
  AlertTriangle,
  CalendarOff,
  MapPin,
  MapPinOff,
  FileEdit,
  ShieldAlert,
  Info,
  Upload,
  X,
  FileText,
  Image as ImageIcon,
  Film,
  Loader2,
  CheckCircle,
} from "lucide-react";

/** Get current time in KSA timezone (Asia/Riyadh, UTC+3) */
function getKSATime(): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Riyadh" }));
}

function isBeforeCheckinTime(): boolean {
  const ksa = getKSATime();
  return ksa.getHours() < 6;
}

// ─── Dropdown 12-hour Time Picker ─────────────────────────────────────

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

  // Scroll selected into view when dropdown opens
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
          "h-9 w-full rounded-lg border bg-card px-2 text-sm font-semibold tabular-nums text-center transition-colors cursor-pointer",
          open ? "border-primary ring-2 ring-primary/20" : "border-border hover:border-primary/50"
        )}
      >
        {String(selected).padStart(2, "0")}
      </button>
      {open && (
        <div
          ref={listRef}
          className="absolute z-50 mt-1 w-full max-h-[160px] overflow-y-auto rounded-lg border border-border bg-popover shadow-lg"
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
                  ? "bg-primary/10 text-primary font-bold"
                  : "text-foreground hover:bg-accent"
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
    setHour(p.hour);
    setMinute(p.minute);
    setPeriod(p.period);
  }, [value]);

  const emit = (h: number, m: number, p: "AM" | "PM") => onChange(to24h(h, m, p));

  const amLabel = isAr ? "ص" : "AM";
  const pmLabel = isAr ? "م" : "PM";

  return (
    <div>
      <label className="text-sm font-medium text-foreground block mb-1.5 text-center">{label}</label>
      <div className="flex items-center justify-center gap-1.5" dir="ltr">
        {/* Hour dropdown */}
        <div className="w-12">
          <TimeDropdown
            items={HOURS}
            selected={hour}
            onSelect={(h) => { setHour(h); emit(h, minute, period); }}
            open={openField === "hour"}
            onToggle={() => setOpenField(openField === "hour" ? null : "hour")}
          />
        </div>

        <span className="text-base font-bold text-muted-foreground">:</span>

        {/* Minute dropdown */}
        <div className="w-12">
          <TimeDropdown
            items={MINUTES}
            selected={minute}
            onSelect={(m) => { setMinute(m); emit(hour, m, period); }}
            open={openField === "minute"}
            onToggle={() => setOpenField(openField === "minute" ? null : "minute")}
          />
        </div>

        {/* AM/PM toggle */}
        <button
          type="button"
          onClick={() => {
            const next = period === "AM" ? "PM" : "AM";
            setPeriod(next);
            emit(hour, minute, next);
          }}
          className={cn(
            "h-9 px-2 rounded-lg text-xs font-bold transition-colors cursor-pointer",
            period === "AM"
              ? "bg-primary/10 text-primary"
              : "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400"
          )}
        >
          {period === "AM" ? amLabel : pmLabel}
        </button>
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
  const { isAdmin, user } = useAuth();
  const store = useData();
  const departments = store.departments;
  const isAr = lang === "ar";
  const [selectedDept, setSelectedDept] = useState("all");

  // Clock in/out state — initialized from store so it survives navigation
  const currentUserId = isAdmin ? null : user.id;
  const existingRecord = currentUserId
    ? store.todayAttendance.find((a) => a.employeeId === currentUserId)
    : null;

  const [clockedIn, setClockedIn] = useState(() => !!existingRecord?.checkIn && !existingRecord?.checkOut);
  const [clockInTime, setClockInTime] = useState<string | null>(() => existingRecord?.checkIn ?? null);
  const [clockOutTime, setClockOutTime] = useState<string | null>(() => existingRecord?.checkOut ?? null);
  const [clockMethod, setClockMethod] = useState<string>("geofence");

  // Re-sync from store when navigating back to this page
  useEffect(() => {
    if (!currentUserId) return;
    const record = store.todayAttendance.find((a) => a.employeeId === currentUserId);
    if (record) {
      setClockedIn(!!record.checkIn && !record.checkOut);
      setClockInTime(record.checkIn ?? null);
      setClockOutTime(record.checkOut ?? null);
    }
  }, [currentUserId, store.todayAttendance]);

  // Geofence state
  const [isInsideGeofence, setIsInsideGeofence] = useState(true);
  const [locationRequired, setLocationRequired] = useState(true);
  const [locationLoaded, setLocationLoaded] = useState(false);

  // Fetch location_required from Supabase profiles table
  useEffect(() => {
    async function fetchLocationSetting() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.id) {
          const { data } = await supabase
            .from("profiles")
            .select("location_required")
            .eq("id", session.user.id)
            .single();
          if (data) {
            setLocationRequired(data.location_required ?? true);
          }
        }
      } catch { /* profiles table may not exist */ }
      setLocationLoaded(true);
    }
    fetchLocationSetting();
  }, []);

  // Real geolocation check — only runs after location setting is loaded
  useEffect(() => {
    if (!locationLoaded || !locationRequired) return;
    if (clockMethod !== "geofence") return;
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const dist = haversineDistance(
          pos.coords.latitude,
          pos.coords.longitude,
          geofenceConfig.officeLat,
          geofenceConfig.officeLng
        );
        setIsInsideGeofence(dist <= geofenceConfig.radiusMeters);
      },
      () => { /* Geolocation denied */ }
    );
  }, [clockMethod, locationLoaded, locationRequired]);

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

  // 6:00 AM check-in restriction (KSA time)
  const [tooEarly, setTooEarly] = useState(isBeforeCheckinTime());
  useEffect(() => {
    const id = setInterval(() => setTooEarly(isBeforeCheckinTime()), 30000);
    return () => clearInterval(id);
  }, []);

  // Checkout geofence verification state
  const [checkoutOutside, setCheckoutOutside] = useState(false);
  const [checkoutLocationLoading, setCheckoutLocationLoading] = useState(false);

  // Daily report modal state
  const [reportOpen, setReportOpen] = useState(false);
  const [reportText, setReportText] = useState("");
  const [reportFiles, setReportFiles] = useState<File[]>([]);
  const [reportUploading, setReportUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle clock in
  const handleClockIn = async () => {
    if (tooEarly) return;
    if (clockMethod === "geofence" && locationRequired && !isInsideGeofence) return;
    const time = getCurrentTime();
    setClockedIn(true);
    setClockInTime(time);
    setClockOutTime(null);
    await store.clockIn(time);
  };

  // Handle clock out — re-verify geofence, block if outside
  const handleClockOut = () => {
    if (locationRequired && navigator.geolocation) {
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
          // Geolocation denied — treat as outside, block checkout
          setCheckoutOutside(true);
          setCheckoutLocationLoading(false);
        }
      );
    } else {
      setCheckoutOutside(false);
      setReportOpen(true);
    }
  };

  // Submit report + clock out
  const handleSubmitReport = async () => {
    if (!reportText.trim()) return;
    setReportUploading(true);

    const time = getCurrentTime();
    const today = new Date().toISOString().split("T")[0];
    const attachments: { name: string; url: string; type: string }[] = [];

    // Upload files to Supabase Storage
    if (currentUserId && reportFiles.length > 0) {
      for (const file of reportFiles) {
        const path = `${currentUserId}/${today}/${file.name}`;
        const { data } = await supabase.storage
          .from("daily-reports")
          .upload(path, file, { upsert: true });
        if (data) {
          // Private bucket — store path, generate signed URL on read
          attachments.push({
            name: file.name,
            url: data.path,
            type: file.type,
          });
        }
      }
    }

    // Save report to Supabase
    if (currentUserId) {
      await supabase.from("daily_reports").upsert({
        user_id: currentUserId,
        report_date: today,
        content: reportText,
        attachments,
      }, { onConflict: "user_id,report_date" });
    }

    // Clock out
    setClockedIn(false);
    setClockOutTime(time);
    await store.clockOut(time);

    // Reset modal
    setReportOpen(false);
    setReportText("");
    setReportFiles([]);
    setReportUploading(false);
    setCheckoutOutside(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const valid = files.filter((f) => f.size <= 10 * 1024 * 1024); // 10MB max
    setReportFiles((prev) => [...prev, ...valid].slice(0, 5)); // max 5 files
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeFile = (index: number) => {
    setReportFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // Handle adjustment submit
  const handleAdjustmentSubmit = async () => {
    await store.submitAdjustment({
      employeeId: "",
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

  // locationRequired is fetched from Supabase profiles table (see useEffect above)
  const geofenceDisabled = locationRequired && !isInsideGeofence;

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
                {clockOutTime && !clockedIn ? t.clock.alreadyCheckedOut : clockedIn ? t.clock.clockOut : t.clock.clockIn}
              </h3>
            </div>

            {/* Status text */}
            <div className="text-center">
              {clockOutTime && !clockedIn ? (
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">
                    {t.clock.clockedInAt}: <span className="font-semibold text-foreground">{clockInTime}</span>
                    {" — "}
                    {t.clock.clockedOutAt}: <span className="font-semibold text-foreground">{clockOutTime}</span>
                  </p>
                </div>
              ) : clockedIn && clockInTime ? (
                <p className="text-sm text-muted-foreground">
                  {t.clock.clockedInAt}: <span className="font-semibold text-foreground">{clockInTime}</span>
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">{t.clock.notClockedIn}</p>
              )}
            </div>

            {/* Big clock in/out button — 3 states: not clocked in, clocked in, already checked out */}
            {clockOutTime && !clockedIn ? (
              /* Already checked out — disabled neutral button */
              <div className="flex flex-col items-center gap-3">
                <div className="w-36 h-36 rounded-full flex flex-col items-center justify-center gap-1 font-bold text-sm leading-tight text-center bg-muted text-muted-foreground shadow-none cursor-not-allowed px-3">
                  <CheckCircle className="w-8 h-8 shrink-0" />
                  {t.clock.alreadyCheckedOut}
                </div>
                <p className="text-xs text-muted-foreground text-center max-w-[280px]">
                  {t.clock.alreadyCheckedOutDesc}
                </p>
              </div>
            ) : !clockedIn ? (
              <button
                onClick={handleClockIn}
                disabled={geofenceDisabled || tooEarly}
                className={cn(
                  "w-36 h-36 rounded-full flex flex-col items-center justify-center gap-1 text-white font-bold text-lg shadow-lg transition-all hover-lift",
                  (geofenceDisabled || tooEarly)
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
                disabled={checkoutLocationLoading}
                className={cn(
                  "w-36 h-36 rounded-full flex flex-col items-center justify-center gap-1 text-white font-bold text-lg shadow-lg transition-all hover-lift",
                  checkoutLocationLoading
                    ? "bg-muted text-muted-foreground cursor-not-allowed shadow-none"
                    : "bg-gradient-to-br from-red-500 to-red-700 hover:from-red-400 hover:to-red-600 active:scale-95"
                )}
              >
                {checkoutLocationLoading ? <Loader2 className="w-8 h-8 animate-spin" /> : <Clock className="w-8 h-8" />}
                {checkoutLocationLoading ? t.clock.verifyingLocation : t.clock.clockOut}
              </button>
            )}

            {/* Time restriction warning */}
            {tooEarly && (
              <p className="text-xs text-red-500 font-medium flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {isAr ? "وقت تسجيل الحضور يبدأ من الساعة 6:00 صباحاً" : "Check-in starts at 6:00 AM"}
              </p>
            )}
            {/* Geofence warning when method is geofence and outside (check-in) */}
            {!tooEarly && !clockedIn && geofenceDisabled && (
              <p className="text-xs text-red-500 font-medium flex items-center gap-1">
                <MapPinOff className="w-3.5 h-3.5" />
                {t.clock.geofenceRequired}
              </p>
            )}
            {/* Geofence block on checkout */}
            {clockedIn && checkoutOutside && (
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

            {/* Geofence Indicator — hidden when location not required */}
            {locationRequired && <div className="glass-card rounded-lg p-4 space-y-3">
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
                  {t.clock.radius}: {geofenceConfig.radiusMeters >= 1000 ? `${geofenceConfig.radiusMeters / 1000} ${isAr ? "كم" : "km"}` : `${geofenceConfig.radiusMeters} ${t.clock.meters}`}
                </p>
              </div>

            </div>}

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

        {/* Early Departure Rules */}
        <div className="flex items-center gap-2 mt-8 mb-4">
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          <h3 className="font-bold text-lg">{isAr ? "جزاءات الانصراف المبكر" : "Early Departure Penalties"}</h3>
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
              {earlyDepartureRules.map((rule) => (
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

        {/* Exemption note */}
        <div className="mt-4 p-3 rounded-lg bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20">
          <p className="text-xs font-medium text-blue-700 dark:text-blue-400 flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 shrink-0" />
            {isAr ? "الموظفون عن بُعد معفيون من قواعد الجزاءات" : "Remote employees are exempt from penalty rules"}
          </p>
        </div>

        <div className="flex items-center gap-1.5 mt-4 text-xs text-muted-foreground">
          <Info className="w-3.5 h-3.5" />
          <span>{t.penalty.autoCalculated}</span>
        </div>
      </div>

      {/* ───── Attendance Adjustment Dialog ───── */}
      <Dialog open={adjustDialogOpen} onOpenChange={setAdjustDialogOpen}>
        <DialogContent className="sm:max-w-md">
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

      {/* ───── Daily Report Modal (blocks checkout) ───── */}
      <Dialog open={reportOpen} onOpenChange={(v) => { if (!v) return; }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {isAr ? "تقرير نهاية اليوم" : "End of Day Report"}
            </DialogTitle>
            <DialogDescription>
              {isAr
                ? "اكتب ملخص لما أنجزته اليوم قبل تسجيل الانصراف"
                : "Write a summary of what you accomplished today before checking out"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Report text */}
            <textarea
              value={reportText}
              onChange={(e) => setReportText(e.target.value)}
              rows={6}
              dir={isAr ? "rtl" : "ltr"}
              style={{ textAlign: isAr ? "right" : "left" }}
              placeholder={isAr
                ? "• أنجزت تصميم واجهة صفحة الإعدادات\n• راجعت كود المهمة رقم 42"
                : "• Completed settings page UI design\n• Reviewed task #42 code"}
              className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none resize-none focus:border-primary"
            />

            {/* File upload */}
            <div>
              <p className="text-sm font-medium mb-2">
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
                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-border hover:border-primary/50 text-sm text-muted-foreground hover:text-foreground transition-colors w-full justify-center"
              >
                <Upload className="w-4 h-4" />
                {isAr ? "اختر ملفات" : "Choose files"}
                <span className="text-xs">({reportFiles.length}/5)</span>
              </button>

              {/* File list */}
              {reportFiles.length > 0 && (
                <div className="mt-2 space-y-1.5">
                  {reportFiles.map((file, i) => (
                    <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 text-sm">
                      {file.type.startsWith("image/") ? (
                        <ImageIcon className="w-4 h-4 text-blue-500 shrink-0" />
                      ) : file.type.startsWith("video/") ? (
                        <Film className="w-4 h-4 text-purple-500 shrink-0" />
                      ) : (
                        <FileText className="w-4 h-4 text-amber-500 shrink-0" />
                      )}
                      <span className="truncate flex-1">{file.name}</span>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {(file.size / 1024 / 1024).toFixed(1)}MB
                      </span>
                      <button onClick={() => removeFile(i)} className="text-muted-foreground hover:text-red-500">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-1">
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
            <Button
              onClick={handleSubmitReport}
              disabled={!reportText.trim() || reportUploading}
            >
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
