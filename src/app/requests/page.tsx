"use client";

import { useState, useMemo } from "react";
import { useLanguage, useAuth } from "@/components/providers";
import { useData } from "@/lib/data-store";
import { employees } from "@/lib/mock-data";
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
  FileText,
  Award,
  Clock,
  File,
  Filter,
  CalendarClock,
  Banknote,
  CheckCircle,
  XCircle,
} from "lucide-react";

const statusStyles: Record<string, string> = {
  pending:
    "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-400 border-0",
  "in-review":
    "bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-400 border-0",
  approved:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-400 border-0",
  rejected:
    "bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-400 border-0",
};

const typeIcons: Record<string, typeof FileText> = {
  leaveRequest: Clock,
  salaryCert: Award,
  permission: FileText,
  docRequest: File,
  attendanceAdjust: CalendarClock,
  salaryAdvance: Banknote,
};

const typeColors: Record<string, { bg: string; text: string; icon: string }> = {
  leaveRequest: {
    bg: "bg-blue-100 dark:bg-blue-500/15",
    text: "text-blue-700 dark:text-blue-400",
    icon: "text-blue-600 dark:text-blue-400",
  },
  salaryCert: {
    bg: "bg-emerald-100 dark:bg-emerald-500/15",
    text: "text-emerald-700 dark:text-emerald-400",
    icon: "text-emerald-600 dark:text-emerald-400",
  },
  permission: {
    bg: "bg-amber-100 dark:bg-amber-500/15",
    text: "text-amber-700 dark:text-amber-400",
    icon: "text-amber-600 dark:text-amber-400",
  },
  docRequest: {
    bg: "bg-purple-100 dark:bg-purple-500/15",
    text: "text-purple-700 dark:text-purple-400",
    icon: "text-purple-600 dark:text-purple-400",
  },
  attendanceAdjust: {
    bg: "bg-teal-100 dark:bg-teal-500/15",
    text: "text-teal-700 dark:text-teal-400",
    icon: "text-teal-600 dark:text-teal-400",
  },
  salaryAdvance: {
    bg: "bg-violet-100 dark:bg-violet-500/15",
    text: "text-violet-700 dark:text-violet-400",
    icon: "text-violet-600 dark:text-violet-400",
  },
};

const typeKeys = [
  "leaveRequest",
  "salaryCert",
  "permission",
  "docRequest",
  "attendanceAdjust",
  "salaryAdvance",
] as const;
const statusKeys = ["pending", "in-review", "approved", "rejected"] as const;

interface UnifiedRequest {
  id: string;
  employeeId: string;
  typeKey: string;
  date: string;
  status: string;
  detailsAr: string;
  detailsEn: string;
}

