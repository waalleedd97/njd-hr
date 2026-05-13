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

  // Load the employee's location_required flag fresh from profiles. The cached
  // store value can drift since the admin panel on the Landing app can change
  // it independently — CLAUDE.md flags this as a never-trust-cache field.
  useEffect(() => {
    if (!employee) return;
    setEmpLocationRequired(true);
    const supabaseId = userIdMap[employee.email.toLowerCase()];
    if (!supabaseId) return;
    supabase
      .from("profiles")
      .select("location_required")
      .eq("id", supabaseId)
      .single()
      .then(({ data }: { data: { location_required?: boolean } | null }) => {
        if (data) setEmpLocationRequired(data.location_required ?? true);
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
  const sal = employee.salary;
  const gosi = Math.round(sal.basic * GOSI_RATE);
  const net = sal.basic + sal.housing + sal.transport + sal.other - gosi;
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
              <dd
                className="font-bold tabular-nums text-xs truncate"
                title={employee.id}
              >
                {employee.id}
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

        {/* Salary info */}
        <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm border border-outline-variant/40">
          <h2 className="font-headline font-bold text-base mb-4 flex items-center gap-2">
            <Icon name="payments" size={18} className="text-primary" />
            {t.emp.salaryInfo}
          </h2>
          <dl className="space-y-3">
            <div className="flex justify-between items-center text-sm">
              <dt className="text-on-surface-variant font-medium">
                {t.emp.basic}
              </dt>
              <dd className="font-bold tabular-nums">
                {formatSalary(sal.basic)} {t.common.sar}
              </dd>
            </div>
            <div className="flex justify-between items-center text-sm">
              <dt className="text-on-surface-variant font-medium">
                {t.emp.housing}
              </dt>
              <dd className="font-bold tabular-nums">
                {formatSalary(sal.housing)} {t.common.sar}
              </dd>
            </div>
            <div className="flex justify-between items-center text-sm">
              <dt className="text-on-surface-variant font-medium">
                {t.emp.transport}
              </dt>
              <dd className="font-bold tabular-nums">
                {formatSalary(sal.transport)} {t.common.sar}
              </dd>
            </div>
            <div className="flex justify-between items-center text-sm">
              <dt className="text-on-surface-variant font-medium">
                {t.emp.other}
              </dt>
              <dd className="font-bold tabular-nums">
                {formatSalary(sal.other)} {t.common.sar}
              </dd>
            </div>
            <div className="flex justify-between items-center text-sm text-md-error pt-3 border-t border-outline-variant/20">
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
