"use client";

import { useState, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useLanguage, useAuth } from "@/components/providers";
import { useData } from "@/lib/data-store";
import type { Employee } from "@/lib/mock-data";
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
import type { RequestsSlice } from "@/lib/data/server";

const statusBadgeVariant: Record<string, "warning" | "info" | "success" | "destructive"> = {
  pending: "warning",
  "in-review": "info",
  approved: "success",
  rejected: "destructive",
};

const typeConfig: Record<string, { iconName: string; bg: string; icon: string }> = {
  leaveRequest: { iconName: "event_busy", bg: "bg-blue-500/15", icon: "text-blue-600 dark:text-blue-400" },
  salaryCert: { iconName: "workspace_premium", bg: "bg-emerald-500/15", icon: "text-emerald-600 dark:text-emerald-400" },
  permission: { iconName: "description", bg: "bg-amber-500/15", icon: "text-amber-600 dark:text-amber-400" },
  docRequest: { iconName: "article", bg: "bg-tertiary-container/40", icon: "text-tertiary" },
  attendanceAdjust: { iconName: "edit_calendar", bg: "bg-cyan-500/15", icon: "text-cyan-600 dark:text-cyan-400" },
  salaryAdvance: { iconName: "payments", bg: "bg-primary-container/40", icon: "text-primary" },
};

const typeKeys = ["leaveRequest", "salaryCert", "permission", "docRequest", "attendanceAdjust", "salaryAdvance"] as const;
const statusKeys = ["pending", "in-review", "approved", "rejected"] as const;

interface UnifiedRequest {
  id: string;
  employeeId: string;
  typeKey: string;
  subTypeKey?: string;   // e.g. for leaves: "annual" | "sick" | "unpaid" | "marriage" | "paternity"
  date: string;
  endDate?: string;      // for leaves (date range)
  status: string;
  detailsAr: string;
  detailsEn: string;
}

