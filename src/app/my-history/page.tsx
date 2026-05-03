"use client";

import { useEffect, useMemo, useState } from "react";
import { useLanguage, useAuth } from "@/components/providers";
import { supabase } from "@/lib/supabase";
import { formatDate, getKSANow } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm-dialog";

type Tab = "attendance" | "leaves" | "requests";

interface AttendanceRow { id: string; date: string; check_in: string | null; check_out: string | null; status: string; }
interface LeaveRow { id: string; start_date: string; end_date: string; days: number; status: string; type?: string; type_key?: string; reason?: string; reason_ar?: string; reason_en?: string; }
interface RequestRow { id: string; type_key: string; date: string; status: string; details_ar?: string; details_en?: string; }

export default function MyHistoryPage() {
  const { t, lang } = useLanguage();
  const { user } = useAuth();
  const toast = useToast();
  const { confirm } = useConfirm();
  const isAr = lang === "ar";

  const [tab, setTab] = useState<Tab>("attendance");

  // Default: last 90 days
  const defaultFrom = useMemo(() => {
    const d = getKSANow();
    d.setDate(d.getDate() - 90);
    return d.toISOString().split("T")[0];
  }, []);
  const defaultTo = useMemo(() => getKSANow().toISOString().split("T")[0], []);
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);

  const [attendance, setAttendance] = useState<AttendanceRow[]>([]);
  const [leaves, setLeaves] = useState<LeaveRow[]>([]);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user.id) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      if (tab === "attendance") {
        const { data } = await supabase
          .from("attendance")
          .select("*")
          .eq("employee_id", user.id)
          .gte("date", from)
          .lte("date", to)
          .order("date", { ascending: false });
        if (!cancelled) setAttendance((data as AttendanceRow[]) || []);
      } else if (tab === "leaves") {
        const { data } = await supabase
          .from("leave_requests")
          .select("*")
          .eq("employee_id", user.id)
          .gte("start_date", from)
          .lte("start_date", to)
          .order("start_date", { ascending: false });
        if (!cancelled) setLeaves((data as LeaveRow[]) || []);
      } else {
        const { data } = await supabase
          .from("employee_requests")
          .select("*")
          .eq("employee_id", user.id)
          .gte("date", from)
          .lte("date", to)
          .order("date", { ascending: false });
        if (!cancelled) setRequests((data as RequestRow[]) || []);
      }
      if (!cancelled) setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [tab, from, to, user.id]);

  const [downloading, setDownloading] = useState(false);
  const [erasureSending, setErasureSending] = useState(false);

  const downloadData = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast.error(isAr ? "الجلسة منتهية" : "Session expired");
        return;
      }
      const res = await fetch("/api/my-data", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) {
        toast.error(isAr ? "فشل تحميل البيانات" : "Failed to download data");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `njd-hr-my-data-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(isAr ? "تم تحميل بياناتك" : "Your data has been downloaded");
    } finally {
      setDownloading(false);
    }
  };

  const requestErasure = async () => {
    if (erasureSending) return;
    const ok = await confirm({
      title: isAr ? "طلب حذف البيانات (PDPL)" : "Data Erasure Request (PDPL)",
      description: isAr
        ? "طلب حذف بياناتك الشخصية؟ ستتم مراجعة الطلب من قبل الموارد البشرية خلال 30 يوماً."
        : "Request erasure of your personal data? HR will review within 30 days.",
      confirmLabel: isAr ? "تقديم الطلب" : "Submit Request",
      cancelLabel: isAr ? "إلغاء" : "Cancel",
      variant: "danger",
    });
    if (!ok) return;

    setErasureSending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast.error(isAr ? "الجلسة منتهية" : "Session expired");
        return;
      }
      const res = await fetch("/api/erasure-request", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success(body.message || (isAr ? "تم تقديم الطلب" : "Request filed"));
      } else {
        toast.error(body.error || (isAr ? "فشل الطلب" : "Request failed"));
      }
    } finally {
      setErasureSending(false);
    }
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: "attendance", label: isAr ? "سجل الحضور" : "Attendance history" },
    { key: "leaves", label: isAr ? "طلبات الإجازات" : "Leave requests" },
    { key: "requests", label: isAr ? "طلباتي" : "My requests" },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-headline text-3xl md:text-4xl font-extrabold text-on-surface tracking-tight">
            {isAr ? "سجلي الشخصي" : "My History"}
          </h1>
          <p className="text-sm text-on-surface-variant mt-1">
            {isAr
              ? "عرض سجل حضورك وإجازاتك وطلباتك السابقة"
              : "Browse your past attendance, leaves, and requests"}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={downloadData}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-container/40 text-primary text-sm font-bold hover:bg-primary-container/60 transition-colors"
          >
            <Icon name="download" size={18} />
            {isAr ? "تحميل بياناتي (PDPL)" : "Download my data (PDPL)"}
          </button>
          <button
            onClick={requestErasure}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-error-container/20 text-md-error text-sm font-bold hover:bg-error-container/30 transition-colors"
          >
            <Icon name="delete_forever" size={18} />
            {isAr ? "طلب حذف بياناتي" : "Request data erasure"}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="inline-flex items-center bg-surface-container rounded-full p-1 gap-1">
        {tabs.map((tb) => (
          <button
            key={tb.key}
            onClick={() => setTab(tb.key)}
            className={cn(
              "px-5 py-2 rounded-full text-sm font-bold transition-all",
              tab === tb.key
                ? "gradient-btn shadow-primary-glow"
                : "text-on-surface-variant hover:text-on-surface"
            )}
          >
            {tb.label}
          </button>
        ))}
      </div>

      {/* Date range */}
      <div className="flex items-center gap-3 bg-surface-container-high rounded-xl px-4 py-2.5 w-fit">
        <Icon name="date_range" size={20} className="text-primary" />
        <label className="text-sm font-medium text-on-surface-variant">
          {isAr ? "من" : "From"}
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="bg-transparent text-sm font-bold outline-none ms-2"
          />
        </label>
        <span className="text-on-surface-variant">—</span>
        <label className="text-sm font-medium text-on-surface-variant">
          {isAr ? "إلى" : "To"}
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="bg-transparent text-sm font-bold outline-none ms-2"
          />
        </label>
      </div>

      {/* Table */}
      <div className="bg-surface-container-lowest rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-12 text-center">
              <Icon name="progress_activity" size={36} className="text-primary animate-spin mb-2" />
              <p className="text-sm text-on-surface-variant">{isAr ? "جاري التحميل..." : "Loading..."}</p>
            </div>
          ) : tab === "attendance" ? (
            attendance.length === 0 ? (
              <p className="p-8 text-center text-sm text-on-surface-variant">{t.common.noData}</p>
            ) : (
              <table className="w-full">
                <thead className="bg-surface-container/30">
                  <tr>
                    <th className="text-start px-6 py-3 text-[10px] font-bold uppercase text-on-surface-variant">{t.common.date}</th>
                    <th className="text-start px-6 py-3 text-[10px] font-bold uppercase text-on-surface-variant">{t.att.checkIn}</th>
                    <th className="text-start px-6 py-3 text-[10px] font-bold uppercase text-on-surface-variant">{t.att.checkOut}</th>
                    <th className="text-start px-6 py-3 text-[10px] font-bold uppercase text-on-surface-variant">{t.common.status}</th>
                  </tr>
                </thead>
                <tbody>
                  {attendance.map((r) => (
                    <tr key={r.id} className="border-t border-outline-variant/20">
                      <td className="px-6 py-3 text-sm tabular-nums">{formatDate(r.date, lang)}</td>
                      <td className="px-6 py-3 text-sm tabular-nums">{r.check_in ? String(r.check_in).slice(0, 5) : "—"}</td>
                      <td className="px-6 py-3 text-sm tabular-nums">{r.check_out ? String(r.check_out).slice(0, 5) : "—"}</td>
                      <td className="px-6 py-3">
                        <Badge variant={r.status === "present" ? "success" : r.status === "late" ? "warning" : r.status === "absent" ? "destructive" : "info"}>
                          {r.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          ) : tab === "leaves" ? (
            leaves.length === 0 ? (
              <p className="p-8 text-center text-sm text-on-surface-variant">{t.common.noData}</p>
            ) : (
              <table className="w-full">
                <thead className="bg-surface-container/30">
                  <tr>
                    <th className="text-start px-6 py-3 text-[10px] font-bold uppercase text-on-surface-variant">{isAr ? "النوع" : "Type"}</th>
                    <th className="text-start px-6 py-3 text-[10px] font-bold uppercase text-on-surface-variant">{isAr ? "من" : "From"}</th>
                    <th className="text-start px-6 py-3 text-[10px] font-bold uppercase text-on-surface-variant">{isAr ? "إلى" : "To"}</th>
                    <th className="text-start px-6 py-3 text-[10px] font-bold uppercase text-on-surface-variant">{t.lev.days}</th>
                    <th className="text-start px-6 py-3 text-[10px] font-bold uppercase text-on-surface-variant">{t.common.status}</th>
                  </tr>
                </thead>
                <tbody>
                  {leaves.map((r) => {
                    const type = r.type ?? r.type_key ?? "";
                    const label = (t.lev[type as keyof typeof t.lev] as string | undefined) ?? type;
                    return (
                      <tr key={r.id} className="border-t border-outline-variant/20">
                        <td className="px-6 py-3 text-sm">{label}</td>
                        <td className="px-6 py-3 text-sm tabular-nums">{formatDate(r.start_date, lang)}</td>
                        <td className="px-6 py-3 text-sm tabular-nums">{formatDate(r.end_date, lang)}</td>
                        <td className="px-6 py-3 text-sm tabular-nums">{r.days}</td>
                        <td className="px-6 py-3">
                          <Badge variant={r.status === "approved" ? "success" : r.status === "rejected" ? "destructive" : "warning"}>
                            {r.status}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )
          ) : (
            requests.length === 0 ? (
              <p className="p-8 text-center text-sm text-on-surface-variant">{t.common.noData}</p>
            ) : (
              <table className="w-full">
                <thead className="bg-surface-container/30">
                  <tr>
                    <th className="text-start px-6 py-3 text-[10px] font-bold uppercase text-on-surface-variant">{t.common.type}</th>
                    <th className="text-start px-6 py-3 text-[10px] font-bold uppercase text-on-surface-variant">{t.common.date}</th>
                    <th className="text-start px-6 py-3 text-[10px] font-bold uppercase text-on-surface-variant">{t.req.details}</th>
                    <th className="text-start px-6 py-3 text-[10px] font-bold uppercase text-on-surface-variant">{t.common.status}</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((r) => {
                    const typeLabel = (t.requestTypes[r.type_key as keyof typeof t.requestTypes] as string | undefined) ?? r.type_key;
                    return (
                      <tr key={r.id} className="border-t border-outline-variant/20">
                        <td className="px-6 py-3 text-sm">{typeLabel}</td>
                        <td className="px-6 py-3 text-sm tabular-nums">{formatDate(r.date, lang)}</td>
                        <td className="px-6 py-3 text-sm text-on-surface-variant truncate max-w-xs">{isAr ? r.details_ar : r.details_en}</td>
                        <td className="px-6 py-3">
                          <Badge variant={r.status === "approved" ? "success" : r.status === "rejected" ? "destructive" : "warning"}>
                            {r.status}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )
          )}
        </div>
      </div>
    </div>
  );
}
