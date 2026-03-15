"use client";

import { useMemo, useState } from "react";
import { useLanguage } from "@/components/providers";
import { useData } from "@/lib/data-store";
import {
  employees,
  GOSI_RATE,
  todayAttendance,
  calcPenalty,
  calcDailySalary,
  penaltyRules,
  salaryAdvances,
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
import { cn } from "@/lib/utils";
import {
  DollarSign,
  TrendingUp,
  ArrowDownRight,
  Shield,
  CheckCircle,
  Eye,
  AlertTriangle,
  Wallet,
  BookOpen,
} from "lucide-react";

export default function PayrollPage() {
  const { t, lang } = useLanguage();
  const { processPayroll, payrollProcessed } = useData();
  const isAr = lang === "ar";
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(
    null
  );

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

      // Penalty calculation
      let penalty = 0;
      const attendance = todayAttendance.find(
        (a) => a.employeeId === emp.id
      );
      if (attendance) {
        if (attendance.status === "late" && attendance.checkIn) {
          const [h, m] = attendance.checkIn.split(":").map(Number);
          const checkInMinutes = h * 60 + m;
          const minutesLate = checkInMinutes - 480; // 8:00 AM = 480 min
          if (minutesLate > 0) {
            const percentage = calcPenalty(minutesLate);
            penalty = Math.round(calcDailySalary(emp) * percentage / 100);
          }
        } else if (attendance.status === "absent") {
          penalty = calcDailySalary(emp);
        }
      }

      // Advance deduction
      let advanceDeduction = 0;
      const advance = salaryAdvances.find(
        (a) => a.employeeId === emp.id && a.status === "approved"
      );
      if (advance && advance.remainingBalance > 0) {
        advanceDeduction = advance.monthlyDeduction;
      }

      const net = gross - gosi - penalty - advanceDeduction;

      return {
        employee: emp,
        basic,
        housing,
        transport,
        other,
        gross,
        gosi,
        penalty,
        advanceDeduction,
        net,
      };
    });

    const totalNet = payroll.reduce((sum, p) => sum + p.net, 0);
    const avg = payroll.length > 0 ? totalNet / payroll.length : 0;
    const allowances = payroll.reduce(
      (sum, p) => sum + p.housing + p.transport + p.other,
      0
    );
    const deductions = payroll.reduce((sum, p) => sum + p.gosi, 0);
    const gosiCompany = payroll.reduce(
      (sum, p) => sum + p.employee.salary.basic * 0.12,
      0
    );
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
  }, []);

  const selectedPayroll = useMemo(() => {
    if (!selectedEmployeeId) return null;
    return (
      employeePayroll.find((p) => p.employee.id === selectedEmployeeId) ?? null
    );
  }, [selectedEmployeeId, employeePayroll]);

  const formatCurrency = (value: number) =>
    value.toLocaleString("en-US") + " " + t.common.sar;

  const totalGosiEmployee = totalDeductions;
  const totalGosiCombined = totalGosiEmployee + totalGosiCompany;

  const stats = [
    {
      icon: DollarSign,
      label: t.pay.totalPayroll,
      value: formatCurrency(totalPayroll),
      color: "bg-primary/10 text-primary",
    },
    {
      icon: TrendingUp,
      label: t.pay.avgSalary,
      value: formatCurrency(Math.round(avgSalary)),
      color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    },
    {
      icon: DollarSign,
      label: t.pay.totalAllowances,
      value: formatCurrency(totalAllowances),
      color: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    },
    {
      icon: ArrowDownRight,
      label: t.pay.totalDeductions,
      value: formatCurrency(totalDeductions),
      color: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    },
    {
      icon: AlertTriangle,
      label: t.penalty.totalPenalties,
      value: formatCurrency(totalPenalties),
      color: "bg-red-500/10 text-red-600 dark:text-red-400",
    },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t.pay.title}</h1>
        <Button
          onClick={processPayroll}
          disabled={payrollProcessed}
          className={payrollProcessed ? "bg-emerald-600 hover:bg-emerald-600" : ""}
        >
          {payrollProcessed ? (
            <CheckCircle className="w-4 h-4" />
          ) : (
            <DollarSign className="w-4 h-4" />
          )}
          {payrollProcessed
            ? (isAr ? "✓ تمت المعالجة" : "✓ Processed")
            : t.pay.runPayroll}
        </Button>
      </div>

      {/* Stats Row — 5 cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {stats.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <div
              key={i}
              className="accent-card rounded-xl p-4 hover-lift cursor-default"
            >
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                    stat.color
                  )}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-lg font-bold text-foreground truncate">
                    {stat.value}
                  </p>
                  <p className="text-sm text-muted-foreground mt-0.5 truncate">
                    {stat.label}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Salary Table */}
        <div className="lg:col-span-2 glass-card rounded-xl p-5 lg:p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-bold text-lg">{t.pay.title}</h3>
            <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-400 border-0 text-[11px] font-medium">
              {t.pay.currentMonth}
            </Badge>
          </div>
          <div className="overflow-x-auto -mx-5 lg:-mx-6 px-5 lg:px-6">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className="text-xs text-muted-foreground border-b border-border">
                  <th className="text-start pb-3 font-medium">
                    {t.common.name}
                  </th>
                  <th className="text-start pb-3 font-medium">
                    {t.pay.basic}
                  </th>
                  <th className="text-start pb-3 font-medium">
                    {t.pay.housing}
                  </th>
                  <th className="text-start pb-3 font-medium">
                    {t.pay.transport}
                  </th>
                  <th className="text-start pb-3 font-medium">
                    {t.pay.otherAllowances}
                  </th>
                  <th className="text-start pb-3 font-medium">
                    {t.pay.gosiDeduction}
                  </th>
                  <th className="text-start pb-3 font-medium">
                    {t.penalty.title}
                  </th>
                  <th className="text-start pb-3 font-medium">
                    {t.advance.title}
                  </th>
                  <th className="text-start pb-3 font-medium">
                    {t.pay.net}
                  </th>
                  <th className="text-start pb-3 font-medium">
                    {t.pay.payslip}
                  </th>
                </tr>
              </thead>
              <tbody>
                {employeePayroll.map((row) => {
                  const emp = row.employee;
                  const name = isAr ? emp.nameAr : emp.nameEn;
                  return (
                    <tr
                      key={emp.id}
                      className="border-b border-border/50 last:border-0 hover:bg-accent/30 transition-colors"
                    >
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
                          <span className="text-sm font-medium whitespace-nowrap">
                            {name}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 text-sm text-muted-foreground">
                        {row.basic.toLocaleString("en-US")}
                      </td>
                      <td className="py-3 text-sm text-muted-foreground">
                        {row.housing.toLocaleString("en-US")}
                      </td>
                      <td className="py-3 text-sm text-muted-foreground">
                        {row.transport.toLocaleString("en-US")}
                      </td>
                      <td className="py-3 text-sm text-muted-foreground">
                        {row.other.toLocaleString("en-US")}
                      </td>
                      <td className="py-3 text-sm text-red-600 dark:text-red-400">
                        -{row.gosi.toLocaleString("en-US")}
                      </td>
                      <td className="py-3 text-sm text-red-600 dark:text-red-400">
                        {row.penalty > 0
                          ? `-${row.penalty.toLocaleString("en-US")}`
                          : "-"}
                      </td>
                      <td className="py-3 text-sm text-purple-600 dark:text-purple-400">
                        {row.advanceDeduction > 0
                          ? `-${row.advanceDeduction.toLocaleString("en-US")}`
                          : "-"}
                      </td>
                      <td className="py-3 text-sm font-semibold text-foreground">
                        {row.net.toLocaleString("en-US")}
                      </td>
                      <td className="py-3">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => setSelectedEmployeeId(emp.id)}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* WPS Status Card */}
          <div className="glass-card rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <h3 className="font-bold">{t.pay.wpsStatus}</h3>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {t.pay.wpsCompliant}
                </span>
                <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-400 border-0 text-[11px] font-medium">
                  {isAr ? "متوافق" : "Compliant"}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {t.pay.lastTransfer}
                </span>
                <span className="text-sm font-medium">2026-03-01</span>
              </div>
            </div>
          </div>

          {/* GOSI Summary Card */}
          <div className="glass-card rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Shield className="w-5 h-5 text-primary" />
              <h3 className="font-bold">{t.pay.gosiSummary}</h3>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {t.pay.employeeShare}
                </span>
                <span className="text-sm font-medium">
                  {formatCurrency(totalGosiEmployee)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {t.pay.companyShare}
                </span>
                <span className="text-sm font-medium">
                  {formatCurrency(totalGosiCompany)}
                </span>
              </div>
              <div className="border-t border-border pt-3 flex items-center justify-between">
                <span className="text-sm font-semibold">
                  {t.pay.totalGosi}
                </span>
                <span className="text-sm font-bold text-primary">
                  {formatCurrency(totalGosiCombined)}
                </span>
              </div>
            </div>
          </div>

          {/* Advance Tracking Card */}
          <div className="glass-card rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Wallet className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              <h3 className="font-bold">{t.advance.advanceHistory}</h3>
            </div>
            {approvedAdvances.length > 0 ? (
              <div className="space-y-4">
                {approvedAdvances.map((adv) => {
                  const emp = employees.find((e) => e.id === adv.employeeId);
                  if (!emp) return null;
                  const name = isAr ? emp.nameAr : emp.nameEn;
                  return (
                    <div
                      key={adv.id}
                      className="border border-border/50 rounded-lg p-3 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{name}</span>
                        <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-500/15 dark:text-purple-400 border-0 text-[11px] font-medium">
                          {formatCurrency(adv.amount)}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{t.advance.remainingBalance}</span>
                        <span className="font-medium text-foreground">
                          {formatCurrency(adv.remainingBalance)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{t.advance.paidMonths}</span>
                        <span className="font-medium text-foreground">
                          {adv.paidMonths} / {adv.repaymentMonths}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                {t.advance.noAdvances}
              </p>
            )}
          </div>

          {/* Penalty Rules Card */}
          <div className="glass-card rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <BookOpen className="w-5 h-5 text-red-600 dark:text-red-400" />
              <h3 className="font-bold text-sm">{t.penalty.rules}</h3>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              {t.penalty.autoCalculated}
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-start pb-2 font-medium text-muted-foreground">
                      {t.penalty.condition}
                    </th>
                    <th className="text-start pb-2 font-medium text-muted-foreground">
                      {t.penalty.deduction}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {penaltyRules.map((r) => (
                    <tr
                      key={r.id}
                      className="border-b border-border/50 last:border-0"
                    >
                      <td className="py-1.5 text-foreground">
                        {isAr ? r.conditionAr : r.conditionEn}
                      </td>
                      <td className="py-1.5 text-red-600 dark:text-red-400">
                        {isAr ? r.deductionAr : r.deductionEn}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Payslip Dialog */}
      <Dialog
        open={selectedEmployeeId !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedEmployeeId(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          {selectedPayroll && (
            <>
              <DialogHeader>
                <DialogTitle>{t.pay.viewPayslip}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                {/* Employee Info */}
                <div className="flex items-center gap-3 pb-3 border-b border-border">
                  <Avatar>
                    <AvatarFallback
                      className={cn(
                        "text-white text-xs font-bold",
                        selectedPayroll.employee.color
                      )}
                    >
                      {selectedPayroll.employee.initials}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-semibold">
                      {isAr
                        ? selectedPayroll.employee.nameAr
                        : selectedPayroll.employee.nameEn}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {selectedPayroll.employee.id}
                    </p>
                  </div>
                </div>

                {/* Earnings */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      {t.pay.basic}
                    </span>
                    <span className="text-sm font-medium">
                      {formatCurrency(selectedPayroll.basic)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      {t.pay.housing}
                    </span>
                    <span className="text-sm font-medium">
                      {formatCurrency(selectedPayroll.housing)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      {t.pay.transport}
                    </span>
                    <span className="text-sm font-medium">
                      {formatCurrency(selectedPayroll.transport)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      {t.pay.otherAllowances}
                    </span>
                    <span className="text-sm font-medium">
                      {formatCurrency(selectedPayroll.other)}
                    </span>
                  </div>
                </div>

                {/* Deductions */}
                <div className="border-t border-border pt-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      {t.pay.gosiDeduction} ({(GOSI_RATE * 100).toFixed(2)}%)
                    </span>
                    <span className="text-sm font-medium text-red-600 dark:text-red-400">
                      -{formatCurrency(selectedPayroll.gosi)}
                    </span>
                  </div>
                  {selectedPayroll.penalty > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">
                        {t.penalty.title}
                      </span>
                      <span className="text-sm font-medium text-red-600 dark:text-red-400">
                        -{formatCurrency(selectedPayroll.penalty)}
                      </span>
                    </div>
                  )}
                  {selectedPayroll.advanceDeduction > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">
                        {t.advance.monthlyDeduction}
                      </span>
                      <span className="text-sm font-medium text-purple-600 dark:text-purple-400">
                        -{formatCurrency(selectedPayroll.advanceDeduction)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Net Pay */}
                <div className="border-t border-border pt-3 flex items-center justify-between">
                  <span className="text-sm font-semibold">{t.pay.net}</span>
                  <span className="text-base font-bold text-primary">
                    {formatCurrency(selectedPayroll.net)}
                  </span>
                </div>
              </div>
              <DialogFooter className="gap-2 sm:gap-0">
                <Button
                  variant="outline"
                  onClick={() => window.print()}
                >
                  {isAr ? "طباعة" : "Print"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setSelectedEmployeeId(null)}
                >
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
