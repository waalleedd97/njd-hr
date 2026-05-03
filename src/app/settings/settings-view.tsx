"use client";

import { useState, useEffect, useCallback } from "react";
import { useLanguage, useAuth } from "@/components/providers";
import { useData } from "@/lib/data-store";
import {
  type NotificationPreferences,
  fetchPreferences,
  savePreferences,
  requestPushPermission,
} from "@/lib/notifications";
import {
  saudiHolidays,
  penaltyRules,
  earlyDepartureRules,
  geofenceConfig,
  ROLE_PERMISSIONS,
  type Branch,
  type Role,
  type ComplianceItem,
} from "@/lib/mock-data";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { supabase } from "@/lib/supabase";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn, formatDate } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Icon } from "@/components/ui/icon";
import {
  Building2,
  Shield,
  Users,
  CheckCircle,
  XCircle,
  Save,
  MapPin,
  Calendar,
  AlertTriangle,
  Locate,
  Radar,
  Plus,
  Check,
  Layers,
  Pencil,
  Trash2,
  Info,
} from "lucide-react";
import { useDataHydration } from "@/lib/hooks/use-data-hydration";
import type { SettingsSlice } from "@/lib/data/server";

const tabs = [
  "departments",
  "companyInfo",
  "branches",
  "rolesPermissions",
  "compliance",
  "holidays",
  "geofence",
  "penalties",
  "notifications",
] as const;
type Tab = (typeof tabs)[number];

const tabIcons: Record<Tab, string> = {
  departments: "category",
  companyInfo: "business",
  branches: "location_city",
  rolesPermissions: "group",
  compliance: "shield",
  holidays: "event",
  geofence: "my_location",
  penalties: "gavel",
  notifications: "notifications",
};

