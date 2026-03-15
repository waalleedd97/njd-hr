"use client";

import { useState, useEffect } from "react";
import { useLanguage } from "@/components/providers";
import { useData } from "@/lib/data-store";
import {
  branches,
  roles,
  complianceItems,
  saudiHolidays,
  penaltyRules,
  geofenceConfig,
} from "@/lib/mock-data";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn, formatDate } from "@/lib/utils";
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
  X,
  Check,
} from "lucide-react";

const tabs = [
  "companyInfo",
  "branches",
  "rolesPermissions",
  "compliance",
  "holidays",
  "geofence",
  "penalties",
] as const;
type Tab = (typeof tabs)[number];

const tabIcons: Record<Tab, React.ReactNode> = {
  companyInfo: <Building2 className="w-4 h-4" />,
  branches: <MapPin className="w-4 h-4" />,
  rolesPermissions: <Users className="w-4 h-4" />,
  compliance: <Shield className="w-4 h-4" />,
  holidays: <Calendar className="w-4 h-4" />,
  geofence: <Radar className="w-4 h-4" />,
  penalties: <AlertTriangle className="w-4 h-4" />,
};

export default function SettingsPage() {
  const { t, lang } = useLanguage();
  const isAr = lang === "ar";
  const { settings, updateSettings, addNotification } = useData();

  const [activeTab, setActiveTab] = useState<Tab>("companyInfo");
  const [geofenceEnabled, setGeofenceEnabled] = useState(settings.geofenceEnabled);
  const [geofenceRadius, setGeofenceRadius] = useState(settings.geofenceRadius);
  const [companySaved, setCompanySaved] = useState(false);
  const [geofenceSaved, setGeofenceSaved] = useState(false);

  // Holiday dialog state
  const [showHolidayDialog, setShowHolidayDialog] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [customHolidays, setCustomHolidays] = useState<
    { id: string; nameAr: string; nameEn: string; startDate: string; endDate: string; days: number }[]
  >([]);
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
    isAr
      ? "طريق الملك فهد"
      : "King Fahd Road"
  );
  const [city, setCity] = useState(
    isAr ? "الرياض" : "Riyadh"
  );
  const [country, setCountry] = useState(
    isAr
      ? "المملكة العربية السعودية"
      : "Saudi Arabia"
  );
  const [industry, setIndustry] = useState(
    isAr
      ? "تطوير الألعاب"
      : "Game Development"
  );

  const tabLabels: Record<Tab, string> = {
    companyInfo: t.set.companyInfo,
    branches: t.set.branches,
    rolesPermissions: t.set.rolesPermissions,
    compliance: t.set.compliance,
    holidays: t.holiday.title,
    geofence: t.clock.geofence,
    penalties: t.penalty.title,
  };

  const inputClass =
    "h-10 w-full rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-primary";

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
        <h1 className="text-2xl font-bold text-foreground">{t.set.title}</h1>
      </div>

      {/* Tab Navigation */}
      <div className="glass-card rounded-xl p-2">
        <div className="flex gap-2 overflow-x-auto pb-2">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "rounded-lg px-4 py-2 text-sm font-medium transition-colors flex items-center gap-2 shrink-0",
                activeTab === tab
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              {tabIcons[tab]}
              {tabLabels[tab]}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === "companyInfo" && (
        <div className="glass-card rounded-xl p-5 lg:p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">
              {t.set.companyInfo}
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Company Name */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">
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
              <label className="text-sm font-medium text-foreground">
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
              <label className="text-sm font-medium text-foreground">
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
              <label className="text-sm font-medium text-foreground">
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
              <label className="text-sm font-medium text-foreground">
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
              <label className="text-sm font-medium text-foreground">
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
          <div className="flex justify-end mt-6 pt-4 border-t border-border">
            <Button
              className="gap-2"
              onClick={() => {
                updateSettings({
                  companyNameAr: isAr ? companyName : settings.companyNameAr,
                  companyNameEn: isAr ? settings.companyNameEn : companyName,
                  crNumber,
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
        <div className="glass-card rounded-xl p-5 lg:p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                <MapPin className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h2 className="text-lg font-semibold text-foreground">
                {t.set.branches}
              </h2>
            </div>
          </div>

          <div className="overflow-x-auto -mx-5 lg:-mx-6 px-5 lg:px-6">
            <table className="w-full min-w-[500px]">
              <thead>
                <tr className="text-xs text-muted-foreground border-b border-border">
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
                    className="border-b border-border/50 last:border-0 hover:bg-accent/30 transition-colors"
                  >
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm font-medium">
                          {isAr ? branch.nameAr : branch.nameEn}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 text-sm text-muted-foreground">
                      {isAr ? branch.cityAr : branch.cityEn}
                    </td>
                    <td className="py-3 text-sm text-muted-foreground">
                      {branch.employeeCount}
                    </td>
                    <td className="py-3">
                      {branch.isMain ? (
                        <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-400 border-0 text-[11px]">
                          {t.set.mainBranch}
                        </Badge>
                      ) : (
                        <Badge className="bg-muted text-muted-foreground border-0 text-[11px]">
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
        <div className="glass-card rounded-xl p-5 lg:p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">
              {t.set.rolesPermissions}
            </h2>
          </div>

          <div className="overflow-x-auto -mx-5 lg:-mx-6 px-5 lg:px-6">
            <table className="w-full min-w-[600px]">
              <thead>
                <tr className="text-xs text-muted-foreground border-b border-border">
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
                    className="border-b border-border/50 last:border-0 hover:bg-accent/30 transition-colors"
                  >
                    <td className="py-3">
                      <span className="text-sm font-medium">
                        {isAr ? role.nameAr : role.nameEn}
                      </span>
                    </td>
                    <td className="py-3 text-sm text-muted-foreground">
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
          <div className="accent-card rounded-xl p-5 lg:p-6 hover-lift">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <Shield className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  {t.set.complianceScore}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {t.set.saudiLaborLaw}
                </p>
              </div>
            </div>

            <div className="flex items-end gap-4 mb-3">
              <span className={cn("text-4xl font-bold", barTextColor)}>
                {compliancePercentage}%
              </span>
              <span className="text-sm text-muted-foreground pb-1">
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
                  "glass-card rounded-xl p-4 hover-lift transition-all",
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
                      <h3 className="text-sm font-semibold text-foreground">
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
                    <p className="text-xs text-muted-foreground leading-relaxed">
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
        <div className="glass-card rounded-xl p-5 lg:p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <h2 className="text-lg font-semibold text-foreground">
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
          {showHolidayDialog && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
              <div className="glass-card rounded-xl p-6 w-full max-w-md mx-4 space-y-4 bg-card shadow-xl">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-foreground">
                    {t.holiday.addCustom}
                  </h3>
                  <button
                    onClick={() => {
                      setShowHolidayDialog(false);
                      setNewHolidayName("");
                      setNewHolidayStart("");
                      setNewHolidayEnd("");
                    }}
                    className="p-1 rounded-lg hover:bg-muted transition-colors"
                  >
                    <X className="w-4 h-4 text-muted-foreground" />
                  </button>
                </div>

                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">
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
                      <label className="text-sm font-medium text-foreground">
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
                      <label className="text-sm font-medium text-foreground">
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

                <div className="flex justify-end gap-2 pt-2">
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
                    className="gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    {isAr ? "إضافة" : "Add"}
                  </Button>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {saudiHolidays.map((h, idx) => {
              const isUpcoming = new Date(h.startDate) > now;
              const color = holidayColors[idx % holidayColors.length];

              return (
                <div
                  key={h.id}
                  className={cn(
                    "glass-card rounded-xl p-4 hover-lift transition-all",
                    isUpcoming
                      ? "border-blue-200 dark:border-blue-500/20"
                      : "border-border opacity-75"
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
                          isUpcoming ? color.text : "text-muted-foreground"
                        )}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <h3 className="text-sm font-semibold text-foreground">
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
                              isUpcoming ? color.badge : "bg-muted text-muted-foreground"
                            )}
                          >
                            {h.days === 1
                              ? `1 ${t.holiday.day}`
                              : `${h.days} ${t.holiday.daysCount}`}
                          </Badge>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(h.startDate, lang, { month: "long", day: "numeric" })}
                        {h.startDate !== h.endDate && (
                          <>
                            {" — "}
                            {formatDate(h.endDate, lang, { month: "long", day: "numeric" })}
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Custom Holidays */}
            {customHolidays.map((h, idx) => {
              const isUpcoming = new Date(h.startDate) > now;
              const color = holidayColors[(saudiHolidays.length + idx) % holidayColors.length];

              return (
                <div
                  key={h.id}
                  className={cn(
                    "glass-card rounded-xl p-4 hover-lift transition-all",
                    isUpcoming
                      ? "border-blue-200 dark:border-blue-500/20"
                      : "border-border opacity-75"
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
                          isUpcoming ? color.text : "text-muted-foreground"
                        )}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <h3 className="text-sm font-semibold text-foreground">
                          {isAr ? h.nameAr : h.nameEn}
                        </h3>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-500/15 dark:text-purple-400 border-0 text-[10px]">
                            {isAr ? "مخصصة" : "Custom"}
                          </Badge>
                          <Badge
                            className={cn(
                              "border-0 text-[10px]",
                              isUpcoming ? color.badge : "bg-muted text-muted-foreground"
                            )}
                          >
                            {h.days === 1
                              ? `1 ${t.holiday.day}`
                              : `${h.days} ${t.holiday.daysCount}`}
                          </Badge>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(h.startDate, lang, { month: "long", day: "numeric" })}
                        {h.startDate !== h.endDate && (
                          <>
                            {" — "}
                            {formatDate(h.endDate, lang, { month: "long", day: "numeric" })}
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Total Holiday Days */}
          <div className="mt-6 pt-4 border-t border-border flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {t.holiday.duration}
            </span>
            <span className="text-sm font-semibold text-foreground">
              {totalHolidayDays + customHolidays.reduce((sum, h) => sum + h.days, 0)} {t.holiday.daysCount}
            </span>
          </div>
        </div>
      )}

      {/* ─── Geofence Tab ─────────────────────────────────────────────── */}
      {activeTab === "geofence" && (
        <div className="glass-card rounded-xl p-5 lg:p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center">
              <Radar className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                {t.clock.geofence}
              </h2>
              <p className="text-sm text-muted-foreground">
                {t.clock.officeLocation}
              </p>
            </div>
          </div>

          {/* Toggle */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-muted/50 mb-6">
            <div className="flex items-center gap-3">
              <Locate className="w-5 h-5 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">
                {t.clock.geofence}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Badge
                className={cn(
                  "border-0 text-[11px]",
                  geofenceEnabled
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-400"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {geofenceEnabled
                  ? (isAr ? "مفعّل" : "Active")
                  : (isAr ? "معطّل" : "Disabled")}
              </Badge>
              <button
                onClick={() => setGeofenceEnabled(!geofenceEnabled)}
                className={cn(
                  "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                  geofenceEnabled ? "bg-emerald-500" : "bg-muted-foreground/30"
                )}
              >
                <span
                  className={cn(
                    "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                    geofenceEnabled ? "translate-x-6" : "translate-x-1"
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
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {t.clock.officeLocation}
                </label>
                <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                  <MapPin className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="text-sm font-medium text-foreground">
                    {isAr ? geofenceConfig.officeNameAr : geofenceConfig.officeNameEn}
                  </span>
                </div>
              </div>

              {/* Coordinates */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Lat
                  </label>
                  <div className="p-3 rounded-lg bg-muted/50">
                    <span className="text-sm font-mono text-foreground">
                      {geofenceConfig.officeLat.toFixed(4)}
                    </span>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Lng
                  </label>
                  <div className="p-3 rounded-lg bg-muted/50">
                    <span className="text-sm font-mono text-foreground">
                      {geofenceConfig.officeLng.toFixed(4)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Radius */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {t.clock.radius}
                </label>
                <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                  <Radar className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="text-sm font-medium text-foreground">
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
                            : "text-muted-foreground"
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
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {geofenceRadius}m
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end mt-6 pt-4 border-t border-border">
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
        <div className="glass-card rounded-xl p-5 lg:p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                {t.penalty.rules}
              </h2>
              <p className="text-sm text-muted-foreground">
                {t.set.saudiLaborLaw}
              </p>
            </div>
          </div>

          <div className="overflow-x-auto -mx-5 lg:-mx-6 px-5 lg:px-6">
            <table className="w-full min-w-[500px]">
              <thead>
                <tr className="text-xs text-muted-foreground border-b border-border">
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
                    className="border-b border-border/50 last:border-0 hover:bg-accent/30 transition-colors"
                  >
                    <td className="py-3">
                      <span className="text-sm font-medium text-foreground">
                        {isAr ? rule.conditionAr : rule.conditionEn}
                      </span>
                    </td>
                    <td className="py-3 text-sm text-muted-foreground">
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

          {/* Auto-calculated info box */}
          <div className="mt-6 p-4 rounded-xl bg-muted/50 flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
            <p className="text-sm text-muted-foreground">
              {t.penalty.autoCalculated}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
