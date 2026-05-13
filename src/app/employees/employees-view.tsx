"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLanguage, useAuth } from "@/components/providers";
import { useData } from "@/lib/data-store";
import { ASSET_TYPES, type AssetType, type EmployeeAsset } from "@/lib/mock-data";
import type { Employee } from "@/lib/mock-data";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm-dialog";
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
import { cn } from "@/lib/utils";
import { useDataHydration } from "@/lib/hooks/use-data-hydration";
import type { EmployeesSlice } from "@/lib/data/server";

const statusBadgeVariant: Record<string, "success" | "warning" | "destructive"> = {
  active: "success",
  "on-leave": "warning",
  inactive: "destructive",
};

type EmpTab = "list" | "onboarding" | "orgchart" | "hired" | "assets";

/** Recursive node for the Org Chart — renders one employee + indented reports. */
function OrgNode({
  employee,
  reportsMap,
  isAr,
  depth,
  onClick,
}: {
  employee: Employee;
  reportsMap: Map<string, Employee[]>;
  isAr: boolean;
  depth: number;
  onClick: (emp: Employee) => void;
}) {
  const reports = reportsMap.get(employee.id) || [];
  const hasReports = reports.length > 0;
  return (
    <div className="space-y-2" style={{ marginInlineStart: depth === 0 ? 0 : `${depth * 24}px` }}>
      <button
        onClick={() => onClick(employee)}
        className="w-full text-start flex items-center gap-3 px-4 py-3 rounded-2xl bg-surface-container-low hover:bg-surface-container-high transition-colors group"
      >
        {hasReports ? (
          <Icon name="account_tree" size={16} className="text-primary opacity-70 shrink-0" />
        ) : (
          <span className="w-4 shrink-0" />
        )}
        <Avatar className="w-9 h-9 shrink-0">
          <AvatarFallback className={cn("text-white text-xs font-bold", employee.color)}>
            {employee.initials}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold truncate">
            {isAr ? employee.nameAr : employee.nameEn}
          </p>
          <p className="text-xs text-on-surface-variant truncate">
            {isAr ? employee.positionAr : employee.positionEn}
            {hasReports && (
              <span className="ms-2 text-[10px] tabular-nums opacity-70">
                · {reports.length} {isAr ? "مرؤوس" : "reports"}
              </span>
            )}
          </p>
        </div>
      </button>
      {hasReports && (
        <div className="space-y-2 border-s-2 border-outline-variant/20 ps-3">
          {reports.map((r) => (
            <OrgNode
              key={r.id}
              employee={r}
              reportsMap={reportsMap}
              isAr={isAr}
              depth={depth + 1}
              onClick={onClick}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function EmployeesView({ initialSlice }: { initialSlice: EmployeesSlice }) {
  useDataHydration(initialSlice);
  const { t, lang } = useLanguage();
  const { isAdmin } = useAuth();
  const store = useData();
  const toast = useToast();
  const { confirm } = useConfirm();
  const { initialLoaded } = store;
  const departments = store.departments;
  const isAr = lang === "ar";

  const [empTab, setEmpTab] = useState<EmpTab>("list");
  const [searchQuery, setSearchQuery] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteDept, setInviteDept] = useState("");
  const [invitePosition, setInvitePosition] = useState("");
  const [inviteSent, setInviteSent] = useState(false);

  // Profile editing (location_required toggle, manager picker, salary view)
  // moved to the dedicated /employees/[id] page so the admin gets a real URL
  // they can bookmark and share. The previous in-list dialog and its
  // supporting state (selectedEmployee, dialogOpen, userIdMap, empLocationRequired,
  // handleLocationToggle, handleManagerChange, plus their two useEffects)
  // were removed as dead code. openProfile() below now just navigates.
  const router = useRouter();

  const employees = store.employees;
  const invites = store.pendingInvitations;
  const assets = store.assets;

  // Onboarding banner: employees missing the National ID / Iqama
  // (هوية وطنية أو رقم إقامة — the per-individual identifier, NOT
  // commercial registration which is a company-level field).
  const missingNationalIdCount = useMemo(
    () => employees.filter((e) => !e.nationalId && e.status !== "inactive").length,
    [employees]
  );

  // Onboarding view: employees with profile_completed=false OR joined in last 30 days
  const onboardingEmployees = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    return employees.filter((e) => {
      if (e.profileCompleted === false) return true;
      if (e.joinDate) {
        const d = new Date(e.joinDate);
        if (d >= cutoff) return true;
      }
      return false;
    });
  }, [employees]);

  // Hired Candidates: pending/expired invitations + employees joined in last 30 days
  const recentlyHired = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    return employees.filter((e) => {
      if (!e.joinDate) return false;
      const d = new Date(e.joinDate);
      return d >= cutoff;
    });
  }, [employees]);

  // Org chart roots = employees with no managerId (or whose manager isn't in the list)
  const orgRoots = useMemo(() => {
    const ids = new Set(employees.map((e) => e.id));
    return employees.filter((e) => !e.managerId || !ids.has(e.managerId));
  }, [employees]);

  // Build manager → reports map for O(1) traversal
  const reportsMap = useMemo(() => {
    const m = new Map<string, Employee[]>();
    for (const e of employees) {
      if (e.managerId) {
        const arr = m.get(e.managerId) || [];
        arr.push(e);
        m.set(e.managerId, arr);
      }
    }
    return m;
  }, [employees]);

  // Asset state — used by the Assets sub-tab
  const [assetDialogOpen, setAssetDialogOpen] = useState(false);
  const [assetEditing, setAssetEditing] = useState<EmployeeAsset | null>(null);
  const [assetForm, setAssetForm] = useState<{
    employeeId: string;
    assetType: AssetType;
    nameAr: string;
    nameEn: string;
    serialNumber: string;
    notes: string;
    issuedAt: string;
  }>({
    employeeId: "",
    assetType: "laptop",
    nameAr: "",
    nameEn: "",
    serialNumber: "",
    notes: "",
    issuedAt: new Date().toISOString().split("T")[0],
  });
  const [assetSaving, setAssetSaving] = useState(false);

  const openNewAsset = () => {
    setAssetEditing(null);
    setAssetForm({
      employeeId: "",
      assetType: "laptop",
      nameAr: "",
      nameEn: "",
      serialNumber: "",
      notes: "",
      issuedAt: new Date().toISOString().split("T")[0],
    });
    setAssetDialogOpen(true);
  };

  const submitAsset = async () => {
    if (assetSaving) return;
    if (!assetForm.employeeId || !assetForm.nameAr || !assetForm.nameEn) {
      toast.warning(isAr ? "الموظف والاسم بالعربية والإنجليزية مطلوبة" : "Employee + name (AR/EN) are required");
      return;
    }
    setAssetSaving(true);
    try {
      if (assetEditing) {
        await store.updateAsset(assetEditing.id, {
          assetType: assetForm.assetType,
          nameAr: assetForm.nameAr,
          nameEn: assetForm.nameEn,
          serialNumber: assetForm.serialNumber,
          notes: assetForm.notes,
          issuedAt: assetForm.issuedAt,
        });
        toast.success(isAr ? "تم تحديث العهدة" : "Asset updated");
      } else {
        await store.addAsset({
          employeeId: assetForm.employeeId,
          assetType: assetForm.assetType,
          nameAr: assetForm.nameAr,
          nameEn: assetForm.nameEn,
          serialNumber: assetForm.serialNumber || undefined,
          notes: assetForm.notes || undefined,
          issuedAt: assetForm.issuedAt,
          status: "issued",
          returnedAt: null,
        });
        toast.success(isAr ? "تم تسجيل العهدة" : "Asset issued");
      }
      setAssetDialogOpen(false);
    } catch (err) {
      console.error("[employees] asset save failed:", err);
      toast.error(isAr ? "فشل حفظ العهدة" : "Failed to save asset");
    } finally {
      setAssetSaving(false);
    }
  };

  const markAssetReturned = async (a: EmployeeAsset) => {
    try {
      await store.updateAsset(a.id, {
        status: "returned",
        returnedAt: new Date().toISOString().split("T")[0],
      });
      toast.success(isAr ? "تم تسجيل الاستلام" : "Asset marked as returned");
    } catch (err) {
      console.error("[employees] mark returned failed:", err);
      toast.error(isAr ? "فشل التحديث" : "Failed to update");
    }
  };

  const deleteAsset = async (a: EmployeeAsset) => {
    const ok = await confirm({
      title: isAr ? "حذف سجل العهدة" : "Delete asset record",
      description: isAr ? `حذف "${a.nameAr}"؟` : `Delete "${a.nameEn}"?`,
      confirmLabel: isAr ? "حذف" : "Delete",
      cancelLabel: isAr ? "إلغاء" : "Cancel",
      variant: "danger",
    });
    if (!ok) return;
    try {
      await store.removeAsset(a.id);
      toast.success(isAr ? "تم الحذف" : "Deleted");
    } catch (err) {
      console.error("[employees] asset delete failed:", err);
      toast.error(isAr ? "فشل الحذف" : "Failed to delete");
    }
  };

  const filteredEmployees = employees.filter((emp) => {
    const name = isAr ? emp.nameAr : emp.nameEn;
    const q = searchQuery.toLowerCase();
    const matchesSearch = !searchQuery ||
      name.toLowerCase().includes(q) ||
      emp.id.toLowerCase().includes(q) ||
      // Allow searching by the 3-digit staff number, e.g. typing "002"
      // jumps straight to that employee.
      (emp.employeeNumber?.toLowerCase().includes(q) ?? false);
    const matchesDept = !departmentFilter || emp.department === departmentFilter;
    const matchesStatus = !statusFilter || emp.status === statusFilter;
    return matchesSearch && matchesDept && matchesStatus;
  });

  const activeCount = employees.filter((e) => e.status === "active").length;
  const onLeaveCount = employees.filter((e) => e.status === "on-leave").length;
  const newThisMonth = (() => {
    const now = new Date();
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

  // Navigate to the dedicated employee detail page. Kept as a function
  // (rather than inlined router.push at every call site) so the eye-icon
  // button, the onboarding row click, the org-chart node click, and the
  // recently-hired row click all stay one-line and consistent.
  const openProfile = (emp: Employee) => {
    router.push(`/employees/${emp.id}`);
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
      sentDate: new Date().toISOString().split("T")[0],
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
        <div>
          <h1 className="font-headline text-3xl md:text-4xl font-extrabold text-on-surface tracking-tight">
            {t.emp.title}
          </h1>
          <p className="text-sm text-on-surface-variant mt-1">
            {employees.length} {isAr ? "موظف" : "employees"}
            {invites.length > 0 && (
              <> • {invites.length} {isAr ? "دعوة قيد الانتظار" : "invitations pending"}</>
            )}
          </p>
        </div>
        {isAdmin && (
          <Button size="lg" onClick={() => setInviteOpen(true)}>
            <Icon name="person_add" size={20} />
            {t.emp.addEmployee}
          </Button>
        )}
      </div>

      {/* Sub-tabs (Employee List / Onboarding / Org Chart / Hired Candidates / Assets) */}
      {isAdmin && (
        <div className="flex items-center gap-1 bg-surface-container rounded-2xl p-1 overflow-x-auto">
          {[
            { key: "list" as const, icon: "groups", label: isAr ? "قائمة الموظفين" : "Employee List" },
            { key: "onboarding" as const, icon: "checklist", label: isAr ? "التهيئة" : "Onboarding", count: onboardingEmployees.length },
            { key: "orgchart" as const, icon: "account_tree", label: isAr ? "الهيكل التنظيمي" : "Org Chart" },
            { key: "hired" as const, icon: "person_add", label: isAr ? "المعيّنون مؤخراً" : "Hired Candidates", count: invites.length + recentlyHired.length },
            { key: "assets" as const, icon: "inventory_2", label: isAr ? "العهد" : "Assets", count: assets.length },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setEmpTab(t.key)}
              className={cn(
                "px-4 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 whitespace-nowrap",
                empTab === t.key
                  ? "gradient-btn shadow-primary-glow"
                  : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low"
              )}
            >
              <Icon name={t.icon} size={16} fill={empTab === t.key} />
              {t.label}
              {t.count !== undefined && t.count > 0 && (
                <span className={cn(
                  "text-[10px] font-black tabular-nums rounded-full min-w-[20px] h-5 inline-flex items-center justify-center px-1.5",
                  empTab === t.key ? "bg-white/20 text-white" : "bg-surface-container-highest text-on-surface-variant"
                )}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Onboarding banner: missing National ID / Iqama */}
      {isAdmin && missingNationalIdCount > 0 && (
        <div className="bg-error-container/30 border border-md-error/20 rounded-2xl px-5 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-full bg-md-error/10 flex items-center justify-center shrink-0">
              <Icon name="error" size={20} fill className="text-md-error" />
            </div>
            <p className="text-sm font-medium text-on-surface truncate">
              {isAr
                ? `لديك ${missingNationalIdCount} موظف بدون رقم هوية وطنية / إقامة مسجّل`
                : `You have ${missingNationalIdCount} employee${missingNationalIdCount === 1 ? "" : "s"} without a National ID / Iqama on file`}
            </p>
          </div>
          <button
            onClick={() => setEmpTab("onboarding")}
            className="text-sm font-bold text-md-error hover:underline whitespace-nowrap shrink-0"
          >
            {isAr ? "عرض التفاصيل" : "More Details"}
          </button>
        </div>
      )}

      {/* Invitations progress (visible on List + Hired tabs) */}
      {isAdmin && invites.length > 0 && (empTab === "list" || empTab === "hired") && (
        <div className="bg-surface-container-lowest rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between gap-4 mb-3">
            <div className="flex items-center gap-2">
              <Icon name="mail" size={18} className="text-primary" />
              <h3 className="font-headline font-bold text-base">
                {isAr ? "الدعوات" : "Invitations"}
              </h3>
            </div>
            <span className="text-sm font-bold tabular-nums text-on-surface-variant">
              {invites.filter((i) => i.status === "pending").length} / {invites.length}
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-surface-container-highest overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary to-tertiary transition-all"
              style={{
                width: `${invites.length === 0 ? 0 : Math.round((invites.filter((i) => i.status === "pending").length / invites.length) * 100)}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* ── Sub-tab bodies start here ───────────────────────────────── */}
      {(!isAdmin || empTab === "list") && (
      <div className="space-y-8">
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
          <table className="w-full min-w-[760px]">
            <thead>
              <tr className="bg-surface-container/30">
                <th className="text-start px-4 py-4 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant w-16">#</th>
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
                    {/* 3-digit human-friendly staff number — much more useful
                        in a list than the truncated UUID we used to show. */}
                    <td className="px-4 py-4">
                      <span className="text-sm font-bold tabular-nums text-primary">
                        {emp.employeeNumber ?? "—"}
                      </span>
                    </td>
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
                      {/* Link instead of button so the admin can middle-click
                          or Cmd/Ctrl-click to open the profile in a new tab. */}
                      <Link
                        href={`/employees/${emp.id}`}
                        className="inline-flex p-2 rounded-full text-primary hover:bg-primary-container/30 transition-colors"
                        title={t.emp.employeeProfile}
                        aria-label={t.emp.employeeProfile}
                      >
                        <Icon name="visibility" size={18} />
                      </Link>
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

      </div>
      )}

      {/* ── Onboarding tab body ──────────────────────────── */}
      {isAdmin && empTab === "onboarding" && (
        <div className="bg-surface-container-lowest rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-5 flex items-center gap-3">
            <Icon name="checklist" size={22} className="text-primary" />
            <div>
              <h2 className="font-headline font-bold text-xl">
                {isAr ? "موظفون قيد التهيئة" : "Onboarding"}
              </h2>
              <p className="text-xs text-on-surface-variant mt-0.5">
                {isAr
                  ? "موظفون لم يكملوا ملفاتهم الشخصية أو انضموا حديثاً"
                  : "Employees with incomplete profiles or recent joiners"}
              </p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead>
                <tr className="bg-surface-container/30">
                  <th className="text-start px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">{t.common.name}</th>
                  <th className="text-start px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">{t.common.department}</th>
                  <th className="text-start px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">{t.emp.joinDate}</th>
                  <th className="text-start px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                    {isAr ? "حالة الملف" : "Profile status"}
                  </th>
                  <th className="text-start px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                    {isAr ? "الهوية الوطنية / الإقامة" : "National ID / Iqama"}
                  </th>
                </tr>
              </thead>
              <tbody>
                {onboardingEmployees.map((emp) => {
                  const dept = departments[emp.department];
                  return (
                    <tr key={emp.id} className="hover:bg-surface-container-low cursor-pointer" onClick={() => openProfile(emp)}>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <Avatar className="w-9 h-9">
                            <AvatarFallback className={cn("text-white text-xs font-bold", emp.color)}>
                              {emp.initials}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm font-bold">{isAr ? emp.nameAr : emp.nameEn}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-on-surface-variant">
                        {dept ? (isAr ? dept.ar : dept.en) : emp.department || "—"}
                      </td>
                      <td className="px-6 py-4 text-sm text-on-surface-variant tabular-nums">
                        {emp.joinDate || "—"}
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant={emp.profileCompleted ? "success" : "warning"}>
                          {emp.profileCompleted
                            ? (isAr ? "مكتمل" : "Complete")
                            : (isAr ? "ناقص" : "Incomplete")}
                        </Badge>
                      </td>
                      <td className="px-6 py-4">
                        {emp.nationalId ? (
                          <span className="text-sm text-on-surface-variant tabular-nums font-mono" dir="ltr">
                            {emp.nationalId}
                          </span>
                        ) : (
                          <Badge variant="destructive">{isAr ? "مفقود" : "Missing"}</Badge>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {onboardingEmployees.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-on-surface-variant">
                      <Icon name="check_circle" size={36} className="opacity-40 mb-2" fill />
                      <p className="text-sm font-medium">
                        {isAr ? "كل الموظفين أكملوا ملفاتهم — أحسنت!" : "All employees have completed their profiles — great!"}
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Org Chart tab body ──────────────────────────── */}
      {isAdmin && empTab === "orgchart" && (
        <div className="bg-surface-container-lowest rounded-2xl shadow-sm p-6">
          <div className="flex items-center gap-3 mb-6">
            <Icon name="account_tree" size={22} className="text-primary" />
            <div>
              <h2 className="font-headline font-bold text-xl">
                {isAr ? "الهيكل التنظيمي" : "Org Chart"}
              </h2>
              <p className="text-xs text-on-surface-variant mt-0.5">
                {isAr
                  ? "حدّد المدير المباشر من ملف كل موظف لبناء التسلسل الإداري"
                  : "Set the direct manager in each employee's profile to build the hierarchy"}
              </p>
            </div>
          </div>
          {orgRoots.length === 0 ? (
            <div className="py-12 text-center text-on-surface-variant">
              <Icon name="account_tree" size={36} className="opacity-40 mb-2" />
              <p className="text-sm font-medium">
                {isAr ? "لا توجد بيانات للهيكل بعد" : "No org data yet"}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {orgRoots.map((root) => (
                <OrgNode
                  key={root.id}
                  employee={root}
                  reportsMap={reportsMap}
                  isAr={isAr}
                  depth={0}
                  onClick={openProfile}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Hired Candidates tab body ───────────────────── */}
      {isAdmin && empTab === "hired" && (
        <div className="space-y-6">
          {/* Recently joined */}
          <div className="bg-surface-container-lowest rounded-2xl shadow-sm overflow-hidden">
            <div className="px-6 py-5 flex items-center gap-3">
              <Icon name="celebration" size={22} className="text-primary" />
              <div>
                <h2 className="font-headline font-bold text-xl">
                  {isAr ? "انضموا حديثاً (آخر 30 يوم)" : "Recently Joined (last 30 days)"}
                </h2>
              </div>
              <Badge variant="default">{recentlyHired.length}</Badge>
            </div>
            {recentlyHired.length === 0 ? (
              <p className="text-sm text-on-surface-variant text-center py-8">
                {isAr ? "لا انضمامات حديثة" : "No recent hires"}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[600px]">
                  <thead>
                    <tr className="bg-surface-container/30">
                      <th className="text-start px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">{t.common.name}</th>
                      <th className="text-start px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">{t.emp.position}</th>
                      <th className="text-start px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">{t.emp.joinDate}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentlyHired.map((emp) => (
                      <tr key={emp.id} className="hover:bg-surface-container-low cursor-pointer" onClick={() => openProfile(emp)}>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <Avatar className="w-9 h-9">
                              <AvatarFallback className={cn("text-white text-xs font-bold", emp.color)}>
                                {emp.initials}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-sm font-bold">{isAr ? emp.nameAr : emp.nameEn}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-on-surface-variant">
                          {isAr ? emp.positionAr : emp.positionEn}
                        </td>
                        <td className="px-6 py-4 text-sm text-on-surface-variant tabular-nums">
                          {emp.joinDate}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Assets tab body ──────────────────────────────── */}
      {isAdmin && empTab === "assets" && (
        <div className="bg-surface-container-lowest rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Icon name="inventory_2" size={22} className="text-primary" />
              <div>
                <h2 className="font-headline font-bold text-xl">
                  {isAr ? "العهد المُسلَّمة" : "Assets"}
                </h2>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  {isAr ? "أجهزة وأغراض الشركة المُسلَّمة للموظفين" : "Company-issued equipment per employee"}
                </p>
              </div>
            </div>
            <Button onClick={openNewAsset}>
              <Icon name="add" size={18} />
              {isAr ? "تسليم عهدة" : "Issue Asset"}
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px]">
              <thead>
                <tr className="bg-surface-container/30">
                  <th className="text-start px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">{isAr ? "العهدة" : "Asset"}</th>
                  <th className="text-start px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">{isAr ? "الموظف" : "Employee"}</th>
                  <th className="text-start px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">{isAr ? "الرقم التسلسلي" : "Serial #"}</th>
                  <th className="text-start px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">{isAr ? "تاريخ التسليم" : "Issued"}</th>
                  <th className="text-start px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">{t.common.status}</th>
                  <th className="text-end px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">{t.common.actions}</th>
                </tr>
              </thead>
              <tbody>
                {assets.map((a) => {
                  const meta = ASSET_TYPES[a.assetType] ?? ASSET_TYPES.other;
                  const emp = employees.find((e) => e.id === a.employeeId);
                  return (
                    <tr key={a.id} className="hover:bg-surface-container-low transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center bg-surface-container", meta.tone)}>
                            <Icon name={meta.iconName} size={18} fill />
                          </div>
                          <span className="text-sm font-bold">{isAr ? a.nameAr : a.nameEn}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        {emp ? (isAr ? emp.nameAr : emp.nameEn) : (isAr ? "—" : "—")}
                      </td>
                      <td className="px-6 py-4 text-xs font-mono text-on-surface-variant">
                        {a.serialNumber || "—"}
                      </td>
                      <td className="px-6 py-4 text-sm text-on-surface-variant tabular-nums">
                        {a.issuedAt}
                      </td>
                      <td className="px-6 py-4">
                        <Badge
                          variant={
                            a.status === "issued" ? "success"
                            : a.status === "returned" ? "secondary"
                            : "destructive"
                          }
                        >
                          {a.status === "issued" ? (isAr ? "مُسلَّم" : "Issued")
                            : a.status === "returned" ? (isAr ? "مُسترَد" : "Returned")
                            : a.status === "lost" ? (isAr ? "مفقود" : "Lost")
                            : (isAr ? "تالف" : "Damaged")}
                        </Badge>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-1">
                          {a.status === "issued" && (
                            <Button variant="ghost" size="sm" onClick={() => markAssetReturned(a)} title={isAr ? "تسجيل استلام" : "Mark returned"}>
                              <Icon name="assignment_return" size={16} />
                            </Button>
                          )}
                          <Button variant="ghost" size="sm" className="text-red-500" onClick={() => deleteAsset(a)} title={isAr ? "حذف" : "Delete"}>
                            <Icon name="delete" size={16} />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {assets.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-on-surface-variant">
                      <Icon name="inventory_2" size={36} className="opacity-40 mb-2" />
                      <p className="text-sm font-medium">
                        {isAr ? "لا عهد مسجّلة بعد" : "No assets recorded yet"}
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pending Invitations (visible on List + Hired) */}
      {isAdmin && (empTab === "list" || empTab === "hired") && invites.length > 0 && (
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

      {/* Asset Issue/Edit Dialog */}
      <Dialog open={assetDialogOpen} onOpenChange={setAssetDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {assetEditing
                ? (isAr ? "تعديل العهدة" : "Edit Asset")
                : (isAr ? "تسليم عهدة" : "Issue Asset")}
            </DialogTitle>
            <DialogDescription className="sr-only">{isAr ? "العهد" : "Assets"}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-bold">{isAr ? "الموظف" : "Employee"}</label>
              <select
                value={assetForm.employeeId}
                onChange={(e) => setAssetForm((f) => ({ ...f, employeeId: e.target.value }))}
                disabled={!!assetEditing}
                className="h-11 w-full rounded-xl bg-surface-container-high px-4 text-sm outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-60"
              >
                <option value="">{isAr ? "اختر موظفاً..." : "Select employee..."}</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {isAr ? e.nameAr : e.nameEn}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-bold">{isAr ? "نوع العهدة" : "Asset Type"}</label>
              <select
                value={assetForm.assetType}
                onChange={(e) => setAssetForm((f) => ({ ...f, assetType: e.target.value as AssetType }))}
                className="h-11 w-full rounded-xl bg-surface-container-high px-4 text-sm outline-none focus:ring-2 focus:ring-primary/40"
              >
                <option value="laptop">{isAr ? "لابتوب" : "Laptop"}</option>
                <option value="phone">{isAr ? "جوال" : "Phone"}</option>
                <option value="vehicle">{isAr ? "سيارة" : "Vehicle"}</option>
                <option value="sim">{isAr ? "شريحة اتصال" : "SIM Card"}</option>
                <option value="access_card">{isAr ? "بطاقة دخول" : "Access Card"}</option>
                <option value="other">{isAr ? "أخرى" : "Other"}</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-bold">{isAr ? "الاسم (عربي)" : "Name (AR)"}</label>
                <input
                  type="text"
                  value={assetForm.nameAr}
                  onChange={(e) => setAssetForm((f) => ({ ...f, nameAr: e.target.value }))}
                  dir="rtl"
                  className="h-11 w-full rounded-xl bg-surface-container-high px-4 text-sm outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-bold">{isAr ? "الاسم (إنجليزي)" : "Name (EN)"}</label>
                <input
                  type="text"
                  value={assetForm.nameEn}
                  onChange={(e) => setAssetForm((f) => ({ ...f, nameEn: e.target.value }))}
                  dir="ltr"
                  className="h-11 w-full rounded-xl bg-surface-container-high px-4 text-sm outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-bold">{isAr ? "الرقم التسلسلي (اختياري)" : "Serial Number (optional)"}</label>
              <input
                type="text"
                value={assetForm.serialNumber}
                onChange={(e) => setAssetForm((f) => ({ ...f, serialNumber: e.target.value }))}
                dir="ltr"
                className="h-11 w-full rounded-xl bg-surface-container-high px-4 text-sm outline-none focus:ring-2 focus:ring-primary/40 font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-bold">{isAr ? "تاريخ التسليم" : "Issue Date"}</label>
              <input
                type="date"
                value={assetForm.issuedAt}
                onChange={(e) => setAssetForm((f) => ({ ...f, issuedAt: e.target.value }))}
                className="h-11 w-full rounded-xl bg-surface-container-high px-4 text-sm outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-bold">{isAr ? "ملاحظات (اختياري)" : "Notes (optional)"}</label>
              <textarea
                value={assetForm.notes}
                onChange={(e) => setAssetForm((f) => ({ ...f, notes: e.target.value }))}
                rows={2}
                className="w-full rounded-xl bg-surface-container-high px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40 resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssetDialogOpen(false)} disabled={assetSaving}>
              {t.common.cancel}
            </Button>
            <Button onClick={submitAsset} disabled={assetSaving}>
              {assetSaving && <Icon name="progress_activity" size={16} className="animate-spin" />}
              {assetSaving ? (isAr ? "جاري الحفظ..." : "Saving...") : (isAr ? "حفظ" : "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
