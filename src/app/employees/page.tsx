"use client";

import { useState } from "react";
import { useLanguage, useAuth } from "@/components/providers";
import { useData } from "@/lib/data-store";
import { GOSI_RATE } from "@/lib/mock-data";
import type { Employee } from "@/lib/mock-data";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Search, Plus, Eye, Users, UserCheck, UserX, Mail, Send, RotateCw } from "lucide-react";

const statusStyles: Record<string, string> = {
  active:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-400 border-0",
  "on-leave":
    "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-400 border-0",
  inactive:
    "bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-400 border-0",
};

export default function EmployeesPage() {
  const { t, lang } = useLanguage();
  const { isAdmin } = useAuth();
  const store = useData();
  const departments = store.departments;
  const isAr = lang === "ar";

  const [searchQuery, setSearchQuery] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(
    null
  );
  const [dialogOpen, setDialogOpen] = useState(false);

  // Invite dialog state
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteDept, setInviteDept] = useState("");
  const [invitePosition, setInvitePosition] = useState("");
  const [inviteSent, setInviteSent] = useState(false);

  // Use store data
  const employees = store.employees;
  const invites = store.pendingInvitations;

  // Filter employees
  const filteredEmployees = employees.filter((emp) => {
    const name = isAr ? emp.nameAr : emp.nameEn;
    const matchesSearch =
      !searchQuery ||
      name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDept = !departmentFilter || emp.department === departmentFilter;
    const matchesStatus = !statusFilter || emp.status === statusFilter;
    return matchesSearch && matchesDept && matchesStatus;
  });

  // Stats
  const activeCount = employees.filter((e) => e.status === "active").length;
  const onLeaveCount = employees.filter((e) => e.status === "on-leave").length;
  const newThisMonth = 2;

  const statusLabel = (status: string) => {
    if (status === "active") return t.emp.active;
    if (status === "on-leave") return t.emp.onLeave;
    return t.emp.inactive;
  };

  const formatSalary = (amount: number) => {
    return amount.toLocaleString(isAr ? "ar-SA-u-nu-latn" : "en-US");
  };

  const openProfile = (emp: Employee) => {
    setSelectedEmployee(emp);
    setDialogOpen(true);
  };

  const [inviteSending, setInviteSending] = useState(false);

  const sendInviteEmail = async (data: { email: string; nameAr: string; nameEn: string; positionAr: string; positionEn: string; department: string }) => {
    try {
      const deptLabel = departments[data.department];
      await fetch("/api/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, department: isAr ? deptLabel?.ar : deptLabel?.en || data.department }),
      });
    } catch {
      // Email sending is best-effort; invitation is saved regardless
    }
  };

  const handleInviteSubmit = async () => {
    if (!inviteName || !inviteEmail) return;
    setInviteSending(true);

    const invData = {
      email: inviteEmail,
      nameAr: inviteName,
      nameEn: inviteName,
      department: inviteDept || "hr",
      positionAr: invitePosition || "",
      positionEn: invitePosition || "",
      sentDate: new Date().toISOString().split("T")[0],
      status: "pending" as const,
    };

    store.sendInvitation(invData);
    await sendInviteEmail(invData);

    setInviteSending(false);
    setInviteSent(true);

    setTimeout(() => {
      setInviteSent(false);
      setInviteName("");
      setInviteEmail("");
      setInviteDept("");
      setInvitePosition("");
      setInviteOpen(false);
    }, 2000);
  };

  const handleResend = async (id: string) => {
    store.resendInvitation(id);
    const inv = store.pendingInvitations.find((i) => i.id === id);
    if (inv) await sendInviteEmail(inv);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-foreground">{t.emp.title}</h1>
        {isAdmin && (
          <Button className="gap-2" onClick={() => setInviteOpen(true)}>
            <Plus className="w-4 h-4" />
            {t.emp.addEmployee}
          </Button>
        )}
      </div>

      {/* Search and Filters */}
      <div className="glass-card rounded-xl p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder={t.emp.searchPlaceholder}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-9 rounded-lg border border-border bg-card ps-9 pe-3 text-sm outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors"
            />
          </div>

          {/* Department Filter */}
          <select
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            className="h-9 rounded-lg border border-border bg-card px-3 text-sm outline-none"
          >
            <option value="">{t.emp.allDepartments}</option>
            {Object.entries(departments).map(([key, dept]) => (
              <option key={key} value={key}>
                {isAr ? dept.ar : dept.en}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9 rounded-lg border border-border bg-card px-3 text-sm outline-none"
          >
            <option value="">{t.emp.allStatuses}</option>
            <option value="active">{t.emp.active}</option>
            <option value="on-leave">{t.emp.onLeave}</option>
            <option value="inactive">{t.emp.inactive}</option>
          </select>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="accent-card rounded-xl p-4 hover-lift cursor-default">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <UserCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{activeCount}</p>
              <p className="text-sm text-muted-foreground">{t.emp.totalActive}</p>
            </div>
          </div>
        </div>

        <div className="accent-card rounded-xl p-4 hover-lift cursor-default">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{onLeaveCount}</p>
              <p className="text-sm text-muted-foreground">
                {t.emp.onLeaveCount}
              </p>
            </div>
          </div>
        </div>

        <div className="accent-card rounded-xl p-4 hover-lift cursor-default">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <UserX className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{newThisMonth}</p>
              <p className="text-sm text-muted-foreground">
                {t.emp.newThisMonth}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Employee Table */}
      <div className="glass-card rounded-xl p-5 lg:p-6">
        <div className="overflow-x-auto -mx-5 lg:-mx-6 px-5 lg:px-6">
          <table className="w-full min-w-[700px]">
            <thead>
              <tr className="text-xs text-muted-foreground border-b border-border">
                <th className="text-start pb-3 font-medium">
                  {t.common.name}
                </th>
                <th className="text-start pb-3 font-medium">
                  {t.common.department}
                </th>
                <th className="text-start pb-3 font-medium">
                  {t.common.status}
                </th>
                <th className="text-start pb-3 font-medium">
                  {t.emp.joinDate}
                </th>
                <th className="text-start pb-3 font-medium">
                  {t.common.actions}
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredEmployees.map((emp) => {
                const name = isAr ? emp.nameAr : emp.nameEn;
                const position = isAr ? emp.positionAr : emp.positionEn;
                const dept = departments[emp.department];
                const deptName = dept ? (isAr ? dept.ar : dept.en) : emp.department;

                return (
                  <tr
                    key={emp.id}
                    className="border-b border-border/50 last:border-0 hover:bg-accent/30 transition-colors"
                  >
                    {/* Avatar + Name + Position */}
                    <td className="py-3">
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarFallback
                            className={cn(
                              "text-white text-xs font-bold",
                              emp.color
                            )}
                          >
                            {emp.initials}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{name}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {position}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Department */}
                    <td className="py-3 text-sm text-muted-foreground">
                      {deptName}
                    </td>

                    {/* Status Badge */}
                    <td className="py-3">
                      <Badge
                        className={cn(
                          "text-[11px] font-medium",
                          statusStyles[emp.status]
                        )}
                      >
                        {statusLabel(emp.status)}
                      </Badge>
                    </td>

                    {/* Join Date */}
                    <td className="py-3 text-sm text-muted-foreground">
                      {new Date(emp.joinDate).toLocaleDateString(
                        isAr ? "ar-SA-u-nu-latn" : "en-US",
                        { year: "numeric", month: "short", day: "numeric" }
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1.5 text-primary"
                        onClick={() => openProfile(emp)}
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </Button>
                    </td>
                  </tr>
                );
              })}

              {filteredEmployees.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="py-12 text-center text-sm text-muted-foreground"
                  >
                    {t.common.noData}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pending Invitations Section (admin only) */}
      {isAdmin && invites.length > 0 && (
        <div className="glass-card rounded-xl p-5 lg:p-6">
          <div className="flex items-center gap-3 mb-4">
            <Mail className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">
              {t.invite.pendingInvites}
            </h2>
            <Badge className="bg-primary/10 text-primary border-0 text-xs font-medium">
              {invites.length}
            </Badge>
          </div>

          <div className="overflow-x-auto -mx-5 lg:-mx-6 px-5 lg:px-6">
            <table className="w-full min-w-[700px]">
              <thead>
                <tr className="text-xs text-muted-foreground border-b border-border">
                  <th className="text-start pb-3 font-medium">{t.common.name}</th>
                  <th className="text-start pb-3 font-medium">{t.invite.email}</th>
                  <th className="text-start pb-3 font-medium">{t.common.department}</th>
                  <th className="text-start pb-3 font-medium">{t.emp.position}</th>
                  <th className="text-start pb-3 font-medium">{t.invite.sentOn}</th>
                  <th className="text-start pb-3 font-medium">{t.common.status}</th>
                  <th className="text-start pb-3 font-medium">{t.common.actions}</th>
                </tr>
              </thead>
              <tbody>
                {invites.map((inv) => {
                  const invName = isAr ? inv.nameAr : inv.nameEn;
                  const invDept = departments[inv.department];
                  const invDeptName = invDept
                    ? isAr
                      ? invDept.ar
                      : invDept.en
                    : inv.department;
                  const invPosition = isAr ? inv.positionAr : inv.positionEn;

                  return (
                    <tr
                      key={inv.id}
                      className="border-b border-border/50 last:border-0 hover:bg-accent/30 transition-colors"
                    >
                      <td className="py-3 text-sm font-medium">{invName}</td>
                      <td className="py-3 text-sm text-muted-foreground">{inv.email}</td>
                      <td className="py-3 text-sm text-muted-foreground">{invDeptName}</td>
                      <td className="py-3 text-sm text-muted-foreground">{invPosition}</td>
                      <td className="py-3 text-sm text-muted-foreground">
                        {new Date(inv.sentDate).toLocaleDateString(
                          isAr ? "ar-SA-u-nu-latn" : "en-US",
                          { year: "numeric", month: "short", day: "numeric" }
                        )}
                      </td>
                      <td className="py-3">
                        <Badge
                          className={cn(
                            "text-[11px] font-medium border-0",
                            inv.status === "pending"
                              ? "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-400"
                              : "bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-400"
                          )}
                        >
                          {inv.status === "pending"
                            ? t.statuses.pending
                            : t.invite.expired}
                        </Badge>
                      </td>
                      <td className="py-3">
                        {inv.status === "expired" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="gap-1.5 text-primary"
                            onClick={() => handleResend(inv.id)}
                          >
                            <RotateCw className="w-3.5 h-3.5" />
                            {t.invite.resend}
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Employee Profile Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          {selectedEmployee && (
            <>
              <DialogHeader>
                <DialogTitle>{t.emp.employeeProfile}</DialogTitle>
                <DialogDescription className="sr-only">
                  {t.emp.personalInfo}
                </DialogDescription>
              </DialogHeader>

              {/* Profile Header */}
              <div className="flex items-center gap-4 pb-4 border-b border-border">
                <Avatar size="lg">
                  <AvatarFallback
                    className={cn(
                      "text-white text-sm font-bold",
                      selectedEmployee.color
                    )}
                  >
                    {selectedEmployee.initials}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <h3 className="font-bold text-base truncate">
                    {isAr
                      ? selectedEmployee.nameAr
                      : selectedEmployee.nameEn}
                  </h3>
                  <p className="text-sm text-muted-foreground truncate">
                    {isAr
                      ? selectedEmployee.positionAr
                      : selectedEmployee.positionEn}
                  </p>
                  <Badge
                    className={cn(
                      "text-[11px] font-medium mt-1",
                      statusStyles[selectedEmployee.status]
                    )}
                  >
                    {statusLabel(selectedEmployee.status)}
                  </Badge>
                </div>
              </div>

              {/* Personal Info */}
              <div>
                <h4 className="text-sm font-semibold mb-3">
                  {t.emp.personalInfo}
                </h4>
                <div className="space-y-2.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t.emp.empId}</span>
                    <span className="font-medium">{selectedEmployee.id}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t.emp.email}</span>
                    <span className="font-medium">{selectedEmployee.email}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t.emp.phone}</span>
                    <span className="font-medium" dir="ltr">
                      {selectedEmployee.phone}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      {t.common.department}
                    </span>
                    <span className="font-medium">
                      {departments[selectedEmployee.department]
                        ? isAr
                          ? departments[selectedEmployee.department].ar
                          : departments[selectedEmployee.department].en
                        : selectedEmployee.department}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      {t.emp.joinDate}
                    </span>
                    <span className="font-medium">
                      {new Date(
                        selectedEmployee.joinDate
                      ).toLocaleDateString(isAr ? "ar-SA-u-nu-latn" : "en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Salary Info */}
              <div className="pt-3 border-t border-border">
                <h4 className="text-sm font-semibold mb-3">
                  {t.emp.salaryInfo}
                </h4>
                {(() => {
                  const sal = selectedEmployee.salary;
                  const gosi = Math.round(sal.basic * GOSI_RATE);
                  const net =
                    sal.basic + sal.housing + sal.transport + sal.other - gosi;
                  return (
                    <div className="space-y-2.5">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">
                          {t.emp.basic}
                        </span>
                        <span className="font-medium">
                          {formatSalary(sal.basic)} {t.common.sar}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">
                          {t.emp.housing}
                        </span>
                        <span className="font-medium">
                          {formatSalary(sal.housing)} {t.common.sar}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">
                          {t.emp.transport}
                        </span>
                        <span className="font-medium">
                          {formatSalary(sal.transport)} {t.common.sar}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">
                          {t.emp.other}
                        </span>
                        <span className="font-medium">
                          {formatSalary(sal.other)} {t.common.sar}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm text-red-600 dark:text-red-400">
                        <span>{t.pay.gosiDeduction}</span>
                        <span className="font-medium">
                          -{formatSalary(gosi)} {t.common.sar}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm pt-2 border-t border-border font-bold">
                        <span>{t.emp.netSalary}</span>
                        <span className="text-emerald-600 dark:text-emerald-400">
                          {formatSalary(net)} {t.common.sar}
                        </span>
                      </div>
                    </div>
                  );
                })()}
              </div>

              <DialogFooter showCloseButton>
                <Button
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => {
                    setDialogOpen(false);
                    store.addNotification({
                      type: "system",
                      titleAr: "تم الحفظ",
                      titleEn: "Saved",
                      descAr: "تم تحديث البيانات",
                      descEn: "Data updated",
                      time: 0,
                      read: false,
                    });
                  }}
                >
                  {t.common.edit}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Invite Employee Dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="w-5 h-5 text-primary" />
              {t.invite.title}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {t.invite.title}
            </DialogDescription>
          </DialogHeader>

          {inviteSent ? (
            <div className="flex flex-col items-center gap-3 py-8">
              <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-500/15 flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-emerald-600 dark:text-emerald-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                {t.invite.inviteSent}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Name */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">
                  {t.common.name}
                </label>
                <input
                  type="text"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-primary"
                />
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">
                  {t.invite.email}
                </label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-primary"
                />
              </div>

              {/* Department */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">
                  {t.common.department}
                </label>
                <select
                  value={inviteDept}
                  onChange={(e) => setInviteDept(e.target.value)}
                  className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm outline-none"
                >
                  <option value="">{t.emp.allDepartments}</option>
                  {Object.entries(departments).map(([key, dept]) => (
                    <option key={key} value={key}>
                      {isAr ? dept.ar : dept.en}
                    </option>
                  ))}
                </select>
              </div>

              {/* Position */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">
                  {t.emp.position}
                </label>
                <input
                  type="text"
                  value={invitePosition}
                  onChange={(e) => setInvitePosition(e.target.value)}
                  className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-primary"
                />
              </div>
            </div>
          )}

          {!inviteSent && (
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setInviteOpen(false)}
              >
                {t.common.cancel}
              </Button>
              <Button
                className="gap-2"
                onClick={handleInviteSubmit}
                disabled={!inviteName || !inviteEmail || inviteSending}
              >
                {inviteSending ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                {inviteSending ? (isAr ? "جاري الإرسال..." : "Sending...") : t.invite.sendInvite}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
