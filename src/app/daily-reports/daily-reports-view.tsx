"use client";

import { useState, useEffect, useCallback } from "react";
import { useLanguage, useAuth } from "@/components/providers";
import { useData } from "@/lib/data-store";
import { supabase } from "@/lib/supabase";
import { cn, formatDate, getKSADateString } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Icon } from "@/components/ui/icon";
import { useDataHydration } from "@/lib/hooks/use-data-hydration";
import type { DailyReportsSlice } from "@/lib/data/server";

interface DailyReport {
  id: string;
  user_id: string;
  report_date: string;
  content: string;
  attachments: { name: string; url: string; type: string }[];
  submitted_at: string;
}

export function DailyReportsView({ initialSlice }: { initialSlice: DailyReportsSlice }) {
  useDataHydration({
    todayAttendance: initialSlice.todayAttendance,
    employees: initialSlice.employees,
  });
  const { lang } = useLanguage();
  useAuth();
  const store = useData();
  const isAr = lang === "ar";

  // Business date in Asia/Riyadh — never UTC.
  const [selectedDate, setSelectedDate] = useState(getKSADateString());
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "submitted" | "missing">("all");
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState("");
  // Attendance rows for the SELECTED date (not store.todayAttendance, which
  // always holds today and showed wrong times next to past dates' reports).
  const [dateAttendance, setDateAttendance] = useState<
    Record<string, { checkIn: string | null; checkOut: string | null }>
  >({});

  const fetchReports = useCallback(async () => {
    setLoading(true);
    setFetchError("");
    try {
      const { data, error } = await supabase
        .from("daily_reports")
        .select("*")
        .eq("report_date", selectedDate)
        .order("submitted_at", { ascending: false });

      if (error) {
        console.error("[daily-reports] reports fetch failed:", error.message);
        setReports([]);
        setFetchError(
          isAr
            ? "تعذّر تحميل التقارير. تحقق من الاتصال وحاول مرة أخرى."
            : "Could not load reports. Check your connection and try again."
        );
        return;
      }

      const reports = (data || []) as DailyReport[];
      for (const report of reports) {
        if (!report.attachments?.length) continue;
        for (const att of report.attachments) {
          if (att.url && !att.url.startsWith("http")) {
            const { data: signedData } = await supabase.storage
              .from("daily-reports")
              .createSignedUrl(att.url, 3600);
            if (signedData?.signedUrl) att.url = signedData.signedUrl;
          }
        }
      }
      setReports(reports);
    } finally {
      setLoading(false);
    }
  }, [selectedDate, isAr]);

  useEffect(() => { fetchReports(); }, [fetchReports]);

  // Fetch attendance for the selected date so check-in/out times match the
  // reports being viewed. Failure here is non-fatal: times render as "—".
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("attendance")
        .select("employee_id, check_in, check_out")
        .eq("date", selectedDate);
      if (cancelled) return;
      if (error) {
        console.error("[daily-reports] attendance fetch failed:", error.message);
        setDateAttendance({});
        return;
      }
      const map: Record<string, { checkIn: string | null; checkOut: string | null }> = {};
      for (const r of (data || []) as Record<string, unknown>[]) {
        map[r.employee_id as string] = {
          checkIn: r.check_in ? String(r.check_in).slice(0, 5) : null,
          checkOut: r.check_out ? String(r.check_out).slice(0, 5) : null,
        };
      }
      setDateAttendance(map);
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedDate]);

  const employeeReports = store.employees.map((emp) => {
    const report = reports.find((r) => r.user_id === emp.id);
    const attendance = dateAttendance[emp.id];
    return {
      employee: emp,
      report,
      checkIn: attendance?.checkIn || null,
      checkOut: attendance?.checkOut || null,
      hasReport: !!report,
    };
  });

  const filtered = employeeReports.filter((er) => {
    if (filter === "submitted") return er.hasReport;
    if (filter === "missing") return !er.hasReport;
    return true;
  });

  const submittedCount = employeeReports.filter((er) => er.hasReport).length;
  const missingCount = employeeReports.filter((er) => !er.hasReport).length;

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="font-headline text-3xl md:text-4xl font-extrabold text-on-surface tracking-tight">
          {isAr ? "التقارير اليومية" : "Daily Reports"}
        </h1>
        <div className="flex items-center gap-3 bg-surface-container-high rounded-xl px-4 py-2.5">
          <Icon name="calendar_month" size={20} className="text-primary" />
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="bg-transparent text-sm font-medium outline-none"
          />
        </div>
      </div>

      {/* Filter Buttons */}
      <div className="inline-flex items-center bg-surface-container rounded-full p-1 gap-1">
        <button
          onClick={() => setFilter("all")}
          className={cn(
            "px-5 py-2 rounded-full text-sm font-bold transition-all",
            filter === "all" ? "gradient-btn shadow-primary-glow" : "text-on-surface-variant hover:text-on-surface"
          )}
        >
          {isAr ? "الكل" : "All"} ({employeeReports.length})
        </button>
        <button
          onClick={() => setFilter("submitted")}
          className={cn(
            "px-5 py-2 rounded-full text-sm font-bold transition-all flex items-center gap-1.5",
            filter === "submitted" ? "bg-emerald-500 text-white shadow-[0_0_16px_rgba(16,185,129,0.4)]" : "text-on-surface-variant hover:text-on-surface"
          )}
        >
          <Icon name="check_circle" size={16} fill />
          {isAr ? "مرسل" : "Submitted"} ({submittedCount})
        </button>
        <button
          onClick={() => setFilter("missing")}
          className={cn(
            "px-5 py-2 rounded-full text-sm font-bold transition-all flex items-center gap-1.5",
            filter === "missing" ? "bg-md-error text-on-error shadow-[0_0_16px_rgba(180,19,64,0.4)]" : "text-on-surface-variant hover:text-on-surface"
          )}
        >
          <Icon name="cancel" size={16} fill />
          {isAr ? "لم يُرسل" : "Missing"} ({missingCount})
        </button>
      </div>

      {/* Reports List */}
      <div className="space-y-3">
        {loading && (
          <div className="bg-surface-container-lowest rounded-2xl p-12 text-center" role="status" aria-live="polite">
            <Icon name="progress_activity" size={48} className="text-primary animate-spin mb-3" />
            <p className="text-sm text-on-surface-variant font-medium">
              {isAr ? "جاري تحميل التقارير..." : "Loading reports..."}
            </p>
          </div>
        )}

        {!loading && fetchError && (
          <div className="bg-surface-container-lowest rounded-2xl p-12 text-center" role="alert">
            <Icon name="error" size={48} className="text-md-error opacity-70 mb-3" />
            <p className="text-sm text-on-surface-variant font-medium">{fetchError}</p>
            <button
              onClick={() => void fetchReports()}
              className="mt-4 px-5 py-2 rounded-full text-sm font-bold gradient-btn shadow-primary-glow"
            >
              {isAr ? "إعادة المحاولة" : "Retry"}
            </button>
          </div>
        )}

        {!loading && !fetchError && filtered.length === 0 && (
          <div className="bg-surface-container-lowest rounded-2xl p-12 text-center">
            <Icon name="description" size={48} className="text-on-surface-variant opacity-40 mb-3" />
            <p className="text-sm text-on-surface-variant font-medium">
              {isAr ? "لا توجد تقارير لهذا التاريخ" : "No reports for this date"}
            </p>
          </div>
        )}

        {!loading && !fetchError && filtered.map((er) => {
          const emp = er.employee;
          const name = isAr ? emp.nameAr : emp.nameEn;
          const isExpanded = expandedId === emp.id;

          return (
            <div
              key={emp.id}
              className={cn(
                "bg-surface-container-lowest rounded-2xl overflow-hidden transition-all shadow-sm",
                !er.hasReport && er.checkOut && "ring-2 ring-md-error/30"
              )}
            >
              <button
                onClick={() => setExpandedId(isExpanded ? null : emp.id)}
                className="w-full flex items-center gap-4 p-5 text-start hover:bg-surface-container-low transition-colors"
              >
                <Avatar className="w-11 h-11 shrink-0">
                  <AvatarFallback className={cn("text-white text-sm font-bold", emp.color)}>
                    {emp.initials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-headline font-bold truncate">{name}</p>
                  <p className="text-xs text-on-surface-variant mt-0.5 font-medium">
                    {er.checkIn ? `${isAr ? "حضور" : "In"}: ${er.checkIn}` : (isAr ? "لم يحضر" : "No check-in")}
                    {er.checkOut ? ` · ${isAr ? "انصراف" : "Out"}: ${er.checkOut}` : ""}
                  </p>
                </div>
                <Badge variant={er.hasReport ? "success" : "destructive"}>
                  {er.hasReport ? (
                    <>
                      <Icon name="check_circle" size={12} fill className="me-1" />
                      {isAr ? "مرسل" : "Submitted"}
                    </>
                  ) : (
                    <>
                      <Icon name="cancel" size={12} fill className="me-1" />
                      {isAr ? "لم يُرسل" : "Missing"}
                    </>
                  )}
                </Badge>
                {er.hasReport && (
                  <Icon
                    name={isExpanded ? "expand_less" : "expand_more"}
                    size={22}
                    className="text-on-surface-variant shrink-0"
                  />
                )}
              </button>

              {isExpanded && er.report && (
                <div className="px-5 pb-5 pt-4 border-t border-outline-variant/20 bg-surface-container-low/50">
                  <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed text-on-surface">
                    {er.report.content}
                  </pre>
                  {er.report.attachments.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {er.report.attachments.map((att, i) => (
                        <a
                          key={i}
                          href={att.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-container-lowest text-xs font-bold hover:bg-primary-container/20 transition-colors"
                        >
                          <Icon
                            name={att.type?.startsWith("image/") ? "image" : att.type?.startsWith("video/") ? "movie" : "description"}
                            size={16}
                            className={att.type?.startsWith("image/") ? "text-blue-500" : att.type?.startsWith("video/") ? "text-tertiary" : "text-amber-500"}
                          />
                          {att.name}
                        </a>
                      ))}
                    </div>
                  )}
                  <p className="text-[11px] text-on-surface-variant mt-3 font-medium">
                    {isAr ? "تم الإرسال:" : "Submitted:"}{" "}
                    {formatDate(new Date(er.report.submitted_at), lang, {
                      hour: "numeric",
                      minute: "numeric",
                    })}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
