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
  branches,
  roles,
  complianceItems,
  saudiHolidays,
  penaltyRules,
  earlyDepartureRules,
  geofenceConfig,
} from "@/lib/mock-data";
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

export default function SettingsPage() {
  const { t, lang } = useLanguage();
  const isAr = lang === "ar";
  const { user } = useAuth();
  const store = useData();
  const { settings, updateSettings, addNotification } = store;

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

  const [activeTab, setActiveTab] = useState<Tab>("departments");
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

  // Load custom holidays from Supabase on mount (organization-wide source of truth)
  useEffect(() => {
    (async () => {
      const { supabase: sb } = await import("@/lib/supabase");
      const { data, error } = await sb
        .from("app_settings")
        .select("value")
        .eq("key", "custom_holidays")
        .maybeSingle();
      if (error) {
        console.error("[settings] load custom_holidays failed:", error.message);
        return;
      }
      if (data?.value && Array.isArray(data.value)) {
        setCustomHolidays(data.value as CustomHoliday[]);
      }
    })();
  }, []);

  // Persist custom holidays — localStorage for offline fallback, Supabase for org-wide sync
  useEffect(() => {
    try { localStorage.setItem("njd-hr-custom-holidays", JSON.stringify(customHolidays)); }
    catch { /* quota exceeded or disabled */ }
  }, [customHolidays]);

  const persistHolidays = useCallback(async (next: CustomHoliday[]) => {
    const { supabase: sb } = await import("@/lib/supabase");
    const { error } = await sb
      .from("app_settings")
      .upsert({ key: "custom_holidays", value: next }, { onConflict: "key" });
    if (error) {
      console.error("[settings] save custom_holidays failed:", error.message);
    }
  }, []);
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

  // Compliance calculations
  const compliantCount = complianceItems.filter((item) => item.compliant).length;
  const totalComplianceItems = complianceItems.length;
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
                    <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-600" onClick={() => {
                      if (empCount > 0) {
                        addNotification({ type: "system", titleAr: "خطأ", titleEn: "Error", descAr: t.dept.hasEmployees, descEn: t.dept.hasEmployees, time: 0, read: false });
                        return;
                      }
                      if (confirm(t.dept.confirmDelete)) {
                        store.removeDepartment(key);
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
              onClick={() => {
                updateSettings({
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
                addNotification({
                  type: "system",
                  titleAr: "تم الحفظ",
                  titleEn: "Saved",
                  descAr: "تم حفظ معلومات الشركة بنجاح",
                  descEn: "Company info saved successfully",
                  time: 0,
                  read: false,
                });
                setCompanySaved(true);
                setTimeout(() => setCompanySaved(false), 2000);
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
              <h2 className="text-lg font-semibold text-on-surface">
                {t.set.branches}
              </h2>
            </div>
          </div>

          <div className="overflow-x-auto -mx-5 lg:-mx-6 px-5 lg:px-6">
            <table className="w-full min-w-[500px]">
              <thead>
                <tr className="text-xs text-on-surface-variant border-b border-outline-variant/20">
                  <th className="text-start pb-3 font-medium">
                    {t.set.branchName}
                  </th>
                  <th className="text-start pb-3 font-medium">
                    {t.set.location}
                  </th>
                  <th className="text-start pb-3 font-medium">
                    {t.set.employeeCount}
                  </th>
                  <th className="text-start pb-3 font-medium">
                    {t.common.status}
                  </th>
                </tr>
              </thead>
              <tbody>
                {branches.map((branch) => (
                  <tr
                    key={branch.id}
                    className="border-b border-outline-variant/20/50 last:border-0 hover:bg-surface-container-low/30 transition-colors"
                  >
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-on-surface-variant" />
                        <span className="text-sm font-medium">
                          {isAr ? branch.nameAr : branch.nameEn}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 text-sm text-on-surface-variant">
                      {isAr ? branch.cityAr : branch.cityEn}
                    </td>
                    <td className="py-3 text-sm text-on-surface-variant">
                      {branch.employeeCount}
                    </td>
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "rolesPermissions" && (
        <div className="bg-surface-container-lowest rounded-2xl shadow-sm p-5 lg:p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <h2 className="text-lg font-semibold text-on-surface">
              {t.set.rolesPermissions}
            </h2>
          </div>

          <div className="overflow-x-auto -mx-5 lg:-mx-6 px-5 lg:px-6">
            <table className="w-full min-w-[600px]">
              <thead>
                <tr className="text-xs text-on-surface-variant border-b border-outline-variant/20">
                  <th className="text-start pb-3 font-medium">
                    {t.set.roleName}
                  </th>
                  <th className="text-start pb-3 font-medium">
                    {t.set.users}
                  </th>
                  <th className="text-start pb-3 font-medium">
                    {t.set.permissions}
                  </th>
                </tr>
              </thead>
              <tbody>
                {roles.map((role) => (
                  <tr
                    key={role.id}
                    className="border-b border-outline-variant/20/50 last:border-0 hover:bg-surface-container-low/30 transition-colors"
                  >
                    <td className="py-3">
                      <span className="text-sm font-medium">
                        {isAr ? role.nameAr : role.nameEn}
                      </span>
                    </td>
                    <td className="py-3 text-sm text-on-surface-variant">
                      {role.users}
                    </td>
                    <td className="py-3">
                      <div className="flex flex-wrap gap-1.5">
                        {role.permissions.map((perm) => (
                          <Badge
                            key={perm}
                            variant="secondary"
                            className="text-[10px] font-medium"
                          >
                            {perm}
                          </Badge>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
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
                <h2 className="text-lg font-semibold text-on-surface">
                  {t.set.complianceScore}
                </h2>
                <p className="text-sm text-on-surface-variant">
                  {t.set.saudiLaborLaw}
                </p>
              </div>
            </div>

            <div className="flex items-end gap-4 mb-3">
              <span className={cn("text-4xl font-bold", barTextColor)}>
                {compliancePercentage}%
              </span>
              <span className="text-sm text-on-surface-variant pb-1">
                {compliantCount}/{totalComplianceItems} {t.set.compliant}
              </span>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-3 rounded-full bg-muted overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all", barColor)}
                style={{ width: `${compliancePercentage}%` }}
              />
            </div>
          </div>

          {/* Compliance Checklist */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {complianceItems.map((item) => (
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
                  {item.compliant ? (
                    <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <h3 className="text-sm font-semibold text-on-surface">
                        {isAr ? item.titleAr : item.titleEn}
                      </h3>
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
                    </div>
                    <p className="text-xs text-on-surface-variant leading-relaxed">
                      {isAr ? item.descAr : item.descEn}
                    </p>
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
                    const newHoliday: CustomHoliday = {
                      id: `custom-${Date.now()}`,
                      nameAr: newHolidayName,
                      nameEn: newHolidayName,
                      startDate: newHolidayStart,
                      endDate: newHolidayEnd,
                      days,
                    };
                    setCustomHolidays((prev) => {
                      const next = [...prev, newHoliday];
                      persistHolidays(next);
                      return next;
                    });
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
                          <button
                            onClick={() => {
                              setCustomHolidays((prev) => {
                                const next = prev.filter((x) => x.id !== h.id);
                                persistHolidays(next);
                                return next;
                              });
                            }}
                            className="text-on-surface-variant hover:text-md-error transition-colors"
                            aria-label={isAr ? "حذف" : "Delete"}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
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
              onClick={() => {
                updateSettings({
                  geofenceEnabled,
                  geofenceRadius,
                });
                addNotification({
                  type: "system",
                  titleAr: "تم الحفظ",
                  titleEn: "Saved",
                  descAr: "تم حفظ إعدادات النطاق الجغرافي بنجاح",
                  descEn: "Geofence settings saved successfully",
                  time: 0,
                  read: false,
                });
                setGeofenceSaved(true);
                setTimeout(() => setGeofenceSaved(false), 2000);
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