export function SettingsView({ initialSlice }: { initialSlice: SettingsSlice }) {
  useDataHydration(initialSlice);
  const { t, lang } = useLanguage();
  const isAr = lang === "ar";
  const { user } = useAuth();
  const store = useData();
  const toast = useToast();
  const { confirm } = useConfirm();
  const {
    settings, updateSettings, addNotification,
    branches: storeBranches, roles: storeRoles, compliance: storeCompliance,
    addBranch, updateBranch, removeBranch,
    addRole, updateRole, removeRole,
    updateCompliance,
  } = store;

  // Notification preferences
  const [notifPrefs, setNotifPrefs] = useState<NotificationPreferences>({
    email_notifications: true,
    push_notifications: true,
    attendance_reminders: true,
    leave_updates: true,
    payroll_updates: true,
  });
  const [notifSaved, setNotifSaved] = useState(false);
  const [notifSaving, setNotifSaving] = useState(false);

  useEffect(() => {
    if (user.id) fetchPreferences(user.id).then(setNotifPrefs);
  }, [user.id]);

  const handleNotifToggle = useCallback((key: keyof NotificationPreferences) => {
    setNotifPrefs((p) => ({ ...p, [key]: !p[key] }));
    setNotifSaved(false);
  }, []);

  const handleSaveNotifPrefs = useCallback(async () => {
    if (notifSaving) return;
    setNotifSaving(true);
    try {
      await savePreferences(user.id, notifPrefs);
      if (notifPrefs.push_notifications) {
        await requestPushPermission(user.id);
      }
      setNotifSaved(true);
      setTimeout(() => setNotifSaved(false), 2000);
    } finally {
      setNotifSaving(false);
    }
  }, [user.id, notifPrefs, notifSaving]);

  const [activeTab, setActiveTab] = useState<Tab>("companyInfo");
  const [geofenceEnabled, setGeofenceEnabled] = useState(settings.geofenceEnabled);
  const [geofenceRadius, setGeofenceRadius] = useState(settings.geofenceRadius);
  const [companySaved, setCompanySaved] = useState(false);
  const [geofenceSaved, setGeofenceSaved] = useState(false);

  // Holiday dialog state
  const [showHolidayDialog, setShowHolidayDialog] = useState(false);
  type CustomHoliday = { id: string; nameAr: string; nameEn: string; startDate: string; endDate: string; days: number };
  const [customHolidays, setCustomHolidays] = useState<CustomHoliday[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem("njd-hr-custom-holidays");
      return raw ? (JSON.parse(raw) as CustomHoliday[]) : [];
    } catch { return []; }
  });
  useEffect(() => {
    try { localStorage.setItem("njd-hr-custom-holidays", JSON.stringify(customHolidays)); }
    catch { /* quota exceeded or disabled */ }
  }, [customHolidays]);
  const [newHolidayName, setNewHolidayName] = useState("");
  const [newHolidayStart, setNewHolidayStart] = useState("");
  const [newHolidayEnd, setNewHolidayEnd] = useState("");

  // Sync geofence state when settings change externally
  useEffect(() => {
    setGeofenceEnabled(settings.geofenceEnabled);
    setGeofenceRadius(settings.geofenceRadius);
  }, [settings.geofenceEnabled, settings.geofenceRadius]);

  // Company info form state
  const [companyName, setCompanyName] = useState(
    isAr ? settings.companyNameAr : settings.companyNameEn
  );
  const [crNumber, setCrNumber] = useState(settings.crNumber);
  const [address, setAddress] = useState(
    isAr ? settings.addressAr : settings.addressEn
  );
  const [city, setCity] = useState(
    isAr ? settings.cityAr : settings.cityEn
  );
  const [country, setCountry] = useState(
    isAr ? settings.countryAr : settings.countryEn
  );
  const [industry, setIndustry] = useState(
    isAr ? settings.industryAr : settings.industryEn
  );

  // Department management state
  const [deptDialogOpen, setDeptDialogOpen] = useState(false);
  const [deptEditKey, setDeptEditKey] = useState<string | null>(null);
  const [deptNameAr, setDeptNameAr] = useState("");
  const [deptNameEn, setDeptNameEn] = useState("");
  const [deptKey, setDeptKey] = useState("");

  const tabLabels: Record<Tab, string> = {
    departments: t.dept.title,
    companyInfo: t.set.companyInfo,
    branches: t.set.branches,
    rolesPermissions: t.set.rolesPermissions,
    compliance: t.set.compliance,
    holidays: t.holiday.title,
    geofence: t.clock.geofence,
    penalties: t.penalty.title,
    notifications: t.set.notifications,
  };

  const inputClass =
    "h-11 w-full rounded-xl bg-surface-container-high px-4 text-sm outline-none focus:ring-2 focus:ring-primary/40";

  // Compliance calculations (Supabase-backed)
  const compliantCount = storeCompliance.filter((item) => item.compliant).length;
  const totalComplianceItems = Math.max(1, storeCompliance.length);

  // Branch / Role / Compliance dialog state
  const [branchDialogOpen, setBranchDialogOpen] = useState(false);
  const [branchEditing, setBranchEditing] = useState<Branch | null>(null);
  const [branchForm, setBranchForm] = useState({ nameAr: "", nameEn: "", cityAr: "", cityEn: "", isMain: false });
  const [branchSaving, setBranchSaving] = useState(false);

  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [roleEditing, setRoleEditing] = useState<Role | null>(null);
  const [roleForm, setRoleForm] = useState<{ nameAr: string; nameEn: string; permissions: string[] }>({ nameAr: "", nameEn: "", permissions: [] });
  const [roleSaving, setRoleSaving] = useState(false);

  const [complianceDialogOpen, setComplianceDialogOpen] = useState(false);
  const [complianceEditing, setComplianceEditing] = useState<ComplianceItem | null>(null);
  const [complianceForm, setComplianceForm] = useState({ titleAr: "", titleEn: "", descAr: "", descEn: "", compliant: false });
  const [complianceSaving, setComplianceSaving] = useState(false);

  // Branch handlers
  const openNewBranch = () => {
    setBranchEditing(null);
    setBranchForm({ nameAr: "", nameEn: "", cityAr: "", cityEn: "", isMain: false });
    setBranchDialogOpen(true);
  };
  const openEditBranch = (b: Branch) => {
    setBranchEditing(b);
    setBranchForm({ nameAr: b.nameAr, nameEn: b.nameEn, cityAr: b.cityAr, cityEn: b.cityEn, isMain: b.isMain });
    setBranchDialogOpen(true);
  };
  const submitBranch = async () => {
    if (branchSaving) return;
    if (!branchForm.nameAr || !branchForm.nameEn || !branchForm.cityAr || !branchForm.cityEn) {
      toast.warning(isAr ? "كل الحقول مطلوبة" : "All fields required");
      return;
    }
    setBranchSaving(true);
    try {
      if (branchEditing) {
        await updateBranch(branchEditing.id, branchForm);
        toast.success(isAr ? "تم تحديث الفرع" : "Branch updated");
      } else {
        await addBranch(branchForm);
        toast.success(isAr ? "تمت إضافة الفرع" : "Branch added");
      }
      setBranchDialogOpen(false);
    } catch (err) {
      console.error("[settings] branch save failed:", err);
      toast.error(isAr ? "فشل حفظ الفرع" : "Failed to save branch");
    } finally {
      setBranchSaving(false);
    }
  };
  const deleteBranch = async (b: Branch) => {
    const ok = await confirm({
      title: isAr ? "حذف الفرع" : "Delete Branch",
      description: isAr ? `حذف "${b.nameAr}"؟` : `Delete "${b.nameEn}"?`,
      confirmLabel: isAr ? "حذف" : "Delete",
      cancelLabel: isAr ? "إلغاء" : "Cancel",
      variant: "danger",
    });
    if (!ok) return;
    try {
      await removeBranch(b.id);
      toast.success(isAr ? "تم حذف الفرع" : "Branch deleted");
    } catch (err) {
      console.error("[settings] branch delete failed:", err);
      toast.error(isAr ? "فشل حذف الفرع" : "Failed to delete branch");
    }
  };

  // Role handlers
  const openNewRole = () => {
    setRoleEditing(null);
    setRoleForm({ nameAr: "", nameEn: "", permissions: [] });
    setRoleDialogOpen(true);
  };
  const openEditRole = (r: Role) => {
    setRoleEditing(r);
    setRoleForm({ nameAr: r.nameAr, nameEn: r.nameEn, permissions: [...r.permissions] });
    setRoleDialogOpen(true);
  };
  const togglePermission = (p: string) => {
    setRoleForm((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(p)
        ? prev.permissions.filter((x) => x !== p)
        : [...prev.permissions, p],
    }));
  };
  const submitRole = async () => {
    if (roleSaving) return;
    if (!roleForm.nameAr || !roleForm.nameEn) {
      toast.warning(isAr ? "اسم الدور مطلوب بالعربية والإنجليزية" : "Role name required in both languages");
      return;
    }
    setRoleSaving(true);
    try {
      if (roleEditing) {
        await updateRole(roleEditing.id, roleForm);
        toast.success(isAr ? "تم تحديث الدور" : "Role updated");
      } else {
        await addRole(roleForm);
        toast.success(isAr ? "تمت إضافة الدور" : "Role added");
      }
      setRoleDialogOpen(false);
    } catch (err) {
      console.error("[settings] role save failed:", err);
      toast.error(isAr ? "فشل حفظ الدور" : "Failed to save role");
    } finally {
      setRoleSaving(false);
    }
  };
  const deleteRole = async (r: Role) => {
    if (r.users > 0) {
      toast.warning(isAr ? "لا يمكن حذف دور مرتبط بمستخدمين" : "Cannot delete a role with assigned users");
      return;
    }
    const ok = await confirm({
      title: isAr ? "حذف الدور" : "Delete Role",
      description: isAr ? `حذف "${r.nameAr}"؟` : `Delete "${r.nameEn}"?`,
      confirmLabel: isAr ? "حذف" : "Delete",
      cancelLabel: isAr ? "إلغاء" : "Cancel",
      variant: "danger",
    });
    if (!ok) return;
    try {
      await removeRole(r.id);
      toast.success(isAr ? "تم حذف الدور" : "Role deleted");
    } catch (err) {
      console.error("[settings] role delete failed:", err);
      toast.error(isAr ? "فشل حذف الدور" : "Failed to delete role");
    }
  };

  // Compliance handlers
  const openEditCompliance = (item: ComplianceItem) => {
    setComplianceEditing(item);
    setComplianceForm({ titleAr: item.titleAr, titleEn: item.titleEn, descAr: item.descAr, descEn: item.descEn, compliant: item.compliant });
    setComplianceDialogOpen(true);
  };
  const submitCompliance = async () => {
    if (complianceSaving || !complianceEditing) return;
    setComplianceSaving(true);
    try {
      await updateCompliance(complianceEditing.id, complianceForm);
      toast.success(isAr ? "تم تحديث بند الالتزام" : "Compliance item updated");
      setComplianceDialogOpen(false);
    } catch (err) {
      console.error("[settings] compliance save failed:", err);
      toast.error(isAr ? "فشل التحديث" : "Failed to update");
    } finally {
      setComplianceSaving(false);
    }
  };
  const toggleCompliant = async (item: ComplianceItem) => {
    try {
      await updateCompliance(item.id, { compliant: !item.compliant });
      toast.success(isAr ? "تم التحديث" : "Updated");
    } catch (err) {
      console.error("[settings] compliance toggle failed:", err);
      toast.error(isAr ? "فشل التحديث" : "Failed to update");
    }
  };
  const compliancePercentage = Math.round(
    (compliantCount / totalComplianceItems) * 100
  );
  const barColor =
    compliancePercentage > 80
      ? "bg-emerald-500"
      : compliancePercentage > 60
        ? "bg-amber-500"
        : "bg-red-500";
  const barTextColor =
    compliancePercentage > 80
      ? "text-emerald-600 dark:text-emerald-400"
      : compliancePercentage > 60
        ? "text-amber-600 dark:text-amber-400"
        : "text-red-600 dark:text-red-400";

  // Holiday calculations
  const now = new Date();
  const totalHolidayDays = saudiHolidays.reduce((sum, h) => sum + h.days, 0);

  const holidayColors = [
    { bg: "bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400", badge: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-400" },
    { bg: "bg-blue-500/10", text: "text-blue-600 dark:text-blue-400", badge: "bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-400" },
    { bg: "bg-purple-500/10", text: "text-purple-600 dark:text-purple-400", badge: "bg-purple-100 text-purple-800 dark:bg-purple-500/15 dark:text-purple-400" },
    { bg: "bg-amber-500/10", text: "text-amber-600 dark:text-amber-400", badge: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-400" },
  ];

  // Penalty badge color helper
  function getPenaltyBadgeClass(percentage: number) {
    if (percentage === 0) return "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-400";
    if (percentage <= 10) return "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-400";
    return "bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-400";
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="font-headline text-3xl md:text-4xl font-extrabold text-on-surface tracking-tight">
          {t.set.title}
        </h1>
      </div>

      {/* Tab Navigation */}
      <div className="overflow-x-auto">
        <div className="inline-flex items-center bg-surface-container rounded-full p-1 gap-1">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "rounded-full px-5 py-2 text-sm font-bold transition-all flex items-center gap-2 shrink-0",
                activeTab === tab
                  ? "gradient-btn shadow-primary-glow"
                  : "text-on-surface-variant hover:text-on-surface"
              )}
            >
              <Icon name={tabIcons[tab]} size={18} fill={activeTab === tab} />
              {tabLabels[tab]}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === "departments" && (
        <div className="bg-surface-container-lowest rounded-2xl shadow-sm p-5 lg:p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                <Layers className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <h2 className="text-lg font-bold">{t.dept.title}</h2>
            </div>
            <Button className="gap-2" onClick={() => {
              setDeptEditKey(null);
              setDeptKey("");
              setDeptNameAr("");
              setDeptNameEn("");
              setDeptDialogOpen(true);
            }}>
              <Plus className="w-4 h-4" />
              {t.dept.addDept}
            </Button>
          </div>

          <div className="space-y-3">
            {Object.entries(store.departments).map(([key, dept]) => {
              const empCount = store.employees.filter((e) => e.department === key).length;
              return (
                <div key={key} className="flex items-center justify-between p-4 rounded-xl border border-outline-variant/20 hover:bg-surface-container-low/30 transition-colors">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{isAr ? dept.ar : dept.en}</p>
                    <p className="text-xs text-on-surface-variant">{isAr ? dept.en : dept.ar} · {empCount} {isAr ? "موظف" : "employees"}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => {
                      setDeptEditKey(key);
                      setDeptKey(key);
                      setDeptNameAr(dept.ar);
                      setDeptNameEn(dept.en);
                      setDeptDialogOpen(true);
                    }}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-600" onClick={async () => {
                      if (empCount > 0) {
                        toast.warning(t.dept.hasEmployees);
                        return;
                      }
                      const ok = await confirm({
                        title: isAr ? "حذف القسم" : "Delete Department",
                        description: t.dept.confirmDelete,
                        confirmLabel: isAr ? "حذف" : "Delete",
                        cancelLabel: isAr ? "إلغاء" : "Cancel",
                        variant: "danger",
                      });
                      if (ok) {
                        try {
                          store.removeDepartment(key);
                          toast.success(isAr ? "تم حذف القسم" : "Department deleted");
                        } catch {
                          toast.error(isAr ? "فشل حذف القسم" : "Failed to delete department");
                        }
                      }
                    }}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activeTab === "companyInfo" && (
        <div className="bg-surface-container-lowest rounded-2xl shadow-sm p-5 lg:p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <h2 className="text-lg font-semibold text-on-surface">
              {t.set.companyInfo}
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Company Name */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-on-surface">
                {t.set.companyName}
              </label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className={inputClass}
              />
            </div>

            {/* CR Number */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-on-surface">
                {t.set.crNumber}
              </label>
              <input
                type="text"
                value={crNumber}
                onChange={(e) => setCrNumber(e.target.value)}
                className={inputClass}
              />
            </div>

            {/* Address */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-on-surface">
                {t.set.address}
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className={inputClass}
              />
            </div>

            {/* City */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-on-surface">
                {t.set.city}
              </label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className={inputClass}
              />
            </div>

            {/* Country */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-on-surface">
                {t.set.country}
              </label>
              <input
                type="text"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className={inputClass}
              />
            </div>

            {/* Industry */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-on-surface">
                {t.set.industry}
              </label>
              <input
                type="text"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end mt-6 pt-4 border-t border-outline-variant/20">
            <Button
              className="gap-2"
              onClick={async () => {
                try {
                  await updateSettings({
                    companyNameAr: isAr ? companyName : settings.companyNameAr,
                    companyNameEn: isAr ? settings.companyNameEn : companyName,
                    crNumber,
                    addressAr: isAr ? address : settings.addressAr,
                    addressEn: isAr ? settings.addressEn : address,
                    cityAr: isAr ? city : settings.cityAr,
                    cityEn: isAr ? settings.cityEn : city,
                    countryAr: isAr ? country : settings.countryAr,
                    countryEn: isAr ? settings.countryEn : country,
                    industryAr: isAr ? industry : settings.industryAr,
                    industryEn: isAr ? settings.industryEn : industry,
                  });
                  toast.success(isAr ? "تم حفظ معلومات الشركة" : "Company info saved");
                  setCompanySaved(true);
                  setTimeout(() => setCompanySaved(false), 2000);
                } catch (err) {
                  console.error("[settings] save company failed:", err);
                  toast.error(isAr ? "فشل الحفظ في القاعدة" : "Failed to save to database");
                }
              }}
            >
              {companySaved ? (
                <Check className="w-4 h-4" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {companySaved
                ? isAr ? "تم الحفظ" : "Saved!"
                : t.set.saveChanges}
            </Button>
          </div>
        </div>
      )}

      {activeTab === "branches" && (
        <div className="bg-surface-container-lowest rounded-2xl shadow-sm p-5 lg:p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                <MapPin className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h2 className="text-lg font-semibold text-on-surface">{t.set.branches}</h2>
            </div>
            <Button className="gap-2" onClick={openNewBranch}>
              <Plus className="w-4 h-4" />
              {isAr ? "إضافة فرع" : "Add Branch"}
            </Button>
          </div>
          <div className="overflow-x-auto -mx-5 lg:-mx-6 px-5 lg:px-6">
            <table className="w-full min-w-[600px]">
              <thead>
                <tr className="text-xs text-on-surface-variant border-b border-outline-variant/20">
                  <th className="text-start pb-3 font-medium">{t.set.branchName}</th>
                  <th className="text-start pb-3 font-medium">{t.set.location}</th>
                  <th className="text-start pb-3 font-medium">{t.set.employeeCount}</th>
                  <th className="text-start pb-3 font-medium">{t.common.status}</th>
                  <th className="text-end pb-3 font-medium">{t.common.actions}</th>
                </tr>
              </thead>
              <tbody>
                {storeBranches.map((branch) => (
                  <tr key={branch.id} className="border-b border-outline-variant/20/50 last:border-0 hover:bg-surface-container-low/30 transition-colors">
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-on-surface-variant" />
                        <span className="text-sm font-medium">{isAr ? branch.nameAr : branch.nameEn}</span>
                      </div>
                    </td>
                    <td className="py-3 text-sm text-on-surface-variant">{isAr ? branch.cityAr : branch.cityEn}</td>
                    <td className="py-3 text-sm text-on-surface-variant">{branch.employeeCount}</td>
                    <td className="py-3">
                      {branch.isMain ? (
                        <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-400 border-0 text-[11px]">
                          {t.set.mainBranch}
                        </Badge>
                      ) : (
                        <Badge className="bg-muted text-on-surface-variant border-0 text-[11px]">
                          {t.set.branches}
                        </Badge>
                      )}
                    </td>
                    <td className="py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEditBranch(branch)} aria-label={isAr ? "تعديل" : "Edit"}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-500 hover:text-red-600"
                          onClick={() => deleteBranch(branch)}
                          disabled={branch.isMain}
                          title={branch.isMain ? (isAr ? "لا يمكن حذف الفرع الرئيسي" : "Main branch cannot be deleted") : ""}
                          aria-label={isAr ? "حذف" : "Delete"}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {storeBranches.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-on-surface-variant text-sm">{t.common.noData}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "rolesPermissions" && (
        <div className="bg-surface-container-lowest rounded-2xl shadow-sm p-5 lg:p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <h2 className="text-lg font-semibold text-on-surface">{t.set.rolesPermissions}</h2>
            </div>
            <Button className="gap-2" onClick={openNewRole}>
              <Plus className="w-4 h-4" />
              {isAr ? "إضافة دور" : "Add Role"}
            </Button>
          </div>
          <p className="text-xs text-on-surface-variant mb-4 px-1">
            {isAr
              ? "ملاحظة: تخصيص هذه الأدوار للمستخدمين يتم من لوحة Landing Page الإدارية، ولا تستبدل نظام RBAC الأصلي (super_admin / employee)."
              : "Note: assigning these roles to users is done in the Landing Page admin panel and does not replace the core RBAC roles (super_admin / employee)."}
          </p>
          <div className="overflow-x-auto -mx-5 lg:-mx-6 px-5 lg:px-6">
            <table className="w-full min-w-[700px]">
              <thead>
                <tr className="text-xs text-on-surface-variant border-b border-outline-variant/20">
                  <th className="text-start pb-3 font-medium">{t.set.roleName}</th>
                  <th className="text-start pb-3 font-medium">{t.set.users}</th>
                  <th className="text-start pb-3 font-medium">{t.set.permissions}</th>
                  <th className="text-end pb-3 font-medium">{t.common.actions}</th>
                </tr>
              </thead>
              <tbody>
                {storeRoles.map((role) => (
                  <tr key={role.id} className="border-b border-outline-variant/20/50 last:border-0 hover:bg-surface-container-low/30 transition-colors">
                    <td className="py-3">
                      <span className="text-sm font-medium">{isAr ? role.nameAr : role.nameEn}</span>
                    </td>
                    <td className="py-3 text-sm text-on-surface-variant tabular-nums">{role.users}</td>
                    <td className="py-3">
                      <div className="flex flex-wrap gap-1.5">
                        {role.permissions.map((perm) => (
                          <Badge key={perm} variant="secondary" className="text-[10px] font-medium">
                            {perm}
                          </Badge>
                        ))}
                      </div>
                    </td>
                    <td className="py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEditRole(role)} aria-label={isAr ? "تعديل" : "Edit"}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-500 hover:text-red-600"
                          onClick={() => deleteRole(role)}
                          disabled={role.users > 0}
                          title={role.users > 0 ? (isAr ? "لا يمكن حذف دور مرتبط بمستخدمين" : "Role has assigned users") : ""}
                          aria-label={isAr ? "حذف" : "Delete"}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {storeRoles.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-10 text-center text-on-surface-variant text-sm">{t.common.noData}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "compliance" && (
        <div className="space-y-6">
          {/* Compliance Score Card */}
          <div className="bg-surface-container-lowest rounded-2xl shadow-sm p-5 lg:p-6 hover-lift">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <Shield className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-on-surface">{t.set.complianceScore}</h2>
                <p className="text-sm text-on-surface-variant">{t.set.saudiLaborLaw}</p>
              </div>
            </div>
            <div className="flex items-end gap-4 mb-3">
              <span className={cn("text-4xl font-bold", barTextColor)}>{compliancePercentage}%</span>
              <span className="text-sm text-on-surface-variant pb-1">
                {compliantCount}/{totalComplianceItems} {t.set.compliant}
              </span>
            </div>
            <div className="w-full h-3 rounded-full bg-muted overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all", barColor)}
                style={{ width: `${compliancePercentage}%` }}
              />
            </div>
          </div>

          {/* Compliance Checklist (editable — click icon to toggle, pencil to edit) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {storeCompliance.map((item) => (
              <div
                key={item.id}
                className={cn(
                  "bg-surface-container-lowest rounded-2xl shadow-sm p-4 hover-lift transition-all",
                  item.compliant
                    ? "border-emerald-200 dark:border-emerald-500/20"
                    : "border-red-200 dark:border-red-500/20"
                )}
              >
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    onClick={() => toggleCompliant(item)}
                    aria-label={isAr ? "تبديل الحالة" : "Toggle status"}
                    className="shrink-0 mt-0.5 hover:scale-110 transition-transform"
                  >
                    {item.compliant ? (
                      <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                    )}
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <h3 className="text-sm font-semibold text-on-surface">
                        {isAr ? item.titleAr : item.titleEn}
                      </h3>
                      <div className="flex items-center gap-1">
                        <Badge
                          className={cn(
                            "text-[10px] font-medium shrink-0 border-0",
                            item.compliant
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-400"
                              : "bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-400"
                          )}
                        >
                          {item.compliant ? t.set.compliant : t.set.notCompliant}
                        </Badge>
                        <Button variant="ghost" size="sm" onClick={() => openEditCompliance(item)} aria-label={isAr ? "تعديل" : "Edit"} className="-mr-2">
                          <Pencil className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                    <p className="text-xs text-on-surface-variant leading-relaxed">
                      {isAr ? item.descAr : item.descEn}
                    </p>
                    {item.reviewedAt && (
                      <p className="text-[10px] text-on-surface-variant/70 mt-1.5 tabular-nums">
                        {isAr ? "آخر مراجعة:" : "Last reviewed:"}{" "}
                        {new Date(item.reviewedAt).toLocaleDateString(
                          isAr ? "ar-SA-u-nu-latn" : "en-US",
                          { year: "numeric", month: "short", day: "numeric" }
                        )}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── Holidays Tab ─────────────────────────────────────────────── */}
      {activeTab === "holidays" && (
        <div className="bg-surface-container-lowest rounded-2xl shadow-sm p-5 lg:p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <h2 className="text-lg font-semibold text-on-surface">
                {t.holiday.saudiHolidays}
              </h2>
            </div>
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => setShowHolidayDialog(true)}
            >
              <Plus className="w-4 h-4" />
              {t.holiday.addCustom}
            </Button>
          </div>

          {/* Add Custom Holiday Dialog */}
          <Dialog open={showHolidayDialog} onOpenChange={(v) => {
            setShowHolidayDialog(v);
            if (!v) { setNewHolidayName(""); setNewHolidayStart(""); setNewHolidayEnd(""); }
          }}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>{t.holiday.addCustom}</DialogTitle>
                <DialogDescription className="sr-only">{t.holiday.addCustom}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-1.5">
                  <label className="text-sm font-bold text-on-surface">
                    {isAr ? "اسم العطلة" : "Holiday Name"}
                  </label>
                  <input
                    type="text"
                    value={newHolidayName}
                    onChange={(e) => setNewHolidayName(e.target.value)}
                    placeholder={isAr ? "أدخل اسم العطلة" : "Enter holiday name"}
                    className={inputClass}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-sm font-bold text-on-surface">
                      {isAr ? "تاريخ البداية" : "Start Date"}
                    </label>
                    <input
                      type="date"
                      value={newHolidayStart}
                      onChange={(e) => setNewHolidayStart(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-bold text-on-surface">
                      {isAr ? "تاريخ النهاية" : "End Date"}
                    </label>
                    <input
                      type="date"
                      value={newHolidayEnd}
                      onChange={(e) => setNewHolidayEnd(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowHolidayDialog(false);
                    setNewHolidayName("");
                    setNewHolidayStart("");
                    setNewHolidayEnd("");
                  }}
                >
                  {isAr ? "إلغاء" : "Cancel"}
                </Button>
                <Button
                  disabled={!newHolidayName || !newHolidayStart || !newHolidayEnd}
                  onClick={() => {
                    const start = new Date(newHolidayStart);
                    const end = new Date(newHolidayEnd);
                    const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);
                    setCustomHolidays((prev) => [
                      ...prev,
                      {
                        id: `custom-${Date.now()}`,
                        nameAr: newHolidayName,
                        nameEn: newHolidayName,
                        startDate: newHolidayStart,
                        endDate: newHolidayEnd,
                        days,
                      },
                    ]);
                    addNotification({
                      type: "system",
                      titleAr: "تمت إضافة عطلة",
                      titleEn: "Holiday Added",
                      descAr: `تمت إضافة "${newHolidayName}" كعطلة مخصصة`,
                      descEn: `"${newHolidayName}" added as custom holiday`,
                      time: 0,
                      read: false,
                    });
                    setShowHolidayDialog(false);
                    setNewHolidayName("");
                    setNewHolidayStart("");
                    setNewHolidayEnd("");
                  }}
                >
                  <Plus className="w-4 h-4" />
                  {isAr ? "إضافة" : "Add"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {saudiHolidays.map((h, idx) => {
              const isUpcoming = h.startDate ? new Date(h.startDate) > now : false;
              const color = holidayColors[idx % holidayColors.length];

              return (
                <div
                  key={h.id}
                  className={cn(
                    "bg-surface-container-lowest rounded-2xl shadow-sm p-4 hover-lift transition-all",
                    isUpcoming
                      ? "border-blue-200 dark:border-blue-500/20"
                      : "border-outline-variant/20 opacity-75"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                        isUpcoming ? color.bg : "bg-muted"
                      )}
                    >
                      <Calendar
                        className={cn(
                          "w-5 h-5",
                          isUpcoming ? color.text : "text-on-surface-variant"
                        )}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <h3 className="text-sm font-semibold text-on-surface">
                          {isAr ? h.nameAr : h.nameEn}
                        </h3>
                        <div className="flex items-center gap-2 shrink-0">
                          {isUpcoming && (
                            <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-400 border-0 text-[10px]">
                              {t.holiday.upcoming}
                            </Badge>
                          )}
                          <Badge
                            className={cn(
                              "border-0 text-[10px]",
                              isUpcoming ? color.badge : "bg-muted text-on-surface-variant"
                            )}
                          >
                            {h.days === 1
                              ? `1 ${t.holiday.day}`
                              : `${h.days} ${t.holiday.daysCount}`}
                          </Badge>
                        </div>
                      </div>
                      {h.startDate && (
                        <p className="text-xs text-on-surface-variant">
                          {formatDate(h.startDate, lang, { month: "long", day: "numeric" })}
                          {h.endDate && h.startDate !== h.endDate && (
                            <>
                              {" — "}
                              {formatDate(h.endDate, lang, { month: "long", day: "numeric" })}
                            </>
                          )}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Custom Holidays */}
            {customHolidays.map((h, idx) => {
              const isUpcoming = h.startDate ? new Date(h.startDate) > now : false;
              const color = holidayColors[(saudiHolidays.length + idx) % holidayColors.length];

              return (
                <div
                  key={h.id}
                  className={cn(
                    "bg-surface-container-lowest rounded-2xl shadow-sm p-4 hover-lift transition-all",
                    isUpcoming
                      ? "border-blue-200 dark:border-blue-500/20"
                      : "border-outline-variant/20 opacity-75"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                        isUpcoming ? color.bg : "bg-muted"
                      )}
                    >
                      <Calendar
                        className={cn(
                          "w-5 h-5",
                          isUpcoming ? color.text : "text-on-surface-variant"
                        )}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <h3 className="text-sm font-semibold text-on-surface">
                          {isAr ? h.nameAr : h.nameEn}
                        </h3>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-500/15 dark:text-purple-400 border-0 text-[10px]">
                            {isAr ? "مخصصة" : "Custom"}
                          </Badge>
                          <Badge
                            className={cn(
                              "border-0 text-[10px]",
                              isUpcoming ? color.badge : "bg-muted text-on-surface-variant"
                            )}
                          >
                            {h.days === 1
                              ? `1 ${t.holiday.day}`
                              : `${h.days} ${t.holiday.daysCount}`}
                          </Badge>
                        </div>
                      </div>
                      {h.startDate && (
                        <p className="text-xs text-on-surface-variant">
                          {formatDate(h.startDate, lang, { month: "long", day: "numeric" })}
                          {h.endDate && h.startDate !== h.endDate && (
                            <>
                              {" — "}
                              {formatDate(h.endDate, lang, { month: "long", day: "numeric" })}
                            </>
                          )}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Total Holiday Days */}
          <div className="mt-6 pt-4 border-t border-outline-variant/20 flex items-center justify-between">
            <span className="text-sm text-on-surface-variant">
              {t.holiday.duration}
            </span>
            <span className="text-sm font-semibold text-on-surface">
              {totalHolidayDays + customHolidays.reduce((sum, h) => sum + h.days, 0)} {t.holiday.daysCount}
            </span>
          </div>
        </div>
      )}

      {/* ─── Geofence Tab ─────────────────────────────────────────────── */}
      {activeTab === "geofence" && (
        <div className="bg-surface-container-lowest rounded-2xl shadow-sm p-5 lg:p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center">
              <Radar className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-on-surface">
                {t.clock.geofence}
              </h2>
              <p className="text-sm text-on-surface-variant">
                {t.clock.officeLocation}
              </p>
            </div>
          </div>

          {/* Toggle */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-muted/50 mb-6">
            <div className="flex items-center gap-3">
              <Locate className="w-5 h-5 text-on-surface-variant" />
              <span className="text-sm font-medium text-on-surface">
                {t.clock.geofence}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Badge
                className={cn(
                  "border-0 text-[11px]",
                  geofenceEnabled
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-400"
                    : "bg-muted text-on-surface-variant"
                )}
              >
                {geofenceEnabled
                  ? (isAr ? "مفعّل" : "Active")
                  : (isAr ? "معطّل" : "Disabled")}
              </Badge>
              <button
                onClick={() => setGeofenceEnabled(!geofenceEnabled)}
                className={cn(
                  "relative h-6 w-11 rounded-full transition-colors",
                  geofenceEnabled ? "bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.4)]" : "bg-surface-container-highest"
                )}
                aria-pressed={geofenceEnabled}
                aria-label={geofenceEnabled ? (isAr ? "تعطيل النطاق الجغرافي" : "Disable geofence") : (isAr ? "تفعيل النطاق الجغرافي" : "Enable geofence")}
              >
                <span
                  className={cn(
                    "absolute top-1 w-4 h-4 rounded-full bg-surface-container-lowest shadow transition-all",
                    geofenceEnabled ? "start-[22px]" : "start-1"
                  )}
                />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Office Details */}
            <div className="space-y-4">
              {/* Office Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-on-surface-variant uppercase tracking-wide">
                  {t.clock.officeLocation}
                </label>
                <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                  <MapPin className="w-4 h-4 text-on-surface-variant shrink-0" />
                  <span className="text-sm font-medium text-on-surface">
                    {isAr ? geofenceConfig.officeNameAr : geofenceConfig.officeNameEn}
                  </span>
                </div>
              </div>

              {/* Coordinates */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-on-surface-variant uppercase tracking-wide">
                    Lat
                  </label>
                  <div className="p-3 rounded-lg bg-muted/50">
                    <span className="text-sm font-mono text-on-surface">
                      {geofenceConfig.officeLat.toFixed(4)}
                    </span>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-on-surface-variant uppercase tracking-wide">
                    Lng
                  </label>
                  <div className="p-3 rounded-lg bg-muted/50">
                    <span className="text-sm font-mono text-on-surface">
                      {geofenceConfig.officeLng.toFixed(4)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Radius */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-on-surface-variant uppercase tracking-wide">
                  {t.clock.radius}
                </label>
                <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                  <Radar className="w-4 h-4 text-on-surface-variant shrink-0" />
                  <span className="text-sm font-medium text-on-surface">
                    {geofenceRadius} {t.clock.meters}
                  </span>
                </div>
              </div>
            </div>

            {/* Visual Geofence Representation */}
            <div className="flex items-center justify-center">
              <div className="relative">
                {/* Outer ring */}
                <div
                  className={cn(
                    "w-48 h-48 rounded-full border-2 border-dashed flex items-center justify-center transition-colors",
                    geofenceEnabled
                      ? "border-emerald-400/60 bg-emerald-500/5"
                      : "border-muted-foreground/30 bg-muted/30"
                  )}
                >
                  {/* Middle ring */}
                  <div
                    className={cn(
                      "w-32 h-32 rounded-full border flex items-center justify-center transition-colors",
                      geofenceEnabled
                        ? "border-emerald-400/40 bg-emerald-500/10"
                        : "border-muted-foreground/20 bg-muted/20"
                    )}
                  >
                    {/* Inner ring */}
                    <div
                      className={cn(
                        "w-16 h-16 rounded-full flex items-center justify-center transition-colors",
                        geofenceEnabled
                          ? "bg-emerald-500/20"
                          : "bg-muted/40"
                      )}
                    >
                      <Locate
                        className={cn(
                          "w-6 h-6",
                          geofenceEnabled
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-on-surface-variant"
                        )}
                      />
                    </div>
                  </div>
                </div>
                {/* Radius label */}
                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2">
                  <span
                    className={cn(
                      "text-xs font-medium px-2 py-0.5 rounded-full",
                      geofenceEnabled
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400"
                        : "bg-muted text-on-surface-variant"
                    )}
                  >
                    {geofenceRadius}m
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end mt-6 pt-4 border-t border-outline-variant/20">
            <Button
              className="gap-2"
              onClick={async () => {
                try {
                  await updateSettings({ geofenceEnabled, geofenceRadius });
                  toast.success(isAr ? "تم حفظ إعدادات النطاق الجغرافي" : "Geofence settings saved");
                  setGeofenceSaved(true);
                  setTimeout(() => setGeofenceSaved(false), 2000);
                } catch (err) {
                  console.error("[settings] save geofence failed:", err);
                  toast.error(isAr ? "فشل الحفظ في القاعدة" : "Failed to save to database");
                }
              }}
            >
              {geofenceSaved ? (
                <Check className="w-4 h-4" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {geofenceSaved
                ? isAr ? "تم الحفظ" : "Saved!"
                : t.set.saveChanges}
            </Button>
          </div>
        </div>
      )}

      {/* ─── Penalties Tab ────────────────────────────────────────────── */}
      {activeTab === "penalties" && (
        <div className="bg-surface-container-lowest rounded-2xl shadow-sm p-5 lg:p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-on-surface">
                {t.penalty.rules}
              </h2>
              <p className="text-sm text-on-surface-variant">
                {t.set.saudiLaborLaw}
              </p>
            </div>
          </div>

          <div className="overflow-x-auto -mx-5 lg:-mx-6 px-5 lg:px-6">
            <table className="w-full min-w-[500px]">
              <thead>
                <tr className="text-xs text-on-surface-variant border-b border-outline-variant/20">
                  <th className="text-start pb-3 font-medium">
                    {t.penalty.condition}
                  </th>
                  <th className="text-start pb-3 font-medium">
                    {t.penalty.deduction}
                  </th>
                  <th className="text-start pb-3 font-medium">%</th>
                </tr>
              </thead>
              <tbody>
                {penaltyRules.map((rule) => (
                  <tr
                    key={rule.id}
                    className="border-b border-outline-variant/20/50 last:border-0 hover:bg-surface-container-low/30 transition-colors"
                  >
                    <td className="py-3">
                      <span className="text-sm font-medium text-on-surface">
                        {isAr ? rule.conditionAr : rule.conditionEn}
                      </span>
                    </td>
                    <td className="py-3 text-sm text-on-surface-variant">
                      {isAr ? rule.deductionAr : rule.deductionEn}
                    </td>
                    <td className="py-3">
                      <Badge
                        className={cn(
                          "border-0 text-[11px]",
                          getPenaltyBadgeClass(rule.percentage)
                        )}
                      >
                        {rule.percentage === 0
                          ? `0% (${t.penalty.warning})`
                          : `${rule.percentage}%`}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Early Departure Rules */}
          <div className="mt-8 flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-on-surface">
                {isAr ? "جزاءات الانصراف المبكر" : "Early Departure Penalties"}
              </h2>
            </div>
          </div>

          <div className="overflow-x-auto -mx-5 lg:-mx-6 px-5 lg:px-6">
            <table className="w-full min-w-[500px]">
              <thead>
                <tr className="text-xs text-on-surface-variant border-b border-outline-variant/20">
                  <th className="text-start pb-3 font-medium">
                    {t.penalty.condition}
                  </th>
                  <th className="text-start pb-3 font-medium">
                    {t.penalty.deduction}
                  </th>
                  <th className="text-start pb-3 font-medium">%</th>
                </tr>
              </thead>
              <tbody>
                {earlyDepartureRules.map((rule) => (
                  <tr
                    key={rule.id}
                    className="border-b border-outline-variant/20/50 last:border-0 hover:bg-surface-container-low/30 transition-colors"
                  >
                    <td className="py-3">
                      <span className="text-sm font-medium text-on-surface">
                        {isAr ? rule.conditionAr : rule.conditionEn}
                      </span>
                    </td>
                    <td className="py-3 text-sm text-on-surface-variant">
                      {isAr ? rule.deductionAr : rule.deductionEn}
                    </td>
                    <td className="py-3">
                      <Badge
                        className={cn(
                          "border-0 text-[11px]",
                          getPenaltyBadgeClass(rule.percentage)
                        )}
                      >
                        {rule.percentage === 0
                          ? `0% (${t.penalty.warning})`
                          : `${rule.percentage}%`}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Remote employee exemption note */}
          <div className="mt-6 p-4 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 flex items-start gap-3">
            <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
            <p className="text-sm font-medium text-blue-700 dark:text-blue-400">
              {isAr ? "الموظفون عن بُعد معفيون من قواعد الجزاءات" : "Remote employees are exempt from penalty rules"}
            </p>
          </div>

          {/* Auto-calculated info box */}
          <div className="mt-4 p-4 rounded-xl bg-muted/50 flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-on-surface-variant mt-0.5 shrink-0" />
            <p className="text-sm text-on-surface-variant">
              {t.penalty.autoCalculated}
            </p>
          </div>
        </div>
      )}

      {/* ─── Notifications Settings ──────────────────────────────────── */}
      {activeTab === "notifications" && (
        <div className="bg-surface-container-lowest rounded-2xl shadow-sm p-6">
          <h3 className="font-bold text-lg mb-6">{t.set.notifications}</h3>
          <div className="space-y-4">
            {([
              { key: "email_notifications" as const, label: t.set.emailNotifications },
              { key: "push_notifications" as const, label: t.set.pushNotifications },
              { key: "attendance_reminders" as const, label: t.set.attendanceReminders },
              { key: "leave_updates" as const, label: t.set.leaveUpdates },
              { key: "payroll_updates" as const, label: t.set.payrollUpdates },
            ]).map((item) => (
              <div
                key={item.key}
                className="flex items-center justify-between p-4 rounded-xl border border-outline-variant/20 hover:bg-surface-container-low/30 transition-colors"
              >
                <span className="text-sm font-medium">{item.label}</span>
                <button
                  onClick={() => handleNotifToggle(item.key)}
                  className={cn(
                    "relative w-11 h-6 rounded-full transition-colors",
                    notifPrefs[item.key] ? "gradient-btn shadow-primary-glow" : "bg-surface-container-highest"
                  )}
                  aria-pressed={notifPrefs[item.key]}
                  aria-label={item.label}
                >
                  <span
                    className={cn(
                      "absolute top-0.5 w-5 h-5 rounded-full bg-surface-container-lowest shadow transition-all",
                      notifPrefs[item.key] ? "start-[22px]" : "start-0.5"
                    )}
                  />
                </button>
              </div>
            ))}
          </div>
          <div className="mt-6 flex items-center gap-3">
            <Button onClick={handleSaveNotifPrefs} disabled={notifSaving}>
              {notifSaving ? <Icon name="progress_activity" size={16} className="animate-spin" /> : <Save className="w-4 h-4" />}
              {notifSaving ? (isAr ? "جاري الحفظ..." : "Saving...") : t.set.saveChanges}
            </Button>
            {notifSaved && (
              <span className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">
                {t.set.notifSettingsSaved}
              </span>
            )}
          </div>
        </div>
      )}

      {/* ─── Branch Add/Edit Dialog ──────────────────────────────────── */}
      <Dialog open={branchDialogOpen} onOpenChange={setBranchDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{branchEditing ? (isAr ? "تعديل الفرع" : "Edit Branch") : (isAr ? "إضافة فرع" : "Add Branch")}</DialogTitle>
            <DialogDescription className="sr-only">{t.set.branches}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium block mb-1">{isAr ? "الاسم (عربي)" : "Name (Arabic)"}</label>
                <input type="text" value={branchForm.nameAr} onChange={(e) => setBranchForm((f) => ({ ...f, nameAr: e.target.value }))} dir="rtl" className={inputClass} />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">{isAr ? "الاسم (إنجليزي)" : "Name (English)"}</label>
                <input type="text" value={branchForm.nameEn} onChange={(e) => setBranchForm((f) => ({ ...f, nameEn: e.target.value }))} dir="ltr" className={inputClass} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium block mb-1">{isAr ? "المدينة (عربي)" : "City (Arabic)"}</label>
                <input type="text" value={branchForm.cityAr} onChange={(e) => setBranchForm((f) => ({ ...f, cityAr: e.target.value }))} dir="rtl" className={inputClass} />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">{isAr ? "المدينة (إنجليزي)" : "City (English)"}</label>
                <input type="text" value={branchForm.cityEn} onChange={(e) => setBranchForm((f) => ({ ...f, cityEn: e.target.value }))} dir="ltr" className={inputClass} />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={branchForm.isMain}
                onChange={(e) => setBranchForm((f) => ({ ...f, isMain: e.target.checked }))}
                className="w-4 h-4 rounded accent-primary"
              />
              <span>{isAr ? "الفرع الرئيسي" : "Main branch"}</span>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBranchDialogOpen(false)} disabled={branchSaving}>{t.common.cancel}</Button>
            <Button onClick={submitBranch} disabled={branchSaving}>
              {branchSaving && <Icon name="progress_activity" size={16} className="animate-spin" />}
              {branchSaving ? (isAr ? "جاري الحفظ..." : "Saving...") : (isAr ? "حفظ" : "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Role Add/Edit Dialog ────────────────────────────────────── */}
      <Dialog open={roleDialogOpen} onOpenChange={setRoleDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{roleEditing ? (isAr ? "تعديل الدور" : "Edit Role") : (isAr ? "إضافة دور" : "Add Role")}</DialogTitle>
            <DialogDescription className="sr-only">{t.set.rolesPermissions}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium block mb-1">{isAr ? "الاسم (عربي)" : "Name (Arabic)"}</label>
                <input type="text" value={roleForm.nameAr} onChange={(e) => setRoleForm((f) => ({ ...f, nameAr: e.target.value }))} dir="rtl" className={inputClass} />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">{isAr ? "الاسم (إنجليزي)" : "Name (English)"}</label>
                <input type="text" value={roleForm.nameEn} onChange={(e) => setRoleForm((f) => ({ ...f, nameEn: e.target.value }))} dir="ltr" className={inputClass} />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium block mb-2">{t.set.permissions}</label>
              <div className="grid grid-cols-2 gap-2">
                {ROLE_PERMISSIONS.map((perm) => (
                  <label key={perm} className="flex items-center gap-2 text-sm cursor-pointer p-2 rounded-lg hover:bg-surface-container-low">
                    <input
                      type="checkbox"
                      checked={roleForm.permissions.includes(perm)}
                      onChange={() => togglePermission(perm)}
                      className="w-4 h-4 rounded accent-primary"
                    />
                    <span className="font-mono text-xs">{perm}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoleDialogOpen(false)} disabled={roleSaving}>{t.common.cancel}</Button>
            <Button onClick={submitRole} disabled={roleSaving}>
              {roleSaving && <Icon name="progress_activity" size={16} className="animate-spin" />}
              {roleSaving ? (isAr ? "جاري الحفظ..." : "Saving...") : (isAr ? "حفظ" : "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Compliance Edit Dialog ──────────────────────────────────── */}
      <Dialog open={complianceDialogOpen} onOpenChange={setComplianceDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{isAr ? "تعديل بند الالتزام" : "Edit Compliance Item"}</DialogTitle>
            <DialogDescription className="sr-only">{t.set.compliance}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium block mb-1">{isAr ? "العنوان (عربي)" : "Title (Arabic)"}</label>
                <input type="text" value={complianceForm.titleAr} onChange={(e) => setComplianceForm((f) => ({ ...f, titleAr: e.target.value }))} dir="rtl" className={inputClass} />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">{isAr ? "العنوان (إنجليزي)" : "Title (English)"}</label>
                <input type="text" value={complianceForm.titleEn} onChange={(e) => setComplianceForm((f) => ({ ...f, titleEn: e.target.value }))} dir="ltr" className={inputClass} />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">{isAr ? "الوصف (عربي)" : "Description (Arabic)"}</label>
              <textarea
                value={complianceForm.descAr}
                onChange={(e) => setComplianceForm((f) => ({ ...f, descAr: e.target.value }))}
                rows={2}
                dir="rtl"
                className="w-full rounded-xl bg-surface-container-high px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40 resize-none"
              />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">{isAr ? "الوصف (إنجليزي)" : "Description (English)"}</label>
              <textarea
                value={complianceForm.descEn}
                onChange={(e) => setComplianceForm((f) => ({ ...f, descEn: e.target.value }))}
                rows={2}
                dir="ltr"
                className="w-full rounded-xl bg-surface-container-high px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40 resize-none"
              />
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={complianceForm.compliant}
                onChange={(e) => setComplianceForm((f) => ({ ...f, compliant: e.target.checked }))}
                className="w-4 h-4 rounded accent-primary"
              />
              <span>{isAr ? "متوافق حالياً" : "Currently compliant"}</span>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setComplianceDialogOpen(false)} disabled={complianceSaving}>{t.common.cancel}</Button>
            <Button onClick={submitCompliance} disabled={complianceSaving}>
              {complianceSaving && <Icon name="progress_activity" size={16} className="animate-spin" />}
              {complianceSaving ? (isAr ? "جاري الحفظ..." : "Saving...") : (isAr ? "حفظ" : "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Department Add/Edit Dialog ──────────────────────────────── */}
      <Dialog open={deptDialogOpen} onOpenChange={setDeptDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{deptEditKey ? t.dept.editDept : t.dept.addDept}</DialogTitle>
            <DialogDescription className="sr-only">{t.dept.title}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {!deptEditKey && (
              <div>
                <label className="text-sm font-medium block mb-1">{t.dept.key}</label>
                <input
                  type="text"
                  value={deptKey}
                  onChange={(e) => setDeptKey(e.target.value.toLowerCase().replace(/\s+/g, "-"))}
                  placeholder="e.g. game-dev"
                  dir="ltr"
                  className={inputClass}
                />
              </div>
            )}
            <div>
              <label className="text-sm font-medium block mb-1">{t.dept.nameAr}</label>
              <input type="text" value={deptNameAr} onChange={(e) => setDeptNameAr(e.target.value)} dir="rtl" className={inputClass} />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">{t.dept.nameEn}</label>
              <input type="text" value={deptNameEn} onChange={(e) => setDeptNameEn(e.target.value)} dir="ltr" className={inputClass} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeptDialogOpen(false)}>{t.common.cancel}</Button>
            <Button disabled={!deptKey || !deptNameAr || !deptNameEn} onClick={() => {
              if (deptEditKey) {
                store.updateDepartment(deptEditKey, deptNameAr, deptNameEn);
              } else {
                if (!/^[a-z0-9-]+$/.test(deptKey)) {
                  addNotification({
                    type: "system",
                    titleAr: "معرّف غير صالح",
                    titleEn: "Invalid Key",
                    descAr: "يجب أن يحتوي معرّف القسم على أحرف إنجليزية صغيرة، أرقام، وشرطات فقط",
                    descEn: "Department key must contain only lowercase letters, digits, and hyphens",
                    time: 0,
                    read: false,
                  });
                  return;
                }
                if (store.departments[deptKey]) {
                  addNotification({
                    type: "system",
                    titleAr: "معرّف موجود",
                    titleEn: "Key Exists",
                    descAr: "هذا المعرّف مستخدم بالفعل",
                    descEn: "This key is already in use",
                    time: 0,
                    read: false,
                  });
                  return;
                }
                store.addDepartment(deptKey, deptNameAr, deptNameEn);
              }
              setDeptDialogOpen(false);
            }}>{t.common.save}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