export default function RequestsPage() {
  const { t, lang } = useLanguage();
  const { isAdmin } = useAuth();
  const store = useData();
  const isAr = lang === "ar";

  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newReqType, setNewReqType] = useState<string>("leaveRequest");
  const [newReqDesc, setNewReqDesc] = useState("");

  // Attendance adjustment form state
  const [adjDate, setAdjDate] = useState("");
  const [adjOriginalIn, setAdjOriginalIn] = useState("");
  const [adjRequestedIn, setAdjRequestedIn] = useState("");
  const [adjOriginalOut, setAdjOriginalOut] = useState("");
  const [adjRequestedOut, setAdjRequestedOut] = useState("");

  // Salary advance form state
  const [advAmount, setAdvAmount] = useState<number>(0);
  const [advRepaymentMonths, setAdvRepaymentMonths] = useState<number>(3);

  const calculatedMonthlyDeduction = useMemo(() => {
    if (advAmount <= 0 || advRepaymentMonths <= 0) return 0;
    return Math.ceil(advAmount / advRepaymentMonths);
  }, [advAmount, advRepaymentMonths]);

  const getEmployee = (id: string) => employees.find((e) => e.id === id);

  // Build unified requests list
  const allRequests: UnifiedRequest[] = useMemo(() => {
    const base: UnifiedRequest[] = store.employeeRequests.map((r) => ({
      id: r.id,
      employeeId: r.employeeId,
      typeKey: r.typeKey,
      date: r.date,
      status: r.status,
      detailsAr: r.detailsAr,
      detailsEn: r.detailsEn,
    }));

    const adjMapped: UnifiedRequest[] = store.attendanceAdjustments.map((a) => ({
      id: a.id,
      employeeId: a.employeeId,
      typeKey: "attendanceAdjust",
      date: a.date,
      status: a.status,
      detailsAr: "تعديل حضور — " + a.originalIn + " → " + a.requestedIn,
      detailsEn: "Adjustment — " + a.originalIn + " → " + a.requestedIn,
    }));

    const advMapped: UnifiedRequest[] = store.salaryAdvances.map((s) => ({
      id: s.id,
      employeeId: s.employeeId,
      typeKey: "salaryAdvance",
      date: s.requestDate,
      status: s.status,
      detailsAr: s.amount.toLocaleString() + " ر.س",
      detailsEn: s.amount.toLocaleString() + " SAR",
    }));

    const combined = [...base, ...adjMapped, ...advMapped];
    combined.sort((a, b) => (a.date > b.date ? -1 : a.date < b.date ? 1 : 0));
    return combined;
  }, [store.employeeRequests, store.attendanceAdjustments, store.salaryAdvances]);

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const key of typeKeys) {
      counts[key] = allRequests.filter((r) => r.typeKey === key).length;
    }
    return counts;
  }, [allRequests]);

  const filteredRequests = useMemo(() => {
    let list = allRequests;

    // Role-based filtering: non-admin sees only their own requests (EMP003 as mock)
    if (!isAdmin) {
      list = list.filter((req) => req.employeeId === "EMP003");
    }

    return list.filter((req) => {
      if (typeFilter !== "all" && req.typeKey !== typeFilter) return false;
      if (statusFilter !== "all" && req.status !== statusFilter) return false;
      return true;
    });
  }, [allRequests, typeFilter, statusFilter, isAdmin]);

  const resetForm = () => {
    setNewReqType("leaveRequest");
    setNewReqDesc("");
    setAdjDate("");
    setAdjOriginalIn("");
    setAdjRequestedIn("");
    setAdjOriginalOut("");
    setAdjRequestedOut("");
    setAdvAmount(0);
    setAdvRepaymentMonths(3);
  };

  const handleSubmit = () => {
    const today = new Date().toISOString().split("T")[0];

    if (newReqType === "attendanceAdjust") {
      store.submitAdjustment({
        employeeId: "EMP001",
        date: adjDate || today,
        originalIn: adjOriginalIn,
        requestedIn: adjRequestedIn,
        originalOut: adjOriginalOut,
        requestedOut: adjRequestedOut,
        reasonAr: newReqDesc,
        reasonEn: newReqDesc,
        status: "pending",
      });
    } else if (newReqType === "salaryAdvance") {
      store.submitAdvance({
        employeeId: "EMP001",
        amount: advAmount,
        reasonAr: newReqDesc,
        reasonEn: newReqDesc,
        requestDate: today,
        status: "pending",
        repaymentMonths: advRepaymentMonths,
        monthlyDeduction: calculatedMonthlyDeduction,
        remainingBalance: advAmount,
        paidMonths: 0,
      });
    } else {
      store.submitEmployeeRequest({
        employeeId: "EMP001",
        typeKey: newReqType,
        date: today,
        status: "pending",
        detailsAr: newReqDesc,
        detailsEn: newReqDesc,
      });
    }

    setDialogOpen(false);
    resetForm();
  };

  const categoryCards = typeKeys.map((key) => {
    const Icon = typeIcons[key];
    const colors = typeColors[key];
    return { key, Icon, colors, count: typeCounts[key] };
  });

  const getStatusLabel = (status: string) => {
    if (status === "in-review") {
      return t.statuses["in-review"];
    }
    return t.statuses[status as keyof typeof t.statuses];
  };

  const typeSelectLabels: Record<string, string> = {
    leaveRequest: t.req.leaveReq,
    salaryCert: t.req.salaryCert,
    permission: t.req.permission,
    docRequest: t.req.docRequest,
    attendanceAdjust: t.requestTypes.attendanceAdjust,
    salaryAdvance: t.requestTypes.salaryAdvance,
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t.req.title}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t.req.myRequests}</p>
        </div>
        <Button size="lg" onClick={() => setDialogOpen(true)}>
          <Plus className="w-4 h-4" />
          {t.req.newRequest}
        </Button>
      </div>

      {/* Category Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {categoryCards.map(({ key, Icon, colors, count }) => (
          <div
            key={key}
            className="accent-card hover-lift rounded-xl p-4 cursor-default"
          >
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center",
                  colors.bg
                )}
              >
                <Icon className={cn("w-5 h-5", colors.icon)} />
              </div>
              <div className="min-w-0">
                <p className="text-2xl font-bold text-foreground">{count}</p>
                <p className="text-sm text-muted-foreground truncate">
                  {t.requestTypes[key as keyof typeof t.requestTypes]}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="h-9 rounded-lg border border-border bg-card px-3 text-sm outline-none"
        >
          <option value="all">{t.req.allTypes}</option>
          {typeKeys.map((key) => (
            <option key={key} value={key}>
              {t.requestTypes[key]}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-9 rounded-lg border border-border bg-card px-3 text-sm outline-none"
        >
          <option value="all">{t.common.all}</option>
          {statusKeys.map((key) => (
            <option key={key} value={key}>
              {getStatusLabel(key)}
            </option>
          ))}
        </select>
      </div>

      {/* Requests Table */}
      <div className="glass-card rounded-xl p-5 lg:p-6">
        <div className="overflow-x-auto -mx-5 lg:-mx-6 px-5 lg:px-6">
          <table className="w-full min-w-[700px]">
            <thead>
              <tr className="text-xs text-muted-foreground border-b border-border">
                <th className="text-start pb-3 font-medium">{t.req.requestNo}</th>
                <th className="text-start pb-3 font-medium">{t.common.name}</th>
                <th className="text-start pb-3 font-medium">{t.common.type}</th>
                <th className="text-start pb-3 font-medium">{t.common.date}</th>
                <th className="text-start pb-3 font-medium">{t.common.status}</th>
                <th className="text-start pb-3 font-medium">{t.req.details}</th>
                {isAdmin && <th className="text-start pb-3 font-medium">{t.common.actions}</th>}
              </tr>
            </thead>
            <tbody>
              {filteredRequests.length === 0 ? (
                <tr>
                  <td
                    colSpan={isAdmin ? 7 : 6}
                    className="py-8 text-center text-sm text-muted-foreground"
                  >
                    {t.common.noData}
                  </td>
                </tr>
              ) : (
                filteredRequests.map((req) => {
                  const emp = getEmployee(req.employeeId);
                  if (!emp) return null;
                  return (
                    <tr
                      key={req.id}
                      className="border-b border-border/50 last:border-0 hover:bg-accent/30 transition-colors"
                    >
                      <td className="py-3 text-sm font-mono text-muted-foreground">
                        {req.id}
                      </td>
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
                      <td className="py-3 text-sm text-muted-foreground">
                        {t.requestTypes[req.typeKey as keyof typeof t.requestTypes]}
                      </td>
                      <td className="py-3 text-sm text-muted-foreground">
                        {req.date}
                      </td>
                      <td className="py-3">
                        <Badge
                          className={cn(
                            "text-[11px] font-medium",
                            statusStyles[req.status]
                          )}
                        >
                          {getStatusLabel(req.status)}
                        </Badge>
                      </td>
                      <td className="py-3 text-sm text-muted-foreground max-w-[200px] truncate">
                        {isAr ? req.detailsAr : req.detailsEn}
                      </td>
                      {isAdmin && (
                        <td className="py-3">
                          {(req.status === "pending" || req.status === "in-review") && (
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-500/10"
                                onClick={() => {
                                  const collection =
                                    req.typeKey === "attendanceAdjust"
                                      ? "attendanceAdjustments"
                                      : req.typeKey === "salaryAdvance"
                                        ? "salaryAdvances"
                                        : "employeeRequests";
                                  store.approveItem(collection, req.id);
                                }}
                              >
                                <CheckCircle className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
                                onClick={() => {
                                  const collection =
                                    req.typeKey === "attendanceAdjust"
                                      ? "attendanceAdjustments"
                                      : req.typeKey === "salaryAdvance"
                                        ? "salaryAdvances"
                                        : "employeeRequests";
                                  store.rejectItem(collection, req.id);
                                }}
                              >
                                <XCircle className="w-4 h-4" />
                              </Button>
                            </div>
                          )}
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

      {/* New Request Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t.req.newRequest}</DialogTitle>
            <DialogDescription>{t.req.myRequests}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Request type selector */}
            <div className="space-y-2">
              <label className="text-sm font-medium">{t.req.requestType}</label>
              <select
                value={newReqType}
                onChange={(e) => setNewReqType(e.target.value)}
                className="w-full h-9 rounded-lg border border-border bg-card px-3 text-sm outline-none"
              >
                {typeKeys.map((key) => (
                  <option key={key} value={key}>
                    {typeSelectLabels[key]}
                  </option>
                ))}
              </select>
            </div>

            {/* Attendance Adjustment form fields */}
            {newReqType === "attendanceAdjust" && (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t.common.date}</label>
                  <input
                    type="date"
                    value={adjDate}
                    onChange={(e) => setAdjDate(e.target.value)}
                    className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-primary"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      {t.clock.originalTime} ({t.att.checkIn})
                    </label>
                    <input
                      type="time"
                      value={adjOriginalIn}
                      onChange={(e) => setAdjOriginalIn(e.target.value)}
                      className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-primary"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      {t.clock.requestedTime} ({t.att.checkIn})
                    </label>
                    <input
                      type="time"
                      value={adjRequestedIn}
                      onChange={(e) => setAdjRequestedIn(e.target.value)}
                      className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-primary"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      {t.clock.originalTime} ({t.att.checkOut})
                    </label>
                    <input
                      type="time"
                      value={adjOriginalOut}
                      onChange={(e) => setAdjOriginalOut(e.target.value)}
                      className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-primary"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      {t.clock.requestedTime} ({t.att.checkOut})
                    </label>
                    <input
                      type="time"
                      value={adjRequestedOut}
                      onChange={(e) => setAdjRequestedOut(e.target.value)}
                      className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-primary"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    {t.clock.adjustmentReason}
                  </label>
                  <textarea
                    value={newReqDesc}
                    onChange={(e) => setNewReqDesc(e.target.value)}
                    rows={3}
                    className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none resize-none"
                    placeholder={
                      isAr
                        ? "اكتب سبب طلب التعديل..."
                        : "Enter reason for adjustment..."
                    }
                  />
                </div>
              </>
            )}

            {/* Salary Advance form fields */}
            {newReqType === "salaryAdvance" && (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    {t.advance.amount} ({t.common.sar})
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={advAmount || ""}
                    onChange={(e) => setAdvAmount(Number(e.target.value))}
                    className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-primary"
                    placeholder={isAr ? "أدخل المبلغ" : "Enter amount"}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    {t.advance.repaymentMonths}
                  </label>
                  <select
                    value={advRepaymentMonths}
                    onChange={(e) =>
                      setAdvRepaymentMonths(Number(e.target.value))
                    }
                    className="w-full h-9 rounded-lg border border-border bg-card px-3 text-sm outline-none"
                  >
                    {[2, 3, 4, 5, 6].map((m) => (
                      <option key={m} value={m}>
                        {m} {isAr ? "أشهر" : "months"}
                      </option>
                    ))}
                  </select>
                </div>
                {advAmount > 0 && (
                  <div className="rounded-lg bg-accent/50 p-3 space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        {t.advance.monthlyDeduction}
                      </span>
                      <span className="font-semibold">
                        {calculatedMonthlyDeduction.toLocaleString()}{" "}
                        {t.common.sar}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        {t.advance.remainingBalance}
                      </span>
                      <span className="font-semibold">
                        {advAmount.toLocaleString()} {t.common.sar}
                      </span>
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t.req.description}</label>
                  <textarea
                    value={newReqDesc}
                    onChange={(e) => setNewReqDesc(e.target.value)}
                    rows={3}
                    className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none resize-none"
                    placeholder={
                      isAr ? "اكتب سبب طلب السلفة..." : "Enter reason for advance..."
                    }
                  />
                </div>
              </>
            )}

            {/* Default form fields (leave, salary cert, permission, doc) */}
            {newReqType !== "attendanceAdjust" &&
              newReqType !== "salaryAdvance" && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    {t.req.description}
                  </label>
                  <textarea
                    value={newReqDesc}
                    onChange={(e) => setNewReqDesc(e.target.value)}
                    rows={4}
                    className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none resize-none"
                    placeholder={
                      isAr
                        ? "اكتب تفاصيل الطلب..."
                        : "Enter request details..."
                    }
                  />
                </div>
              )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {t.common.cancel}
            </Button>
            <Button onClick={handleSubmit}>{t.req.submitRequest}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
