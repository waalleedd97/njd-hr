"use client";

import { useState, useEffect } from "react";
import { useLanguage, useAuth } from "@/components/providers";
import { useData } from "@/lib/data-store";
import { supabase } from "@/lib/supabase";
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
import { Icon } from "@/components/ui/icon";
import { cn, getKSANow, getKSADateString } from "@/lib/utils";

const statusBadgeVariant: Record<string, "success" | "warning" | "destructive"> = {
  active: "success",
  "on-leave": "warning",
  inactive: "destructive",
};

export default function EmployeesPage() {
  const { t, lang } = useLanguage();
  const { isAdmin } = useAuth();
  const store = useData();
  const { initialLoaded } = store;
  const departments = store.departments;
  const isAr = lang === "ar";

  const [searchQuery, setSearchQuery] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteDept, setInviteDept] = useState("");
  const [invitePosition, setInvitePosition] = useState("");
  const [inviteSent, setInviteSent] = useState(false);

  const [userIdMap, setUserIdMap] = useState<Record<string, string>>({});
  const [empLocationRequired, setEmpLocationRequired] = useState(true);

  useEffect(() => {
    if (!isAdmin) return;
    async function fetchUserIds() {
      try {
        const { data: users } = await supabase.rpc("admin_list_users");
        if (!users) return;
        const map: Record<string, string> = {};
        for (const u of users as Array<{ user_id: string; email: string }>) {
          if (u.email) map[u.email.toLowerCase()] = u.user_id;
        }
        setUserIdMap(map);
      } catch { /* RPC may not be available */ }
    }
    fetchUserIds();
  }, [isAdmin]);

  useEffect(() => {
    if (!dialogOpen || !selectedEmployee) return;
     
    setEmpLocationRequired(true);
    const supabaseId = userIdMap[selectedEmployee.email.toLowerCase()];
    if (!supabaseId) return;
    supabase
      .from("profiles")
      .select("location_required")
      .eq("id", supabaseId)
      .single()
      .then(({ data }) => {
        if (data) setEmpLocationRequired(data.location_required ?? true);
      });
  }, [dialogOpen, selectedEmployee, userIdMap]);

  const [locationToggleSaving, setLocationToggleSaving] = useState(false);

  const handleLocationToggle = async () => {
    if (!selectedEmployee || locationToggleSaving) return;
    const supabaseId = userIdMap[selectedEmployee.email.toLowerCase()];
    if (!supabaseId) return;
    const prevValue = empLocationRequired;
    const newValue = !prevValue;
    setLocationToggleSaving(true);
    setEmpLocationRequired(newValue); // optimistic
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ location_required: newValue })
        .eq("id", supabaseId);
      if (error) throw error;
    } catch (err) {
      console.error("[employees] location_required toggle failed:", err);
      setEmpLocationRequired(prevValue); // rollback
    } finally {
      setLocationToggleSaving(false);
    }
  };

  const employees = store.employees;
  const invites = store.pendingInvitations;

  const filteredEmployees = employees.filter((emp) => {
    const name = isAr ? emp.nameAr : emp.nameEn;
    const matchesSearch = !searchQuery ||
      name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDept = !departmentFilter || emp.department === departmentFilter;
    const matchesStatus = !statusFilter || emp.status === statusFilter;
    return matchesSearch && matchesDept && matchesStatus;
  });

  const activeCount = employees.filter((e) => e.status === "active").length;
  const onLeaveCount = employees.filter((e) => e.status === "on-leave").length;
  const newThisMonth = (() => {
    const now = getKSANow();
    const year = now.getFullYear();
    const month = now.getMonth();
    return employees.filter((e) => {
      if (!e.joinDate) return false;
      const d = new Date(e.joinDate);
      return d.getFullYear() === year && d.getMonth() === month;
    }).length;
  })();

  const statusLabel = (status: string) => {
    if (status === "active") return t.emp.active;
    if (status === "on-leave") return t.emp.onLeave;
    return t.emp.inactive;
  };

  const formatSalary = (amount: number) => amount.toLocaleString(isAr ? "ar-SA-u-nu-latn" : "en-US");

  const openProfile = (emp: Employee) => {
    setSelectedEmployee(emp);
    setDialogOpen(true);
  };

  const [inviteSending, setInviteSending] = useState(false);

  const sendInviteEmail = async (data: { email: string; nameAr: string; nameEn: string; positionAr: string; positionEn: string; department: string }) => {
    const deptLabel = departments[data.department];
    const res = await fetch("/api/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...data, department: isAr ? deptLabel?.ar : deptLabel?.en || data.department }),
    });
    if (!res.ok) throw new Error(`Email send failed: ${res.status}`);
  };

  const [inviteError, setInviteError] = useState("");

  const handleInviteSubmit = async () => {
    if (!inviteName || !inviteEmail) return;
    setInviteSending(true);
    setInviteError("");

    const invData = {
      email: inviteEmail,
      nameAr: inviteName,
      nameEn: inviteName,
      department: inviteDept || "hr",
      positionAr: invitePosition || "",
      positionEn: invitePosition || "",
      sentDate: getKSADateString(),
      status: "pending" as const,
    };

    try {
      await store.sendInvitation(invData);
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
    } catch {
      setInviteSending(false);
      setInviteError(isAr ? "فشل إرسال الدعوة. حاول مرة أخرى." : "Failed to send invitation. Please try again.");
    }
  };

  const handleResend = async (id: string) => {
    await store.resendInvitation(id);
    const inv = store.pendingInvitations.find((i) => i.id === id);
    if (inv) await sendInviteEmail(inv);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="font-headline text-3xl md:text-4xl font-extrabold text-on-surface tracking-tight">
          {t.emp.title}
        </h1>
        {isAdmin && (
          <Button size="lg" onClick={() => setInviteOpen(true)}>
            <Icon name="person_add" size={20} />
            {t.emp.addEmployee}
          </Button>
        )}
      </div>

      {/* Search & Filters */}
      <div className="bg-surface-container-lowest rounded-2xl p-4 shadow-sm">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <div className="absolute start-4 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none">
              <Icon name="search" size={20} />
            </div>
            <input
              type="text"
              placeholder={t.emp.searchPlaceholder}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-11 rounded-xl bg-surface-container-high ps-11 pe-4 text-sm outline-none placeholder:text-on-surface-variant/70 focus:ring-2 focus:ring-primary/40"
            />
          </div>
          <select
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            className="h-11 rounded-xl bg-surface-container-high px-4 text-sm outline-none focus:ring-2 focus:ring-primary/40"
          >
            <option value="">{t.emp.allDepartments}</option>
            {Object.entries(departments).map(([key, dept]) => (
              <option key={key} value={key}>{isAr ? dept.ar : dept.en}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-11 rounded-xl bg-surface-container-high px-4 text-sm outline-none focus:ring-2 focus:ring-primary/40"
          >
            <option value="">{t.emp.allStatuses}</option>
            <option value="active">{t.emp.active}</option>
            <option value="on-leave">{t.emp.onLeave}</option>
            <option value="inactive">{t.emp.inactive}</option>
          </select>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="bg-surface-container-lowest p-5 rounded-2xl shadow-sm hover:shadow-primary-glow-lg transition-all group">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Icon name="how_to_reg" size={26} fill className="text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="font-headline text-3xl font-black text-on-surface tabular-nums min-h-[36px]">
                {initialLoaded ? activeCount : <span className="inline-block w-16 h-7 rounded-lg bg-surface-container-highest animate-pulse align-middle" />}
              </p>
              <p className="text-sm text-on-surface-variant font-medium">{t.emp.totalActive}</p>
            </div>
          </div>
        </div>

        <div className="bg-surface-container-lowest p-5 rounded-2xl shadow-sm hover:shadow-primary-glow-lg transition-all group">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/15 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Icon name="group" size={26} fill className="text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="font-headline text-3xl font-black text-on-surface tabular-nums min-h-[36px]">
                {initialLoaded ? onLeaveCount : <span className="inline-block w-16 h-7 rounded-lg bg-surface-container-highest animate-pulse align-middle" />}
              </p>
              <p className="text-sm text-on-surface-variant font-medium">{t.emp.onLeaveCount}</p>
            </div>
          </div>
        </div>

        <div className="bg-surface-container-lowest p-5 rounded-2xl shadow-sm hover:shadow-primary-glow-lg transition-all group">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-500/15 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Icon name="trending_up" size={26} fill className="text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="font-headline text-3xl font-black text-on-surface tabular-nums min-h-[36px]">
                {initialLoaded ? newThisMonth : <span className="inline-block w-16 h-7 rounded-lg bg-surface-container-highest animate-pulse align-middle" />}
              </p>
              <p className="text-sm text-on-surface-variant font-medium">{t.emp.newThisMonth}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Employee Table */}
      <div className="bg-surface-container-lowest rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead>
              <tr className="bg-surface-container/30">
                <th className="text-start px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">{t.common.name}</th>
                <th className="text-start px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">{t.common.department}</th>
                <th className="text-start px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">{t.common.status}</th>
                <th className="text-start px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">{t.emp.joinDate}</th>
                <th className="text-start px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">{t.common.actions}</th>
              </tr>
            </thead>
            <tbody>
              {filteredEmployees.map((emp) => {
                const name = isAr ? emp.nameAr : emp.nameEn;
                const position = isAr ? emp.positionAr : emp.positionEn;
                const dept = departments[emp.department];
                const deptName = dept ? (isAr ? dept.ar : dept.en) : emp.department;

                return (
                  <tr key={emp.id} className="hover:bg-surface-container-low transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <Avatar className="w-10 h-10">
                          <AvatarFallback className={cn("text-white text-xs font-bold", emp.color)}>
                            {emp.initials}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="text-sm font-bold truncate">{name}</p>
                          <p className="text-[11px] text-on-surface-variant truncate">{position}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-on-surface-variant font-medium">{deptName}</td>
                    <td className="px-6 py-4">
                      <Badge variant={statusBadgeVariant[emp.status]}>
                        {statusLabel(emp.status)}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-sm text-on-surface-variant font-medium">
                      {new Date(emp.joinDate).toLocaleDateString(
                        isAr ? "ar-SA-u-nu-latn" : "en-US",
                        { year: "numeric", month: "short", day: "numeric" }
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => openProfile(emp)}
                        className="p-2 rounded-full text-primary hover:bg-primary-container/30 transition-colors"
                        title={t.emp.employeeProfile}
                      >
                        <Icon name="visibility" size={18} />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filteredEmployees.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-14 text-center">
                    <Icon name="person_search" size={44} className="text-on-surface-variant opacity-40 mb-3" />
                    <p className="text-sm text-on-surface-variant font-medium">{t.common.noData}</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pending Invitations */}
      {isAdmin && invites.length > 0 && (
        <div className="bg-surface-container-lowest rounded-2xl shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 px-6 py-5">
            <span className="w-1.5 h-7 bg-primary rounded-full" />
            <Icon name="mail" size={22} className="text-primary" />
            <h2 className="font-headline font-bold text-xl">{t.invite.pendingInvites}</h2>
            <Badge variant="default">{invites.length}</Badge>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead>
                <tr className="bg-surface-container/30">
                  <th className="text-start px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">{t.common.name}</th>
                  <th className="text-start px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">{t.invite.email}</th>
                  <th className="text-start px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">{t.common.department}</th>
                  <th className="text-start px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">{t.emp.position}</th>
                  <th className="text-start px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">{t.invite.sentOn}</th>
                  <th className="text-start px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">{t.common.status}</th>
                  <th className="text-start px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">{t.common.actions}</th>
                </tr>
              </thead>
              <tbody>
                {invites.map((inv) => {
                  const invName = isAr ? inv.nameAr : inv.nameEn;
                  const invDept = departments[inv.department];
                  const invDeptName = invDept ? (isAr ? invDept.ar : invDept.en) : inv.department;
                  const invPosition = isAr ? inv.positionAr : inv.positionEn;

                  return (
                    <tr key={inv.id} className="hover:bg-surface-container-low transition-colors">
                      <td className="px-6 py-4 text-sm font-bold">{invName}</td>
                      <td className="px-6 py-4 text-sm text-on-surface-variant">{inv.email}</td>
                      <td className="px-6 py-4 text-sm text-on-surface-variant font-medium">{invDeptName}</td>
                      <td className="px-6 py-4 text-sm text-on-surface-variant font-medium">{invPosition}</td>
                      <td className="px-6 py-4 text-sm text-on-surface-variant font-medium">
                        {new Date(inv.sentDate).toLocaleDateString(
                          isAr ? "ar-SA-u-nu-latn" : "en-US",
                          { year: "numeric", month: "short", day: "numeric" }
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant={inv.status === "pending" ? "warning" : "destructive"}>
                          {inv.status === "pending" ? t.statuses.pending : t.invite.expired}
                        </Badge>
                      </td>
                      <td className="px-6 py-4">
                        {inv.status === "expired" && (
                          <Button variant="ghost" size="sm" onClick={() => handleResend(inv.id)}>
                            <Icon name="autorenew" size={16} />
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

      {/* Profile Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          {selectedEmployee && (
            <>
              <DialogHeader>
                <DialogTitle>{t.emp.employeeProfile}</DialogTitle>
                <DialogDescription className="sr-only">{t.emp.personalInfo}</DialogDescription>
              </DialogHeader>

              <div className="flex items-center gap-4 pb-5">
                <Avatar size="lg" className="w-16 h-16">
                  <AvatarFallback className={cn("text-white text-lg font-bold", selectedEmployee.color)}>
                    {selectedEmployee.initials}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <h3 className="font-headline font-bold text-lg truncate">
                    {isAr ? selectedEmployee.nameAr : selectedEmployee.nameEn}
                  </h3>
                  <p className="text-sm text-on-surface-variant truncate">
                    {isAr ? selectedEmployee.positionAr : selectedEmployee.positionEn}
                  </p>
                  <Badge variant={statusBadgeVariant[selectedEmployee.status]} className="mt-1">
                    {statusLabel(selectedEmployee.status)}
                  </Badge>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-3">
                  {t.emp.personalInfo}
                </h4>
                <div className="space-y-2.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-on-surface-variant font-medium">{t.emp.empId}</span>
                    <span className="font-bold tabular-nums">{selectedEmployee.id}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-on-surface-variant font-medium">{t.emp.email}</span>
                    <span className="font-bold">{selectedEmployee.email}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-on-surface-variant font-medium">{t.emp.phone}</span>
                    <span className="font-bold tabular-nums" dir="ltr">{selectedEmployee.phone}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-on-surface-variant font-medium">{t.common.department}</span>
                    <span className="font-bold">
                      {departments[selectedEmployee.department]
                        ? (isAr ? departments[selectedEmployee.department].ar : departments[selectedEmployee.department].en)
                        : selectedEmployee.department}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-on-surface-variant font-medium">{t.emp.joinDate}</span>
                    <span className="font-bold tabular-nums">
                      {new Date(selectedEmployee.joinDate).toLocaleDateString(isAr ? "ar-SA-u-nu-latn" : "en-US", {
                        year: "numeric", month: "long", day: "numeric",
                      })}
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-outline-variant/20">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold">{t.emp.locationRequired}</span>
                  <button
                    onClick={handleLocationToggle}
                    disabled={!userIdMap[selectedEmployee.email.toLowerCase()]}
                    className={cn(
                      "relative w-12 h-7 rounded-full transition-colors",
                      !userIdMap[selectedEmployee.email.toLowerCase()] && "opacity-50 cursor-not-allowed",
                      empLocationRequired ? "gradient-btn shadow-primary-glow" : "bg-surface-container-highest"
                    )}
                  >
                    <span
                      className={cn(
                        "absolute top-0.5 w-6 h-6 rounded-full bg-surface-container-lowest shadow transition-all",
                        empLocationRequired ? "start-[22px]" : "start-0.5"
                      )}
                    />
                  </button>
                </div>
              </div>

              <div className="pt-4 border-t border-outline-variant/20">
                <h4 className="text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-3">
                  {t.emp.salaryInfo}
                </h4>
                {(() => {
                  const sal = selectedEmployee.salary;
                  const gosi = Math.round(sal.basic * GOSI_RATE);
                  const net = sal.basic + sal.housing + sal.transport + sal.other - gosi;
                  return (
                    <div className="space-y-2.5">
                      <div className="flex justify-between text-sm">
                        <span className="text-on-surface-variant font-medium">{t.emp.basic}</span>
                        <span className="font-bold tabular-nums">{formatSalary(sal.basic)} {t.common.sar}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-on-surface-variant font-medium">{t.emp.housing}</span>
                        <span className="font-bold tabular-nums">{formatSalary(sal.housing)} {t.common.sar}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-on-surface-variant font-medium">{t.emp.transport}</span>
                        <span className="font-bold tabular-nums">{formatSalary(sal.transport)} {t.common.sar}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-on-surface-variant font-medium">{t.emp.other}</span>
                        <span className="font-bold tabular-nums">{formatSalary(sal.other)} {t.common.sar}</span>
                      </div>
                      <div className="flex justify-between text-sm text-md-error">
                        <span className="font-medium">{t.pay.gosiDeduction}</span>
                        <span className="font-bold tabular-nums">-{formatSalary(gosi)} {t.common.sar}</span>
                      </div>
                      <div className="flex justify-between text-sm pt-3 bg-primary-container/20 -mx-6 px-6 py-3 rounded-2xl font-headline font-black text-primary">
                        <span>{t.emp.netSalary}</span>
                        <span className="tabular-nums">{formatSalary(net)} {t.common.sar}</span>
                      </div>
                    </div>
                  );
                })()}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  {t.common.close}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Invite Dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Icon name="send" size={22} className="text-primary" />
              {t.invite.title}
            </DialogTitle>
            <DialogDescription className="sr-only">{t.invite.title}</DialogDescription>
          </DialogHeader>

          {inviteSent ? (
            <div className="flex flex-col items-center gap-3 py-8">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center shadow-[0_0_30px_rgba(16,185,129,0.4)]">
                <Icon name="check_circle" size={36} fill className="text-emerald-500" />
              </div>
              <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                {t.invite.inviteSent}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-bold">{t.common.name}</label>
                <input
                  type="text"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  className="h-11 w-full rounded-xl bg-surface-container-high px-4 text-sm outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-bold">{t.invite.email}</label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="h-11 w-full rounded-xl bg-surface-container-high px-4 text-sm outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-bold">{t.common.department}</label>
                <select
                  value={inviteDept}
                  onChange={(e) => setInviteDept(e.target.value)}
                  className="h-11 w-full rounded-xl bg-surface-container-high px-4 text-sm outline-none focus:ring-2 focus:ring-primary/40"
                >
                  <option value="">{t.emp.allDepartments}</option>
                  {Object.entries(departments).map(([key, dept]) => (
                    <option key={key} value={key}>{isAr ? dept.ar : dept.en}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-bold">{t.emp.position}</label>
                <input
                  type="text"
                  value={invitePosition}
                  onChange={(e) => setInvitePosition(e.target.value)}
                  className="h-11 w-full rounded-xl bg-surface-container-high px-4 text-sm outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
              {inviteError && (
                <p className="text-sm text-md-error font-bold flex items-center gap-2" role="alert">
                  <Icon name="error" size={16} fill />
                  {inviteError}
                </p>
              )}
            </div>
          )}

          {!inviteSent && (
            <DialogFooter>
              <Button variant="outline" onClick={() => setInviteOpen(false)}>
                {t.common.cancel}
              </Button>
              <Button onClick={handleInviteSubmit} disabled={!inviteName || !inviteEmail || inviteSending}>
                {inviteSending ? (
                  <Icon name="progress_activity" size={18} className="animate-spin" />
                ) : (
                  <Icon name="send" size={18} />
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
