"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useLanguage, useAuth } from "@/components/providers";
import { useData } from "@/lib/data-store";
import { supabase } from "@/lib/supabase";
import { cn, formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Icon } from "@/components/ui/icon";

interface DailyReport {
  id: string;
  user_id: string;
  report_date: string;
  content: string;
  attachments: { name: string; url: string; type: string }[];
  submitted_at: string;
}

const SIGNED_URL_TTL_SEC = 3600;
const SIGNED_URL_REFRESH_MARGIN_MS = 5 * 60 * 1000;

export default function DailyReportsPage() {
  const { t, lang } = useLanguage();
  useAuth();
  const store = useData();
  const isAr = lang === "ar";

  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "submitted" | "missing">("all");
  const [loading, setLoading] = useState(false);

  const signedUrlCache = useRef<Map<string, { url: string; expiresAt: number }>>(new Map());

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from("daily_reports")
        .select("*")
        .eq("report_date", selectedDate)
        .order("submitted_at", { ascending: false });

      const reports = (data || []) as DailyReport[];
      const now = Date.now();

      for (const report of reports) {
        if (!report.attachments?.length) continue;
        for (const att of report.attachments) {
          if (!att.url || att.url.startsWith("http")) continue;

          const cached = signedUrlCache.current.get(att.url);
          if (cached && cached.expiresAt - now > SIGNED_URL_REFRESH_MARGIN_MS) {
            att.url = cached.url;
            continue;
          }

          const { data: signedData } = await supabase.storage
            .from("daily-reports")
            .createSignedUrl(att.url, SIGNED_URL_TTL_SEC);

          if (signedData?.signedUrl) {
            signedUrlCache.current.set(att.url, {
              url: signedData.signedUrl,
              expiresAt: now + SIGNED_URL_TTL_SEC * 1000,
            });
            att.url = signedData.signedUrl;
          }
        }
      }
      setReports(reports);
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => { fetchReports(); }, [fetchReports]);

  const employeeReports = store.employees.map((emp) => {
    const report = reports.find((r) => r.user_id === emp.id);
    const attendance = store.todayAttendance.find((a) => a.employeeId === emp.id);
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
          {t.dr.title}
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
          {t.dr.filterAll} ({employeeReports.length})
        </button>
        <button
          onClick={() => setFilter("submitted")}
          className={cn(
            "px-5 py-2 rounded-full text-sm font-bold transition-all flex items-center gap-1.5",
            filter === "submitted" ? "bg-emerald-500 text-white shadow-[0_0_16px_rgba(16,185,129,0.4)]" : "text-on-surface-variant hover:text-on-surface"
          )}
        >
          <Icon name="check_circle" size={16} fill />
          {t.dr.filterSubmitted} ({submittedCount})
        </button>
        <button
          onClick={() => setFilter("missing")}
          className={cn(
            "px-5 py-2 rounded-full text-sm font-bold transition-all flex items-center gap-1.5",
            filter === "missing" ? "bg-md-error text-on-error shadow-[0_0_16px_rgba(180,19,64,0.4)]" : "text-on-surface-variant hover:text-on-surface"
          )}
        >
          <Icon name="cancel" size={16} fill />
          {t.dr.filterMissing} ({missingCount})
        </button>
      </div>

      {/* Reports List */}
      <div className="space-y-3">
        {loading && (
          <div className="bg-surface-container-lowest rounded-2xl p-12 text-center" role="status" aria-live="polite">
            <Icon name="progress_activity" size={48} className="text-primary animate-spin mb-3" />
            <p className="text-sm text-on-surface-variant font-medium">
              {t.dr.loading}
            </p>
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="bg-surface-container-lowest rounded-2xl p-12 text-center">
            <Icon name="description" size={48} className="text-on-surface-variant opacity-40 mb-3" />
            <p className="text-sm text-on-surface-variant font-medium">
              {t.dr.noReportsDate}
            </p>
          </div>
        )}

        {!loading && filtered.map((er) => {
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
