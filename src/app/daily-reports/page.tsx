"use client";

import { useState, useEffect, useCallback } from "react";
import { useLanguage, useAuth } from "@/components/providers";
import { useData } from "@/lib/data-store";
import { supabase } from "@/lib/supabase";
import { cn, formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronUp,
  FileText,
  Image as ImageIcon,
  Film,
  Calendar,
} from "lucide-react";

interface DailyReport {
  id: string;
  user_id: string;
  report_date: string;
  content: string;
  attachments: { name: string; url: string; type: string }[];
  submitted_at: string;
}

export default function DailyReportsPage() {
  const { lang } = useLanguage();
  useAuth(); // ensure authenticated
  const store = useData();
  const isAr = lang === "ar";

  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "submitted" | "missing">("all");

  const fetchReports = useCallback(async () => {
    const { data } = await supabase
      .from("daily_reports")
      .select("*")
      .eq("report_date", selectedDate)
      .order("submitted_at", { ascending: false });

    // Generate signed URLs for private bucket attachments
    const reports = (data || []) as DailyReport[];
    for (const report of reports) {
      if (!report.attachments?.length) continue;
      for (const att of report.attachments) {
        if (att.url && !att.url.startsWith("http")) {
          const { data: signedData } = await supabase.storage
            .from("daily-reports")
            .createSignedUrl(att.url, 3600); // 1 hour expiry
          if (signedData?.signedUrl) att.url = signedData.signedUrl;
        }
      }
    }
    setReports(reports);
  }, [selectedDate]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  // Build employee list with report status
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
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">
          {isAr ? "التقارير اليومية" : "Daily Reports"}
        </h1>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="h-9 rounded-lg border border-border bg-card px-3 text-sm outline-none"
            />
          </div>
        </div>
      </div>

      {/* Summary + Filter */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => setFilter("all")}
          className={cn(
            "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
            filter === "all" ? "bg-primary text-white" : "bg-muted text-muted-foreground hover:text-foreground"
          )}
        >
          {isAr ? "الكل" : "All"} ({employeeReports.length})
        </button>
        <button
          onClick={() => setFilter("submitted")}
          className={cn(
            "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
            filter === "submitted" ? "bg-emerald-600 text-white" : "bg-muted text-muted-foreground hover:text-foreground"
          )}
        >
          <span className="flex items-center gap-1">
            <CheckCircle className="w-3.5 h-3.5" />
            {isAr ? "مرسل" : "Submitted"} ({submittedCount})
          </span>
        </button>
        <button
          onClick={() => setFilter("missing")}
          className={cn(
            "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
            filter === "missing" ? "bg-red-600 text-white" : "bg-muted text-muted-foreground hover:text-foreground"
          )}
        >
          <span className="flex items-center gap-1">
            <XCircle className="w-3.5 h-3.5" />
            {isAr ? "لم يُرسل" : "Missing"} ({missingCount})
          </span>
        </button>
      </div>

      {/* Reports List */}
      <div className="space-y-3">
        {filtered.length === 0 && (
          <div className="glass-card rounded-xl p-8 text-center">
            <FileText className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-40" />
            <p className="text-sm text-muted-foreground">
              {isAr ? "لا توجد تقارير لهذا التاريخ" : "No reports for this date"}
            </p>
          </div>
        )}

        {filtered.map((er) => {
          const emp = er.employee;
          const name = isAr ? emp.nameAr : emp.nameEn;
          const isExpanded = expandedId === emp.id;

          return (
            <div
              key={emp.id}
              className={cn(
                "glass-card rounded-xl overflow-hidden transition-all",
                !er.hasReport && er.checkOut && "ring-1 ring-red-300 dark:ring-red-500/30"
              )}
            >
              {/* Row */}
              <button
                onClick={() => setExpandedId(isExpanded ? null : emp.id)}
                className="w-full flex items-center gap-4 p-4 text-start hover:bg-accent/30 transition-colors"
              >
                <Avatar className="w-9 h-9 shrink-0">
                  <AvatarFallback className={cn("text-white text-xs font-bold", emp.color)}>
                    {emp.initials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{name}</p>
                  <p className="text-xs text-muted-foreground">
                    {er.checkIn ? `${isAr ? "حضور" : "In"}: ${er.checkIn}` : (isAr ? "لم يحضر" : "No check-in")}
                    {er.checkOut ? ` · ${isAr ? "انصراف" : "Out"}: ${er.checkOut}` : ""}
                  </p>
                </div>
                <Badge
                  className={cn(
                    "text-[11px] font-medium border-0 shrink-0",
                    er.hasReport
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-400"
                      : "bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-400"
                  )}
                >
                  {er.hasReport ? (
                    <><CheckCircle className="w-3 h-3 me-1" />{isAr ? "مرسل" : "Submitted"}</>
                  ) : (
                    <><XCircle className="w-3 h-3 me-1" />{isAr ? "لم يُرسل" : "Missing"}</>
                  )}
                </Badge>
                {er.hasReport && (
                  isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                )}
              </button>

              {/* Expanded report content */}
              {isExpanded && er.report && (
                <div className="px-4 pb-4 border-t border-border pt-3">
                  <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed text-foreground">
                    {er.report.content}
                  </pre>
                  {er.report.attachments.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {er.report.attachments.map((att, i) => (
                        <a
                          key={i}
                          href={att.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-muted text-xs font-medium hover:bg-accent transition-colors"
                        >
                          {att.type?.startsWith("image/") ? (
                            <ImageIcon className="w-3.5 h-3.5 text-blue-500" />
                          ) : att.type?.startsWith("video/") ? (
                            <Film className="w-3.5 h-3.5 text-purple-500" />
                          ) : (
                            <FileText className="w-3.5 h-3.5 text-amber-500" />
                          )}
                          {att.name}
                        </a>
                      ))}
                    </div>
                  )}
                  <p className="text-[11px] text-muted-foreground mt-2">
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
