"use client";

import { useMemo, useState } from "react";
import { useLanguage, useAuth } from "@/components/providers";
import { useData } from "@/lib/data-store";
import {
  GOSI_RATE,
  GOSI_RATE_COMPANY,
  calcPenalty,
  calcDailySalary,
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
  DialogFooter,
} from "@/components/ui/dialog";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

export default function PayrollPage() {
  const { t, lang } = useLanguage();
  const { isAdmin, user } = useAuth();
  const store = useData();
  const { processPayroll, payrollProcessed } = store;
  const employees = store.employees;
  const todayAttendance = store.todayAttendance;
  const salaryAdvances = store.salaryAdvances;
  const isAr = lang === "ar";
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);

  const {
    totalPayroll,
    avgSalary,
    totalAllowances,
    totalDeductions,
    totalGosiCompany,
    totalPenalties,
    employeePayroll,
    approvedAdvances,
  } = useMemo(() => {
    const active = employees.filter((emp) => emp.status !== "inactive");

    const payroll = active.map((emp) => {
      const { basic, housing, transport, other } = emp.salary;
      const gross = basic + housing + transport + other;
      const gosi = Math.round(basic * GOSI_RATE * 100) / 100;

      let penalty = 0;
      const attendance = todayAttendance.find((a) => a.employeeId === emp.id);
      if (attendance) {
        if (attendance.status === "late" && attendance.checkIn) {
          const [h, m] = attendance.checkIn.split(":").map(Number);
          const checkInMinutes = h * 60 + m;
          const minutesLate = checkInMinutes - 600;
          if (minutesLate > 0) {
            const percentage = calcPenalty(minutesLate);
            penalty = Math.round(calcDailySalary(emp) * percentage / 100);
          }
        } else if (attendance.status === "absent") {
          penalty = calcDailySalary(emp);
        }
      }

      let advanceDeduction = 0;
      const advance = salaryAdvances.find((a) => a.employeeId === emp.id && a.status === "approved");
      if (advance && advance.remainingBalance > 0) {
        advanceDeduction = advance.monthlyDeduction;
      }

      const net = gross - gosi - penalty - advanceDeduction;
      return { employee: emp, basic, housing, transport, other, gross, gosi, penalty, advanceDeduction, net };
    });

    const totalNet = payroll.reduce((sum, p) => sum + p.net, 0);
    const avg = payroll.length > 0 ? totalNet / payroll.length : 0;
    const allowances = payroll.reduce((sum, p) => sum + p.housing + p.transport + p.other, 0);
    const deductions = payroll.reduce((sum, p) => sum + p.gosi, 0);
    const gosiCompany = payroll.reduce((sum, p) => sum + p.employee.salary.basic * GOSI_RATE_COMPANY, 0);
    const penalties = payroll.reduce((sum, p) => sum + p.penalty, 0);
    const approved = salaryAdvances.filter((a) => a.status === "approved");

    return {
      activeEmployees: active,
      totalPayroll: totalNet,
      avgSalary: avg,
      totalAllowances: allowances,
      totalDeductions: deductions,
      totalGosiCompany: gosiCompany,
      totalPenalties: penalties,
      employeePayroll: payroll,
      approvedAdvances: approved,
    };
  }, [employees, salaryAdvances, todayAttendance]);

  const visiblePayroll = useMemo(() => {
    if (isAdmin) return employeePayroll;
    return employeePayroll.filter((p) => p.employee.email === user.email || p.employee.id === user.id);
  }, [isAdmin, employeePayroll, user.email, user.id]);

  const selectedPayroll = useMemo(() => {
    if (!selectedEmployeeId) return null;
    return employeePayroll.find((p) => p.employee.id === selectedEmployeeId) ?? null;
  }, [selectedEmployeeId, employeePayroll]);

  const formatCurrency = (value: number) => value.toLocaleString("en-US") + " " + t.common.sar;

  const totalGosiEmployee = totalDeductions;
  const totalGosiCombined = totalGosiEmployee + totalGosiCompany;

  const stats = [
    { iconName: "payments", label: t.pay.totalPayroll, value: formatCurrency(totalPayroll), bg: "bg-primary-container/40", color: "text-primary" },
    { iconName: "trending_up", label: t.pay.avgSalary, value: formatCurrency(Math.round(avgSalary)), bg: "bg-emerald-500/15", color: "text-emerald-600 dark:text-emerald-400" },
    { iconName: "account_balance_wallet", label: t.pay.totalAllowances, value: formatCurrency(totalAllowances), bg: "bg-blue-500/15", color: "text-blue-600 dark:text-blue-400" },
    { iconName: "south_east", label: t.pay.totalDeductions, value: formatCurrency(totalDeductions), bg: "bg-amber-500/15", color: "text-amber-600 dark:text-amber-400" },
    { iconName: "warning", label: t.penalty.totalPenalties, value: formatCurrency(totalPenalties), bg: "bg-error-container/20", color: "text-md-error" },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-headline text-3xl md:text-4xl font-extrabold text-on-surface tracking-tight">
          {t.pay.title}
        </h1>
        {isAdmin && (
          <Button
            size="lg"
            onClick={processPayroll}
            disabled={payrollProcessed}
            className={payrollProcessed ? "!bg-emerald-600 !bg-none" : ""}
          >
            {payrollProcessed ? <Icon name="check_circle" size={20} fill /> : <Icon name="payments" size={20} />}
            {payrollProcessed ? (isAr ? "✓ تمت المعالجة" : "✓ Processed") : t.pay.runPayroll}
          </Button>
        )}
      </div>

      {/* Stats row (admin only) */}
      {isAdmin && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {stats.map((stat, i) => (
            <div key={i} className="bg-surface-container-lowest p-5 rounded-2xl shadow-sm hover:shadow-primary-glow-lg transition-all group">
              <div className="flex items-start gap-3">
                <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform", stat.bg, stat.color)}>
                  <Icon name={stat.iconName} size={24} fill />
                </div>
                <div className="min-w-0">
                  <p className="font-headline text-base font-black text-on-surface truncate tabular-nums">
                    {stat.value}
                  </p>
                  <p className="text-xs text-on-surface-variant mt-0.5 truncate font-medium">
                    {stat.label}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Payroll table */}
        <div className={cn("bg-surface-container-lowest rounded-2xl shadow-sm overflow-hidden", isAdmin ? "lg:col-span-2" : "lg:col-span-3")}>
          <div className="flex items-center justify-between px-6 pt-6 pb-4">
            <div className="flex items-center gap-3">
              <span className="w-1.5 h-7 bg-primary rounded-full" />
              <h3 className="font-headline font-bold text-xl">{t.pay.title}</h3>
            </div>
            <Badge variant="success">{t.pay.currentMonth}</Badge>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className="bg-surface-container/30">
                  <th className="text-start px-6 py-3 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">{t.common.name}</th>
                  <th className="text-start px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">{t.pay.basic}</th>
                  <th className="text-start px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">{t.pay.housing}</th>
                  <th className="text-start px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">{t.pay.transport}</th>
                  <th className="text-start px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">{t.pay.otherAllowances}</th>
                  <th className="text-start px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">{t.pay.gosiDeduction}</th>
                  <th className="text-start px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">{t.penalty.title}</th>
                  <th className="text-start px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">{t.advance.title}</th>
                  <th className="text-start px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">{t.pay.net}</th>
                  <th className="text-start px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">{t.pay.payslip}</th>
                </tr>
              </thead>
              <tbody>
                {visiblePayroll.map((row) => {
                  const emp = row.employee;
                  const name = isAr ? emp.nameAr : emp.nameEn;
                  return (
                    <tr key={emp.id} className="hover:bg-surface-container-low transition-colors">
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar className="w-8 h-8">
                            <AvatarFallback className={cn("text-white text-[11px] font-bold", emp.color)}>
                              {emp.initials}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm font-bold whitespace-nowrap">{name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-on-surface-variant tabular-nums">{row.basic.toLocaleString("en-US")}</td>
                      <td className="px-4 py-3 text-sm text-on-surface-variant tabular-nums">{row.housing.toLocaleString("en-US")}</td>
                      <td className="px-4 py-3 text-sm text-on-surface-variant tabular-nums">{row.transport.toLocaleString("en-US")}</td>
                      <td className="px-4 py-3 text-sm text-on-surface-variant tabular-nums">{row.other.toLocaleString("en-US")}</td>
                      <td className="px-4 py-3 text-sm text-md-error tabular-nums font-medium">-{row.gosi.toLocaleString("en-US")}</td>
                      <td className="px-4 py-3 text-sm text-md-error tabular-nums font-medium">
                        {row.penalty > 0 ? `-${row.penalty.toLocaleString("en-US")}` : "-"}
                      </td>
                      <td className="px-4 py-3 text-sm text-tertiary tabular-nums font-medium">
                        {row.advanceDeduction > 0 ? `-${row.advanceDeduction.toLocaleString("en-US")}` : "-"}
                      </td>
                      <td className="px-4 py-3 text-sm font-black text-on-surface tabular-nums">
                        {row.net.toLocaleString("en-US")}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setSelectedEmployeeId(emp.id)}
                          className="p-2 rounded-full text-primary hover:bg-primary-container/30 transition-colors"
                          title={t.pay.viewPayslip}
                        >
                          <Icon name="visibility" size={18} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column — admin only */}
        {isAdmin && (
          <div className="space-y-6">
            {/* WPS Status */}
            <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-2xl flex items-center justify-center bg-emerald-500/15">
                  <Icon name="verified" size={22} fill className="text-emerald-600 dark:text-emerald-400" />
                </div>
                <h3 className="font-headline font-bold">{t.pay.wpsStatus}</h3>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-on-surface-variant font-medium">{t.pay.wpsCompliant}</span>
                  <Badge variant="success">{isAr ? "متوافق" : "Compliant"}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-on-surface-variant font-medium">{t.pay.lastTransfer}</span>
                  <span className="text-sm font-bold tabular-nums">2026-03-01</span>
                </div>
              </div>
            </div>

            {/* GOSI Summary */}
            <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-2xl flex items-center justify-center bg-primary-container/40">
                  <Icon name="shield" size={22} fill className="text-primary" />
                </div>
                <h3 className="font-headline font-bold">{t.pay.gosiSummary}</h3>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-on-surface-variant font-medium">{t.pay.employeeShare}</span>
                  <span className="text-sm font-bold tabular-nums">{formatCurrency(totalGosiEmployee)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-on-surface-variant font-medium">{t.pay.companyShare}</span>
                  <span className="text-sm font-bold tabular-nums">{formatCurrency(totalGosiCompany)}</span>
                </div>
                <div className="pt-3 flex items-center justify-between">
                  <span className="text-sm font-bold">{t.pay.totalGosi}</span>
                  <span className="font-headline text-lg font-black text-primary tabular-nums">
                    {formatCurrency(totalGosiCombined)}
                  </span>
                </div>
              </div>
            </div>

            {/* Advance Tracking */}
            <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-2xl flex items-center justify-center bg-tertiary-container/40">
                  <Icon name="wallet" size={22} fill className="text-tertiary" />
                </div>
                <h3 className="font-headline font-bold">{t.advance.advanceHistory}</h3>
              </div>
              {approvedAdvances.length > 0 ? (
                <div className="space-y-3">
                  {approvedAdvances.map((adv) => {
                    const emp = employees.find((e) => e.id === adv.employeeId) ?? {
                      id: adv.employeeId,
                      nameAr: "موظف غير مربوط",
                      nameEn: "Unlinked Employee",
                      color: "bg-slate-500",
                      initials: (adv.employeeId[0] || "?").toUpperCase(),
                    };
                    const name = isAr ? emp.nameAr : emp.nameEn;
                    return (
                      <div key={adv.id} className="bg-surface-container-low rounded-2xl p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-bold">{name}</span>
                          <Badge variant="tertiary">{formatCurrency(adv.amount)}</Badge>
                        </div>
                        <div className="flex items-center justify-between text-xs text-on-surface-variant">
                          <span className="font-medium">{t.advance.remainingBalance}</span>
                          <span className="font-bold text-on-surface tabular-nums">{formatCurrency(adv.remainingBalance)}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs text-on-surface-variant">
                          <span className="font-medium">{t.advance.paidMonths}</span>
                          <span className="font-bold text-on-surface tabular-nums">{adv.paidMonths} / {adv.repaymentMonths}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-on-surface-variant text-center py-4 font-medium">
                  {t.advance.noAdvances}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Penalty Rules */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <Icon name="gavel" size={20} className="text-md-error" />
            <h3 className="font-headline font-bold text-sm">{isAr ? "جزاءات التأخر" : "Late Arrival Penalties"}</h3>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr>
                <th className="text-start pb-2 font-bold text-on-surface-variant uppercase tracking-wider text-[10px]">{t.penalty.condition}</th>
                <th className="text-start pb-2 font-bold text-on-surface-variant uppercase tracking-wider text-[10px]">{t.penalty.deduction}</th>
              </tr>
            </thead>
            <tbody>
              {penaltyRules.map((r) => (
                <tr key={r.id} className="hover:bg-surface-container-low transition-colors">
                  <td className="py-2 text-on-surface font-medium">{isAr ? r.conditionAr : r.conditionEn}</td>
                  <td className={cn("py-2 font-bold", r.percentage > 0 ? "text-md-error" : "text-on-surface-variant")}>
                    {isAr ? r.deductionAr : r.deductionEn}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <Icon name="logout" size={20} className="text-amber-600 dark:text-amber-400" />
            <h3 className="font-headline font-bold text-sm">{isAr ? "جزاءات الانصراف المبكر" : "Early Departure Penalties"}</h3>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr>
                <th className="text-start pb-2 font-bold text-on-surface-variant uppercase tracking-wider text-[10px]">{t.penalty.condition}</th>
                <th className="text-start pb-2 font-bold text-on-surface-variant uppercase tracking-wider text-[10px]">{t.penalty.deduction}</th>
              </tr>
            </thead>
            <tbody>
              {earlyDepartureRules.map((r) => (
                <tr key={r.id} className="hover:bg-surface-container-low transition-colors">
                  <td className="py-2 text-on-surface font-medium">{isAr ? r.conditionAr : r.conditionEn}</td>
                  <td className={cn("py-2 font-bold", r.percentage > 0 ? "text-md-error" : "text-on-surface-variant")}>
                    {isAr ? r.deductionAr : r.deductionEn}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Exemption note */}
      <div className="p-4 rounded-2xl bg-blue-500/10">
        <p className="text-xs font-bold text-blue-700 dark:text-blue-300 flex items-center gap-2">
          <Icon name="info" size={16} fill />
          {isAr ? "الموظفون عن بُعد معفيون من قواعد الجزاءات" : "Remote employees are exempt from penalty rules"}
        </p>
      </div>

      {/* Payslip Dialog */}
      <Dialog open={selectedEmployeeId !== null} onOpenChange={(open) => { if (!open) setSelectedEmployeeId(null); }}>
        <DialogContent className="sm:max-w-md">
          {selectedPayroll && (
            <>
              <DialogHeader>
                <DialogTitle>{t.pay.viewPayslip}</DialogTitle>
              </DialogHeader>
              <div className="space-y-5">
                <div className="flex items-center gap-3 pb-4">
                  <Avatar className="w-12 h-12">
                    <AvatarFallback className={cn("text-white text-sm font-bold", selectedPayroll.employee.color)}>
                      {selectedPayroll.employee.initials}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-headline font-bold">
                      {isAr ? selectedPayroll.employee.nameAr : selectedPayroll.employee.nameEn}
                    </p>
                    <p className="text-xs text-on-surface-variant tabular-nums">{selectedPayroll.employee.id}</p>
                  </div>
                </div>

                <div className="space-y-2.5">
                  <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                    {isAr ? "الاستحقاقات" : "Earnings"}
                  </p>
                  <div className="flex items-center justify-between py-1">
                    <span className="text-sm text-on-surface-variant font-medium">{t.pay.basic}</span>
                    <span className="text-sm font-bold tabular-nums">{formatCurrency(selectedPayroll.basic)}</span>
                  </div>
                  <div className="flex items-center justify-between py-1">
                    <span className="text-sm text-on-surface-variant font-medium">{t.pay.housing}</span>
                    <span className="text-sm font-bold tabular-nums">{formatCurrency(selectedPayroll.housing)}</span>
                  </div>
                  <div className="flex items-center justify-between py-1">
                    <span className="text-sm text-on-surface-variant font-medium">{t.pay.transport}</span>
                    <span className="text-sm font-bold tabular-nums">{formatCurrency(selectedPayroll.transport)}</span>
                  </div>
                  <div className="flex items-center justify-between py-1">
                    <span className="text-sm text-on-surface-variant font-medium">{t.pay.otherAllowances}</span>
                    <span className="text-sm font-bold tabular-nums">{formatCurrency(selectedPayroll.other)}</span>
                  </div>
                </div>

                <div className="pt-4 space-y-2.5 border-t-2 border-outline-variant/15">
                  <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                    {isAr ? "الخصومات" : "Deductions"}
                  </p>
                  <div className="flex items-center justify-between py-1">
                    <span className="text-sm text-on-surface-variant font-medium">
                      {t.pay.gosiDeduction} ({(GOSI_RATE * 100).toFixed(2)}%)
                    </span>
                    <span className="text-sm font-bold text-md-error tabular-nums">
                      -{formatCurrency(selectedPayroll.gosi)}
                    </span>
                  </div>
                  {selectedPayroll.penalty > 0 && (
                    <div className="flex items-center justify-between py-1">
                      <span className="text-sm text-on-surface-variant font-medium">{t.penalty.title}</span>
                      <span className="text-sm font-bold text-md-error tabular-nums">
                        -{formatCurrency(selectedPayroll.penalty)}
                      </span>
                    </div>
                  )}
                  {selectedPayroll.advanceDeduction > 0 && (
                    <div className="flex items-center justify-between py-1">
                      <span className="text-sm text-on-surface-variant font-medium">{t.advance.monthlyDeduction}</span>
                      <span className="text-sm font-bold text-tertiary tabular-nums">
                        -{formatCurrency(selectedPayroll.advanceDeduction)}
                      </span>
                    </div>
                  )}
                </div>

                <div className="pt-4 flex items-center justify-between bg-primary-container/20 -mx-6 px-6 py-4 rounded-2xl">
                  <span className="font-headline text-base font-bold">{t.pay.net}</span>
                  <span className="font-headline text-2xl font-black text-primary tabular-nums">
                    {formatCurrency(selectedPayroll.net)}
                  </span>
                </div>
              </div>
              <DialogFooter className="gap-2 sm:gap-2">
                <Button variant="outline" onClick={() => window.print()}>
                  <Icon name="print" size={18} />
                  {isAr ? "طباعة" : "Print"}
                </Button>
                <Button variant="outline" onClick={() => setSelectedEmployeeId(null)}>
                  {isAr ? "إغلاق" : "Close"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
