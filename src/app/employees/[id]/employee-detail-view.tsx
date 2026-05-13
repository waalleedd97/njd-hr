"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLanguage, useAuth } from "@/components/providers";
import { useData } from "@/lib/data-store";
import { useDataHydration } from "@/lib/hooks/use-data-hydration";
import { supabase } from "@/lib/supabase";
import { GOSI_RATE, ASSET_TYPES } from "@/lib/mock-data";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";
import type { EmployeesSlice } from "@/lib/data/server";

const statusBadgeVariant: Record<string, "success" | "warning" | "destructive"> = {
  active: "success",
  "on-leave": "warning",
  inactive: "destructive",
};

export function EmployeeDetailView({
  initialSlice,
  employeeId,
}: {
  initialSlice: EmployeesSlice;
  employeeId: string;
}) {
  useDataHydration(initialSlice);
  const { t, lang } = useLanguage();
  const { isAdmin } = useAuth();
  const store = useData();
  const toast = useToast();
  const router = useRouter();
  const isAr = lang === "ar";

  const employees = store.employees;
  const departments = store.departments;
  const assets = store.assets;
  const employee = useMemo(
    () => employees.find((e) => e.id === employeeId) ?? null,
    [employees, employeeId]
  );

  // Map of email → Supabase auth user_id, needed because a few admin actions
  // (location_required toggle, manager update) target the auth user, not the
  // employee row directly. Same RPC the employees-view list uses.
  const [userIdMap, setUserIdMap] = useState<Record<string, string>>({});
  const [empLocationRequired, setEmpLocationRequired] = useState(true);
  const [managerSaving, setManagerSaving] = useState(false);

  // Rich profile fields that aren't surfaced by the list-page RPC. We fetch
  // them directly from profiles on the detail view, so the list page stays
  // fast (one round-trip) and the detail page is fully populated.
  type ProfileExtras = {
    dateOfBirth: string | null;
    nationality: string | null;
    gender: string | null;
    maritalStatus: string | null;
    passportNumber: string | null;
    emergencyPhone: string | null;
    iban: string | null;
    baseSalary: number | null;
    allowances: number | null;
    universityMajorAr: string | null;
    universityMajorEn: string | null;
    jobTitleEn: string | null;
    startDate: string | null;
  };
  const [profileExtras, setProfileExtras] = useState<ProfileExtras | null>(null);

  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      try {
        const { data: users } = await supabase.rpc("admin_list_users");
        if (!users) return;
        const map: Record<string, string> = {};
        for (const u of users as Array<{ user_id: string; email: string }>) {
          if (u.email) map[u.email.toLowerCase()] = u.user_id;
        }
        setUserIdMap(map);
      } catch {
        /* RPC may not be available */
      }
    })();
  }, [isAdmin]);

  // Load the full profile row in one go: location_required (drift-prone, must
  // be read fresh per CLAUDE.md) plus all the rich identity / banking /
  // education / salary fields that the list-page RPC doesn't surface.
  useEffect(() => {
    if (!employee) return;
    setEmpLocationRequired(true);
    setProfileExtras(null);
    // The auth user_id IS the profile id (PK), so we don't actually need the
    // userIdMap here — but we still wait for it because the location_required
    // mutate path uses it for the UPDATE filter.
    const supabaseId = userIdMap[employee.email.toLowerCase()] || employee.id;
    if (!supabaseId) return;
    supabase
      .from("profiles")
      .select(
        "location_required, date_of_birth, nationality, gender, marital_status, passport_number, emergency_phone, iban, base_salary, allowances, university_major_ar, university_major_en, job_title_en, start_date"
      )
      .eq("id", supabaseId)
      .single()
      .then(({ data }: { data: Record<string, unknown> | null }) => {
        if (!data) return;
        setEmpLocationRequired((data.location_required as boolean) ?? true);
        setProfileExtras({
          dateOfBirth: (data.date_of_birth as string) ?? null,
          nationality: (data.nationality as string) ?? null,
          gender: (data.gender as string) ?? null,
          maritalStatus: (data.marital_status as string) ?? null,
          passportNumber: (data.passport_number as string) ?? null,
          emergencyPhone: (data.emergency_phone as string) ?? null,
          iban: (data.iban as string) ?? null,
          baseSalary: (data.base_salary as number) ?? null,
          allowances: (data.allowances as number) ?? null,
          universityMajorAr: (data.university_major_ar as string) ?? null,
          universityMajorEn: (data.university_major_en as string) ?? null,
          jobTitleEn: (data.job_title_en as string) ?? null,
          startDate: (data.start_date as string) ?? null,
        });
      });
  }, [employee, userIdMap]);

  const handleLocationToggle = async () => {
    if (!employee) return;
    const supabaseId = userIdMap[employee.email.toLowerCase()];
    if (!supabaseId) return;
    const newValue = !empLocationRequired;
    setEmpLocationRequired(newValue);
    await supabase
      .from("profiles")
      .update({ location_required: newValue })
      .eq("id", supabaseId);
  };

  const handleManagerChange = async (newManagerId: string) => {
    if (!employee || managerSaving) return;
    const supabaseId =
      userIdMap[employee.email.toLowerCase()] || employee.id;
    setManagerSaving(true);
    try {
      await store.updateEmployeeManager(supabaseId, newManagerId || null);
      toast.success(isAr ? "تم تحديث المدير المباشر" : "Direct manager updated");
    } catch {
      toast.error(isAr ? "فشل التحديث" : "Failed to update");
    } finally {
      setManagerSaving(false);
    }
  };

  const formatSalary = (amount: number) =>
    amount.toLocaleString(isAr ? "ar-SA-u-nu-latn" : "en-US");
  const statusLabel = (status: string) => {
    if (status === "active") return t.emp.active;
    if (status === "on-leave") return t.emp.onLeave;
    return t.emp.inactive;
  };

  // Bilingual labels for the small enum-ish fields. Falls back to the raw
  // string when the value isn't in the lookup (so admins still see what's
  // stored even if it's a typo or a free-text entry).
  const genderLabel = (g: string | null): string => {
    if (!g) return "—";
    const k = g.toLowerCase();
    if (k === "male" || k === "m") return isAr ? "ذكر" : "Male";
    if (k === "female" || k === "f") return isAr ? "أنثى" : "Female";
    return g;
  };
  const maritalLabel = (m: string | null): string => {
    if (!m) return "—";
    const k = m.toLowerCase();
    if (k === "single") return isAr ? "أعزب/عزباء" : "Single";
    if (k === "married") return isAr ? "متزوج/ة" : "Married";
    if (k === "divorced") return isAr ? "مطلّق/ة" : "Divorced";
    if (k === "widowed") return isAr ? "أرمل/ة" : "Widowed";
    return m;
  };
  const formatDOB = (d: string | null): string => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString(
      isAr ? "ar-SA-u-nu-latn" : "en-US",
      { year: "numeric", month: "long", day: "numeric" }
    );
  };

  if (!employee) {
    // Employee not found in the loaded slice — could be a stale URL after a
    // delete, or a typo in the path. Show a friendly empty state with a link
    // back to the list rather than crashing.
    return (
      <div className="max-w-4xl mx-auto py-16 px-4 text-center">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-surface-container-high flex items-center justify-center mb-4">
          <Icon name="person_off" size={28} className="text-on-surface-variant" />
        </div>
        <h2 className="font-headline font-bold text-xl mb-2">
          {isAr ? "الموظف غير موجود" : "Employee not found"}
        </h2>
        <p className="text-sm text-on-surface-variant mb-6">
          {isAr
            ? "ربما تم حذف هذا الموظف أو الرابط غير صحيح."
            : "This employee may have been removed, or the link is incorrect."}
        </p>
        <Button onClick={() => router.push("/employees")}>
          <Icon name="arrow_back" size={18} />
          {isAr ? "العودة إلى قائمة الموظفين" : "Back to employees"}
        </Button>
      </div>
    );
  }

  const empAssets = assets.filter((a) => a.employeeId === employee.id);
  // Salary: prefer the live values fetched from profiles (base_salary +
  // allowances). Fall back to the legacy 4-bucket structure on the Employee
  // row for backwards compat. Allowances is treated as a single lump sum.
  const baseSalary = profileExtras?.baseSalary ?? employee.salary.basic;
  const allowances = profileExtras?.allowances ?? (
    employee.salary.housing + employee.salary.transport + employee.salary.other
  );
  const grossSalary = baseSalary + allowances;
  const gosi = Math.round(baseSalary * GOSI_RATE);
  const net = grossSalary - gosi;
  const dept = departments[employee.department];
  const manager = employee.managerId
    ? employees.find((e) => e.id === employee.managerId)
    : null;

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-8">
      {/* Breadcrumb / back nav */}
      <div className="flex items-center gap-2 text-sm">
        <Link
          href="/employees"
          className="inline-flex items-center gap-1.5 text-on-surface-variant hover:text-primary transition-colors font-medium"
        >
          <Icon name="arrow_back" size={16} />
          {isAr ? "العودة إلى الموظفين" : "Back to Employees"}
        </Link>
      </div>

      {/* Hero card — avatar + name + status */}
      <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm border border-outline-variant/40">
        <div className="flex items-start gap-5 flex-wrap">
          <Avatar size="lg" className="w-20 h-20 shrink-0">
            <AvatarFallback
              className={cn(
                "text-white text-2xl font-bold",
                employee.color
              )}
            >
              {employee.initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <h1 className="font-headline font-extrabold text-2xl md:text-3xl mb-1">
              {isAr ? employee.nameAr : employee.nameEn}
            </h1>
            <p className="text-sm text-on-surface-variant mb-3">
              {isAr ? employee.positionAr : employee.positionEn}
              {dept && (
                <span className="ms-2">
                  • {isAr ? dept.ar : dept.en}
                </span>
              )}
            </p>
            <Badge variant={statusBadgeVariant[employee.status]}>
              {statusLabel(employee.status)}
            </Badge>
          </div>
        </div>
      </div>

      {/* Two-column layout on wide screens */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Personal info */}
        <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm border border-outline-variant/40">
          <h2 className="font-headline font-bold text-base mb-4 flex items-center gap-2">
            <Icon name="badge" size={18} className="text-primary" />
            {t.emp.personalInfo}
          </h2>
          <dl className="space-y-3">
            <div className="flex justify-between items-center text-sm gap-3">
              <dt className="text-on-surface-variant font-medium shrink-0">
                {t.emp.empId}
              </dt>
              <dd className="font-bold tabular-nums">
                {/* employeeNumber is the new 3-digit human-friendly ID
                    (e.g. "002"). The full UUID is no longer surfaced — admins
                    found it noisy and unactionable. */}
                {employee.employeeNumber ?? (isAr ? "غير مُعيّن" : "Not assigned")}
              </dd>
            </div>
            <div className="flex justify-between items-center text-sm gap-3">
              <dt className="text-on-surface-variant font-medium shrink-0">
                {t.emp.email}
              </dt>
              <dd className="font-bold truncate">{employee.email}</dd>
            </div>
            <div className="flex justify-between items-center text-sm gap-3">
              <dt className="text-on-surface-variant font-medium shrink-0">
                {t.emp.phone}
              </dt>
              <dd className="font-bold tabular-nums" dir="ltr">
                {employee.phone}
              </dd>
            </div>
            {employee.nationalId && (
              <div className="flex justify-between items-center text-sm gap-3">
                <dt className="text-on-surface-variant font-medium shrink-0">
                  {isAr ? "الهوية / الإقامة" : "National ID / Iqama"}
                </dt>
                <dd className="font-bold font-mono tabular-nums" dir="ltr">
                  {employee.nationalId}
                </dd>
              </div>
            )}
            <div className="flex justify-between items-center text-sm gap-3">
              <dt className="text-on-surface-variant font-medium shrink-0">
                {t.common.department}
              </dt>
              <dd className="font-bold">
                {dept ? (isAr ? dept.ar : dept.en) : employee.department}
              </dd>
            </div>
            <div className="flex justify-between items-center text-sm gap-3">
              <dt className="text-on-surface-variant font-medium shrink-0">
                {t.emp.joinDate}
              </dt>
              <dd className="font-bold tabular-nums">
                {employee.joinDate
                  ? new Date(employee.joinDate).toLocaleDateString(
                      isAr ? "ar-SA-u-nu-latn" : "en-US",
                      { year: "numeric", month: "long", day: "numeric" }
                    )
                  : "—"}
              </dd>
            </div>
          </dl>

          {/* Location requirement toggle */}
          <div className="mt-5 pt-5 border-t border-outline-variant/20">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-bold">{t.emp.locationRequired}</p>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  {isAr
                    ? "إذا كان مفعّلاً، الموظف ملزم بالحضور من الموقع الجغرافي للمكتب"
                    : "When on, the employee must clock in from within the office geofence"}
                </p>
              </div>
              <button
                onClick={handleLocationToggle}
                disabled={!userIdMap[employee.email.toLowerCase()]}
                className={cn(
                  "relative w-12 h-7 rounded-full transition-colors shrink-0",
                  !userIdMap[employee.email.toLowerCase()] &&
                    "opacity-50 cursor-not-allowed",
                  empLocationRequired
                    ? "gradient-btn shadow-primary-glow"
                    : "bg-surface-container-highest"
                )}
                aria-label={t.emp.locationRequired}
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

          {/* Direct manager picker */}
          <div className="mt-5 pt-5 border-t border-outline-variant/20 space-y-2">
            <label className="text-sm font-bold flex items-center gap-2">
              <Icon name="account_tree" size={16} className="text-primary" />
              {isAr ? "المدير المباشر" : "Direct Manager"}
            </label>
            <select
              value={employee.managerId ?? ""}
              onChange={(e) => handleManagerChange(e.target.value)}
              disabled={managerSaving}
              className="h-10 w-full rounded-xl bg-surface-container-high px-3 text-sm outline-none focus:ring-2 focus:ring-inset focus:ring-primary/40 disabled:opacity-60"
            >
              <option value="">
                {isAr ? "بدون مدير مباشر" : "No direct manager"}
              </option>
              {employees
                .filter((e) => e.id !== employee.id)
                .map((e) => (
                  <option key={e.id} value={e.id}>
                    {isAr ? e.nameAr : e.nameEn}
                    {e.positionAr || e.positionEn
                      ? ` — ${isAr ? e.positionAr : e.positionEn}`
                      : ""}
                  </option>
                ))}
            </select>
            {manager && (
              <div className="flex items-center gap-2 text-xs text-on-surface-variant">
                <Avatar className="w-6 h-6">
                  <AvatarFallback
                    className={cn("text-white text-[9px] font-bold", manager.color)}
                  >
                    {manager.initials}
                  </AvatarFallback>
                </Avatar>
                <span>
                  {isAr ? "حالياً يتبع" : "Currently reports to"}:{" "}
                  <strong>{isAr ? manager.nameAr : manager.nameEn}</strong>
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Salary info — uses live values from profiles (base_salary +
            allowances). No more hardcoded zeros. */}
        <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm border border-outline-variant/40">
          <h2 className="font-headline font-bold text-base mb-4 flex items-center gap-2">
            <Icon name="payments" size={18} className="text-primary" />
            {t.emp.salaryInfo}
          </h2>
          <dl className="space-y-3">
            <div className="flex justify-between items-center text-sm">
              <dt className="text-on-surface-variant font-medium">
                {isAr ? "الراتب الأساسي" : "Base Salary"}
              </dt>
              <dd className="font-bold tabular-nums">
                {formatSalary(baseSalary)} {t.common.sar}
              </dd>
            </div>
            <div className="flex justify-between items-center text-sm">
              <dt className="text-on-surface-variant font-medium">
                {isAr ? "البدلات" : "Allowances"}
              </dt>
              <dd className="font-bold tabular-nums">
                {formatSalary(allowances)} {t.common.sar}
              </dd>
            </div>
            <div className="flex justify-between items-center text-sm pt-3 border-t border-outline-variant/20">
              <dt className="text-on-surface-variant font-medium">
                {isAr ? "إجمالي الراتب" : "Gross Salary"}
              </dt>
              <dd className="font-bold tabular-nums">
                {formatSalary(grossSalary)} {t.common.sar}
              </dd>
            </div>
            <div className="flex justify-between items-center text-sm text-md-error">
              <dt className="font-medium">{t.pay.gosiDeduction}</dt>
              <dd className="font-bold tabular-nums">
                -{formatSalary(gosi)} {t.common.sar}
              </dd>
            </div>
            <div className="flex justify-between items-center pt-3 mt-2 bg-primary-container/20 -mx-6 px-6 py-4 font-headline font-black text-primary">
              <dt>{t.emp.netSalary}</dt>
              <dd className="tabular-nums text-lg">
                {formatSalary(net)} {t.common.sar}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Identity & Personal — only shown when at least one field is filled */}
      {profileExtras && (
        profileExtras.dateOfBirth ||
        profileExtras.nationality ||
        profileExtras.gender ||
        profileExtras.maritalStatus ||
        profileExtras.passportNumber ||
        profileExtras.emergencyPhone
      ) && (
        <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm border border-outline-variant/40">
          <h2 className="font-headline font-bold text-base mb-4 flex items-center gap-2">
            <Icon name="contact_emergency" size={18} className="text-primary" />
            {isAr ? "البيانات الشخصية والهوية" : "Identity & Personal"}
          </h2>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
            {profileExtras.dateOfBirth && (
              <div className="flex justify-between items-center text-sm gap-3">
                <dt className="text-on-surface-variant font-medium shrink-0">
                  {isAr ? "تاريخ الميلاد" : "Date of Birth"}
                </dt>
                <dd className="font-bold tabular-nums">
                  {formatDOB(profileExtras.dateOfBirth)}
                </dd>
              </div>
            )}
            {profileExtras.nationality && (
              <div className="flex justify-between items-center text-sm gap-3">
                <dt className="text-on-surface-variant font-medium shrink-0">
                  {isAr ? "الجنسية" : "Nationality"}
                </dt>
                <dd className="font-bold">{profileExtras.nationality}</dd>
              </div>
            )}
            {profileExtras.gender && (
              <div className="flex justify-between items-center text-sm gap-3">
                <dt className="text-on-surface-variant font-medium shrink-0">
                  {isAr ? "الجنس" : "Gender"}
                </dt>
                <dd className="font-bold">{genderLabel(profileExtras.gender)}</dd>
              </div>
            )}
            {profileExtras.maritalStatus && (
              <div className="flex justify-between items-center text-sm gap-3">
                <dt className="text-on-surface-variant font-medium shrink-0">
                  {isAr ? "الحالة الاجتماعية" : "Marital Status"}
                </dt>
                <dd className="font-bold">
                  {maritalLabel(profileExtras.maritalStatus)}
                </dd>
              </div>
            )}
            {profileExtras.passportNumber && (
              <div className="flex justify-between items-center text-sm gap-3">
                <dt className="text-on-surface-variant font-medium shrink-0">
                  {isAr ? "رقم الجواز" : "Passport Number"}
                </dt>
                <dd className="font-bold tabular-nums" dir="ltr">
                  {profileExtras.passportNumber}
                </dd>
              </div>
            )}
            {profileExtras.emergencyPhone && (
              <div className="flex justify-between items-center text-sm gap-3">
                <dt className="text-on-surface-variant font-medium shrink-0">
                  {isAr ? "هاتف الطوارئ" : "Emergency Phone"}
                </dt>
                <dd className="font-bold tabular-nums" dir="ltr">
                  {profileExtras.emergencyPhone}
                </dd>
              </div>
            )}
          </dl>
        </div>
      )}

      {/* Banking + Education — both compact, share a 2-col row */}
      {profileExtras && (profileExtras.iban || profileExtras.universityMajorAr || profileExtras.universityMajorEn) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {profileExtras.iban && (
            <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm border border-outline-variant/40">
              <h2 className="font-headline font-bold text-base mb-4 flex items-center gap-2">
                <Icon name="account_balance" size={18} className="text-primary" />
                {isAr ? "البيانات البنكية" : "Banking"}
              </h2>
              <div className="text-sm">
                <p className="text-on-surface-variant font-medium mb-1">IBAN</p>
                <p className="font-bold font-mono tabular-nums break-all" dir="ltr">
                  {profileExtras.iban}
                </p>
              </div>
            </div>
          )}
          {(profileExtras.universityMajorAr || profileExtras.universityMajorEn) && (
            <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm border border-outline-variant/40">
              <h2 className="font-headline font-bold text-base mb-4 flex items-center gap-2">
                <Icon name="school" size={18} className="text-primary" />
                {isAr ? "التعليم" : "Education"}
              </h2>
              <div className="text-sm">
                <p className="text-on-surface-variant font-medium mb-1">
                  {isAr ? "التخصص الجامعي" : "University Major"}
                </p>
                <p className="font-bold">
                  {(isAr
                    ? profileExtras.universityMajorAr || profileExtras.universityMajorEn
                    : profileExtras.universityMajorEn || profileExtras.universityMajorAr) || "—"}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Issued assets */}
      {empAssets.length > 0 && (
        <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm border border-outline-variant/40">
          <h2 className="font-headline font-bold text-base mb-4 flex items-center gap-2">
            <Icon name="inventory_2" size={18} className="text-primary" />
            {isAr ? "العهد المُسلَّمة" : "Issued Assets"}
            <Badge variant="default">{empAssets.length}</Badge>
          </h2>
          <ul className="space-y-2">
            {empAssets.map((a) => {
              const meta = ASSET_TYPES[a.assetType] ?? ASSET_TYPES.other;
              return (
                <li
                  key={a.id}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl bg-surface-container/40 border border-outline-variant/20"
                >
                  <div
                    className={cn(
                      "w-9 h-9 rounded-lg flex items-center justify-center bg-surface-container",
                      meta.tone
                    )}
                  >
                    <Icon name={meta.iconName} size={16} fill />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-sm truncate">
                      {isAr ? a.nameAr : a.nameEn}
                    </p>
                    {a.serialNumber && (
                      <p className="text-xs text-on-surface-variant tabular-nums" dir="ltr">
                        SN: {a.serialNumber}
                      </p>
                    )}
                  </div>
                  <Badge
                    variant={
                      a.status === "issued"
                        ? "success"
                        : a.status === "returned"
                          ? "secondary"
                          : "destructive"
                    }
                  >
                    {a.status === "issued"
                      ? isAr
                        ? "مُسلَّم"
                        : "Issued"
                      : a.status === "returned"
                        ? isAr
                          ? "مُسترَد"
                          : "Returned"
                        : a.status === "lost"
                          ? isAr
                            ? "مفقود"
                            : "Lost"
                          : isAr
                            ? "تالف"
                            : "Damaged"}
                  </Badge>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