export function RequestsView({ initialSlice }: { initialSlice: RequestsSlice }) {
  useDataHydration(initialSlice);
  const { t, lang } = useLanguage();
  const { isAdmin, user } = useAuth();
  const store = useData();
  const { initialLoaded } = store;
  const isAr = lang === "ar";
  const searchParams = useSearchParams();

  // Initialize filters from URL query params (e.g. /requests?status=pending&type=leaveRequest)
  const [typeFilter, setTypeFilter] = useState<string>(
    () => searchParams?.get("type") || "all"
  );
  const [statusFilter, setStatusFilter] = useState<string>(
    () => searchParams?.get("status") || "all"
  );
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newReqType, setNewReqType] = useState<string>("leaveRequest");
  const [newReqDesc, setNewReqDesc] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const [adjDate, setAdjDate] = useState("");
  const [adjOriginalIn, setAdjOriginalIn] = useState("");
  const [adjRequestedIn, setAdjRequestedIn] = useState("");
  const [adjOriginalOut, setAdjOriginalOut] = useState("");
  const [adjRequestedOut, setAdjRequestedOut] = useState("");

  const [advAmount, setAdvAmount] = useState<number>(0);
  const [advRepaymentMonths, setAdvRepaymentMonths] = useState<number>(3);

  const calculatedMonthlyDeduction = useMemo(() => {
    if (advAmount <= 0 || advRepaymentMonths <= 0) return 0;
    return Math.ceil(advAmount / advRepaymentMonths);
  }, [advAmount, advRepaymentMonths]);

  const employees = store.employees;
  const getEmployee = (id: string) => employees.find((e: Employee) => e.id === id || e.email === id);
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

  const allRequests: UnifiedRequest[] = useMemo(() => {
    const base: UnifiedRequest[] = store.employeeRequests.map((r) => ({
      id: r.id, employeeId: r.employeeId, typeKey: r.typeKey, date: r.date, status: r.status, detailsAr: r.detailsAr, detailsEn: r.detailsEn,
    }));
    const adjMapped: UnifiedRequest[] = store.attendanceAdjustments.map((a) => ({
      id: a.id, employeeId: a.employeeId, typeKey: "attendanceAdjust", date: a.date, status: a.status,
      detailsAr: "تعديل حضور — " + a.originalIn + " → " + a.requestedIn,
      detailsEn: "Adjustment — " + a.originalIn + " → " + a.requestedIn,
    }));
    const advMapped: UnifiedRequest[] = store.salaryAdvances.map((s) => ({
      id: s.id, employeeId: s.employeeId, typeKey: "salaryAdvance", date: s.requestDate, status: s.status,
      detailsAr: s.amount.toLocaleString() + " ر.س",
      detailsEn: s.amount.toLocaleString() + " SAR",
    }));
    const leaveMapped: UnifiedRequest[] = store.leaveRequests.map((lr) => ({
      id: lr.id,
      employeeId: lr.employeeId,
      typeKey: "leaveRequest",
      subTypeKey: lr.typeKey,    // "annual" | "sick" | "unpaid" | "marriage" | "paternity"
      date: lr.startDate,
      endDate: lr.endDate,
      status: lr.status,
      detailsAr: lr.reasonAr || (lr.days + " أيام"),
      detailsEn: lr.reasonEn || (lr.days + " days"),
    }));
    const combined = [...base, ...adjMapped, ...advMapped, ...leaveMapped];
    combined.sort((a, b) => (a.date > b.date ? -1 : a.date < b.date ? 1 : 0));
    return combined;
  }, [store.employeeRequests, store.attendanceAdjustments, store.salaryAdvances, store.leaveRequests]);

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const key of typeKeys) {
      counts[key] = allRequests.filter((r) => r.typeKey === key).length;
    }
    return counts;
  }, [allRequests]);

  // Filter by role + type only (status is handled by splitting into 3 sections)
  const filteredByTypeAndRole = useMemo(() => {
    let list = allRequests;
    if (!isAdmin) {
      list = list.filter((req) => req.employeeId === user.id || req.employeeId === user.email);
    }
    if (typeFilter !== "all") {
      list = list.filter((req) => req.typeKey === typeFilter);
    }
    return list;
  }, [allRequests, typeFilter, isAdmin, user.email, user.id]);

  // Split into 3 sections by status (already sorted newest-first via allRequests)
  const pendingRequests = useMemo(
    () => filteredByTypeAndRole.filter((r) => r.status === "pending" || r.status === "in-review"),
    [filteredByTypeAndRole]
  );
  const approvedRequests = useMemo(
    () => filteredByTypeAndRole.filter((r) => r.status === "approved"),
    [filteredByTypeAndRole]
  );
  const rejectedRequests = useMemo(
    () => filteredByTypeAndRole.filter((r) => r.status === "rejected"),
    [filteredByTypeAndRole]
  );

  // Which sections to show based on statusFilter (from URL or dropdown)
  const showPending = statusFilter === "all" || statusFilter === "pending" || statusFilter === "in-review";
  const showApproved = statusFilter === "all" || statusFilter === "approved";
  const showRejected = statusFilter === "all" || statusFilter === "rejected";

  const resetForm = () => {
    setNewReqType("leaveRequest");
    setNewReqDesc("");
    setAdjDate(""); setAdjOriginalIn(""); setAdjRequestedIn(""); setAdjOriginalOut(""); setAdjRequestedOut("");
    setAdvAmount(0); setAdvRepaymentMonths(3);
  };

  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitError("");
    setSubmitting(true);
    const today = new Date().toISOString().split("T")[0];
    try {
      if (newReqType === "attendanceAdjust") {
        await store.submitAdjustment({
          employeeId: user.id, date: adjDate || today,
          originalIn: adjOriginalIn, requestedIn: adjRequestedIn,
          originalOut: adjOriginalOut, requestedOut: adjRequestedOut,
          reasonAr: newReqDesc, reasonEn: newReqDesc, status: "pending",
        });
      } else if (newReqType === "salaryAdvance") {
        await store.submitAdvance({
          employeeId: user.id, amount: advAmount,
          reasonAr: newReqDesc, reasonEn: newReqDesc,
          requestDate: today, status: "pending",
          repaymentMonths: advRepaymentMonths,
          monthlyDeduction: calculatedMonthlyDeduction,
          remainingBalance: advAmount, paidMonths: 0,
        });
      } else {
        await store.submitEmployeeRequest({
          employeeId: user.id, typeKey: newReqType, date: today, status: "pending",
          detailsAr: newReqDesc, detailsEn: newReqDesc,
        });
      }
    } catch (error) {
      console.error("[HR] request submission failed:", error);
      setSubmitError(isAr ? "فشل إرسال الطلب. حاول مرة أخرى." : "Failed to submit request. Please try again.");
      setSubmitting(false);
      return;
    }
    store.addNotification({
      type: "system",
      titleAr: "تم إرسال الطلب",
      titleEn: "Request Submitted",
      descAr: "سيتم مراجعة طلبك من قبل المسؤول",
      descEn: "Your request will be reviewed by the administrator",
      time: 0,
      read: false,
    });
    setSubmitting(false);
    setDialogOpen(false);
    resetForm();
  };

  const getStatusLabel = (status: string) => {
    if (status === "in-review") return t.statuses["in-review"];
    return t.statuses[status as keyof typeof t.statuses];
  };

  const typeSelectLabels: Record<string, string> = {
    leaveRequest: t.req.leaveReq, salaryCert: t.req.salaryCert, permission: t.req.permission,
    docRequest: t.req.docRequest, attendanceAdjust: t.requestTypes.attendanceAdjust, salaryAdvance: t.requestTypes.salaryAdvance,
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-headline text-3xl md:text-4xl font-extrabold text-on-surface tracking-tight">
            {t.req.title}
          </h1>
          <p className="text-sm text-on-surface-variant mt-2">{t.req.myRequests}</p>
        </div>
        <Button size="lg" onClick={() => setDialogOpen(true)}>
          <Icon name="add" size={20} />
          {t.req.newRequest}
        </Button>
      </div>

      {/* Category cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {typeKeys.map((key) => {
          const config = typeConfig[key];
          return (
            <div key={key} className="bg-surface-container-lowest p-5 rounded-2xl shadow-sm hover:shadow-primary-glow-lg transition-all group">
              <div className="flex items-center gap-4">
                <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform", config.bg, config.icon)}>
                  <Icon name={config.iconName} size={26} fill />
                </div>
                <div className="min-w-0">
                  <p className="font-headline text-3xl font-black text-on-surface tabular-nums min-h-[36px]">
                    {initialLoaded ? typeCounts[key] : <span className="inline-block w-12 h-7 rounded-lg bg-surface-container-highest animate-pulse align-middle" />}
                  </p>
                  <p className="text-sm text-on-surface-variant truncate font-medium">
                    {t.requestTypes[key as keyof typeof t.requestTypes]}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="flex items-center gap-2 text-on-surface-variant">
          <Icon name="filter_list" size={18} />
          <span className="text-sm font-bold">{t.common.filter}:</span>
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="h-10 rounded-xl bg-surface-container-high px-4 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/40"
        >
          <option value="all">{t.req.allTypes}</option>
          {typeKeys.map((key) => (
            <option key={key} value={key}>{t.requestTypes[key]}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-10 rounded-xl bg-surface-container-high px-4 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/40"
        >
          <option value="all">{t.common.all}</option>
          {statusKeys.map((key) => (
            <option key={key} value={key}>{getStatusLabel(key)}</option>
          ))}
        </select>
      </div>

      {/* Section renderer */}
      {(() => {
        const renderSection = (
          titleAr: string,
          titleEn: string,
          accentClass: string,
          countBadgeVariant: "warning" | "success" | "destructive",
          iconName: string,
          requests: UnifiedRequest[],
          showActions: boolean
        ) => (
          <div className="bg-surface-container-lowest rounded-2xl shadow-sm overflow-hidden">
            {/* Section header */}
            <div className="flex items-center justify-between px-6 py-4">
              <div className="flex items-center gap-3">
                <span className={cn("w-1.5 h-7 rounded-full", accentClass)} />
                <Icon name={iconName} size={22} className="text-on-surface-variant" />
                <h3 className="font-headline font-bold text-xl">{isAr ? titleAr : titleEn}</h3>
                <Badge variant={countBadgeVariant}>
                  {requests.length}
                </Badge>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px]">
                <thead>
                  <tr className="bg-surface-container/30">
                    <th className="text-start px-6 py-3 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">{t.req.requestNo}</th>
                    <th className="text-start px-6 py-3 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">{t.common.name}</th>
                    <th className="text-start px-6 py-3 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">{t.common.type}</th>
                    <th className="text-start px-6 py-3 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">{t.common.date}</th>
                    <th className="text-start px-6 py-3 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">{t.req.details}</th>
                    {showActions && isAdmin && <th className="text-start px-6 py-3 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">{t.common.actions}</th>}
                  </tr>
                </thead>
                <tbody>
                  {requests.length === 0 ? (
                    <tr>
                      <td colSpan={showActions && isAdmin ? 6 : 5} className="py-10 text-center text-on-surface-variant">
                        <Icon name="inbox" size={36} className="mb-2 opacity-40" />
                        <p className="text-sm font-medium">{t.common.noData}</p>
                      </td>
                    </tr>
                  ) : (
                    requests.map((req) => {
                      const emp = resolveEmployee(req.employeeId);
                      const tconfig = typeConfig[req.typeKey];
                      // Short display ID: first 8 chars of UUID (full in title tooltip)
                      const shortId = req.id.length > 8 ? req.id.slice(0, 8).toUpperCase() : req.id.toUpperCase();
                      // Type label: for leaves, show sub-type (annual/sick/etc.); else main type
                      const typeLabel = req.subTypeKey
                        ? (t.lev[req.subTypeKey as keyof typeof t.lev] as string | undefined) ?? t.requestTypes[req.typeKey as keyof typeof t.requestTypes]
                        : t.requestTypes[req.typeKey as keyof typeof t.requestTypes];
                      return (
                        <tr key={req.id} className="hover:bg-surface-container-low transition-colors">
                          <td className="px-6 py-4 text-xs font-mono text-on-surface-variant font-bold" title={req.id}>
                            {shortId}
                          </td>
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
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              {tconfig && <Icon name={tconfig.iconName} size={18} className={tconfig.icon} />}
                              <span className="text-sm font-medium">{typeLabel}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-on-surface-variant tabular-nums font-medium whitespace-nowrap">
                            {req.endDate && req.endDate !== req.date ? (
                              <span dir="ltr" className="inline-flex items-center gap-1">
                                {req.date}
                                <Icon name="arrow_forward" size={14} className="opacity-60" />
                                {req.endDate}
                              </span>
                            ) : (
                              req.date
                            )}
                          </td>
                          <td className="px-6 py-4 text-sm text-on-surface-variant max-w-[200px] truncate">
                            {isAr ? req.detailsAr : req.detailsEn}
                          </td>
                          {showActions && isAdmin && (
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={async () => {
                                    if (!confirm(isAr ? "هل أنت متأكد من الموافقة على هذا الطلب؟" : "Are you sure you want to approve this request?")) return;
                                    try {
                                      if (req.typeKey === "leaveRequest" && store.leaveRequests.some((lr) => lr.id === req.id)) {
                                        await store.approveLeaveRequest(req.id);
                                      } else {
                                        const collection =
                                          req.typeKey === "attendanceAdjust" ? "attendanceAdjustments" as const
                                          : req.typeKey === "salaryAdvance" ? "salaryAdvances" as const
                                          : "employeeRequests" as const;
                                        await store.approveItem(collection, req.id);
                                      }
                                    } catch (e) {
                                      console.error("[HR] approve failed:", e);
                                      alert(isAr ? "فشل تنفيذ الإجراء" : "Action failed");
                                    }
                                  }}
                                  className="p-2 rounded-full text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/15 transition-colors"
                                  title={isAr ? "موافقة" : "Approve"}
                                  aria-label={isAr ? "موافقة" : "Approve"}
                                >
                                  <Icon name="check_circle" size={18} fill />
                                </button>
                                <button
                                  onClick={async () => {
                                    if (!confirm(isAr ? "هل أنت متأكد من رفض هذا الطلب؟" : "Are you sure you want to reject this request?")) return;
                                    try {
                                      if (req.typeKey === "leaveRequest" && store.leaveRequests.some((lr) => lr.id === req.id)) {
                                        await store.rejectLeaveRequest(req.id);
                                      } else {
                                        const collection =
                                          req.typeKey === "attendanceAdjust" ? "attendanceAdjustments" as const
                                          : req.typeKey === "salaryAdvance" ? "salaryAdvances" as const
                                          : "employeeRequests" as const;
                                        await store.rejectItem(collection, req.id);
                                      }
                                    } catch (e) {
                                      console.error("[HR] reject failed:", e);
                                      alert(isAr ? "فشل تنفيذ الإجراء" : "Action failed");
                                    }
                                  }}
                                  className="p-2 rounded-full text-md-error hover:bg-error-container/20 transition-colors"
                                  title={isAr ? "رفض" : "Reject"}
                                  aria-label={isAr ? "رفض" : "Reject"}
                                >
                                  <Icon name="cancel" size={18} fill />
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );

        return (
          <div className="space-y-6">
            {showPending && renderSection(
              "يحتاج إجراء", "Needs Action",
              "bg-amber-500", "warning",
              "pending_actions",
              pendingRequests,
              true // show approve/reject buttons
            )}
            {showApproved && renderSection(
              "الموافَق عليها", "Approved",
              "bg-emerald-500", "success",
              "check_circle",
              approvedRequests,
              false
            )}
            {showRejected && renderSection(
              "المرفوضة", "Rejected",
              "bg-md-error", "destructive",
              "cancel",
              rejectedRequests,
              false
            )}
          </div>
        );
      })()}

      {/* New Request Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t.req.newRequest}</DialogTitle>
            <DialogDescription>{t.req.myRequests}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-bold">{t.req.requestType}</label>
              <select
                value={newReqType}
                onChange={(e) => setNewReqType(e.target.value)}
                className="w-full h-11 rounded-xl bg-surface-container-high px-4 text-sm outline-none focus:ring-2 focus:ring-primary/40"
              >
                {typeKeys.map((key) => (
                  <option key={key} value={key}>{typeSelectLabels[key]}</option>
                ))}
              </select>
            </div>

            {newReqType === "attendanceAdjust" && (
              <>
                <div className="space-y-1.5">
                  <label className="text-sm font-bold">{t.common.date}</label>
                  <input
                    type="date"
                    value={adjDate}
                    onChange={(e) => setAdjDate(e.target.value)}
                    className="h-11 w-full rounded-xl bg-surface-container-high px-4 text-sm outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-sm font-bold">{t.clock.originalTime} ({t.att.checkIn})</label>
                    <input type="time" value={adjOriginalIn} onChange={(e) => setAdjOriginalIn(e.target.value)} className="h-11 w-full rounded-xl bg-surface-container-high px-4 text-sm outline-none focus:ring-2 focus:ring-primary/40" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-bold">{t.clock.requestedTime} ({t.att.checkIn})</label>
                    <input type="time" value={adjRequestedIn} onChange={(e) => setAdjRequestedIn(e.target.value)} className="h-11 w-full rounded-xl bg-surface-container-high px-4 text-sm outline-none focus:ring-2 focus:ring-primary/40" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-sm font-bold">{t.clock.originalTime} ({t.att.checkOut})</label>
                    <input type="time" value={adjOriginalOut} onChange={(e) => setAdjOriginalOut(e.target.value)} className="h-11 w-full rounded-xl bg-surface-container-high px-4 text-sm outline-none focus:ring-2 focus:ring-primary/40" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-bold">{t.clock.requestedTime} ({t.att.checkOut})</label>
                    <input type="time" value={adjRequestedOut} onChange={(e) => setAdjRequestedOut(e.target.value)} className="h-11 w-full rounded-xl bg-surface-container-high px-4 text-sm outline-none focus:ring-2 focus:ring-primary/40" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-bold">{t.clock.adjustmentReason}</label>
                  <textarea
                    value={newReqDesc}
                    onChange={(e) => setNewReqDesc(e.target.value)}
                    rows={3}
                    placeholder={isAr ? "اكتب سبب طلب التعديل..." : "Enter reason for adjustment..."}
                    className="w-full rounded-xl bg-surface-container-high px-4 py-3 text-sm outline-none resize-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>
              </>
            )}

            {newReqType === "salaryAdvance" && (
              <>
                <div className="space-y-1.5">
                  <label className="text-sm font-bold">{t.advance.amount} ({t.common.sar})</label>
                  <input
                    type="number"
                    min={0}
                    value={advAmount || ""}
                    onChange={(e) => setAdvAmount(Number(e.target.value))}
                    placeholder={isAr ? "أدخل المبلغ" : "Enter amount"}
                    className="h-11 w-full rounded-xl bg-surface-container-high px-4 text-sm outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-bold">{t.advance.repaymentMonths}</label>
                  <select
                    value={advRepaymentMonths}
                    onChange={(e) => setAdvRepaymentMonths(Number(e.target.value))}
                    className="w-full h-11 rounded-xl bg-surface-container-high px-4 text-sm outline-none focus:ring-2 focus:ring-primary/40"
                  >
                    {[2, 3, 4, 5, 6].map((m) => (
                      <option key={m} value={m}>{m} {isAr ? "أشهر" : "months"}</option>
                    ))}
                  </select>
                </div>
                {advAmount > 0 && (
                  <div className="rounded-2xl bg-primary-container/20 p-4 space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-on-surface-variant font-medium">{t.advance.monthlyDeduction}</span>
                      <span className="font-bold tabular-nums">
                        {calculatedMonthlyDeduction.toLocaleString()} {t.common.sar}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-on-surface-variant font-medium">{t.advance.remainingBalance}</span>
                      <span className="font-bold tabular-nums">
                        {advAmount.toLocaleString()} {t.common.sar}
                      </span>
                    </div>
                  </div>
                )}
                <div className="space-y-1.5">
                  <label className="text-sm font-bold">{t.req.description}</label>
                  <textarea
                    value={newReqDesc}
                    onChange={(e) => setNewReqDesc(e.target.value)}
                    rows={3}
                    placeholder={isAr ? "اكتب سبب طلب السلفة..." : "Enter reason for advance..."}
                    className="w-full rounded-xl bg-surface-container-high px-4 py-3 text-sm outline-none resize-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>
              </>
            )}

            {newReqType !== "attendanceAdjust" && newReqType !== "salaryAdvance" && (
              <div className="space-y-1.5">
                <label className="text-sm font-bold">{t.req.description}</label>
                <textarea
                  value={newReqDesc}
                  onChange={(e) => setNewReqDesc(e.target.value)}
                  rows={4}
                  placeholder={isAr ? "اكتب تفاصيل الطلب..." : "Enter request details..."}
                  className="w-full rounded-xl bg-surface-container-high px-4 py-3 text-sm outline-none resize-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
            )}
            {submitError && (
              <p className="text-sm text-md-error font-bold flex items-center gap-2" role="alert">
                <Icon name="error" size={16} fill />
                {submitError}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={submitting}>
              {t.common.cancel}
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting && <Icon name="progress_activity" size={18} className="animate-spin" />}
              {submitting ? (isAr ? "جاري الإرسال..." : "Submitting...") : t.req.submitRequest}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
