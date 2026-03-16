"use client";

import { useState } from "react";
import { useLanguage, useAuth } from "@/components/providers";
import { useData } from "@/lib/data-store";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  User,
  Mail,
  Phone,
  Building2,
  Briefcase,
  CalendarDays,
  Hash,
  Wallet,
  Pencil,
  Send,
  X,
  Info,
  CreditCard,
  Landmark,
  Globe,
  Heart,
  Cake,
  FileText,
  CheckCircle,
  FileWarning,
} from "lucide-react";

export default function ProfilePage() {
  const { t, lang } = useLanguage();
  const { user, isAdmin } = useAuth();
  const store = useData();
  const departments = store.departments;
  const isAr = lang === "ar";

  const emp = store.employees.find((e) => e.id === user.id);

  const [editing, setEditing] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [phone, setPhone] = useState(emp?.phone ?? "");
  const [email, setEmail] = useState(emp?.email ?? "");
  const [nameAr, setNameAr] = useState(emp?.nameAr ?? "");
  const [nameEn, setNameEn] = useState(emp?.nameEn ?? "");
  const [positionAr, setPositionAr] = useState(emp?.positionAr ?? "");
  const [positionEn, setPositionEn] = useState(emp?.positionEn ?? "");

  if (!emp) return null;

  const dept = departments[emp.department];
  const totalSalary = emp.salary.basic + emp.salary.housing + emp.salary.transport + emp.salary.other;

  // Check if any pending profile update request exists
  const hasPendingRequest = store.employeeRequests.some(
    (r) => r.employeeId === emp.id && r.typeKey === "profileUpdate" && r.status === "pending"
  );

  const inputClass =
    "h-9 w-full rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors";

  const handleCancel = () => {
    setPhone(emp.phone);
    setEmail(emp.email);
    setNameAr(emp.nameAr);
    setNameEn(emp.nameEn);
    setPositionAr(emp.positionAr);
    setPositionEn(emp.positionEn);
    setEditing(false);
  };

  const handleSubmit = () => {
    // Build a summary of what changed
    const changes: string[] = [];
    if (nameAr !== emp.nameAr) changes.push(`${t.common.name}(AR): ${nameAr}`);
    if (nameEn !== emp.nameEn) changes.push(`${t.common.name}(EN): ${nameEn}`);
    if (email !== emp.email) changes.push(`${t.emp.email}: ${email}`);
    if (phone !== emp.phone) changes.push(`${t.emp.phone}: ${phone}`);
    if (positionAr !== emp.positionAr) changes.push(`${t.emp.position}(AR): ${positionAr}`);
    if (positionEn !== emp.positionEn) changes.push(`${t.emp.position}(EN): ${positionEn}`);

    if (changes.length === 0) {
      setEditing(false);
      return;
    }

    store.submitEmployeeRequest({
      employeeId: emp.id,
      typeKey: "profileUpdate",
      date: new Date().toISOString().split("T")[0],
      status: "pending",
      detailsAr: changes.join(" | "),
      detailsEn: changes.join(" | "),
    });

    store.addNotification({
      type: "request",
      titleAr: "طلب تعديل بيانات",
      titleEn: "Profile Update Request",
      descAr: `طلب تعديل بيانات من ${emp.nameAr}`,
      descEn: `Profile update request from ${emp.nameEn}`,
      time: 0,
      read: false,
      href: "/requests",
    });

    setEditing(false);
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 3000);
  };

  const infoFields = [
    { icon: Hash, label: t.emp.empId, value: emp.id, editable: false },
    { icon: Mail, label: t.emp.email, value: editing ? email : emp.email, editable: true, setter: setEmail, dir: "ltr" as const },
    { icon: Phone, label: t.emp.phone, value: editing ? phone : emp.phone, editable: true, setter: setPhone, dir: "ltr" as const },
    { icon: Building2, label: t.common.department, value: isAr ? dept?.ar : dept?.en, editable: false },
    { icon: Briefcase, label: t.emp.position, value: isAr ? (editing ? positionAr : emp.positionAr) : (editing ? positionEn : emp.positionEn), editable: true, setter: isAr ? setPositionAr : setPositionEn },
    { icon: CalendarDays, label: t.emp.joinDate, value: emp.joinDate, editable: false },
  ];

  const salaryItems = [
    { label: t.emp.basic, value: emp.salary.basic },
    { label: t.emp.housing, value: emp.salary.housing },
    { label: t.emp.transport, value: emp.salary.transport },
    { label: t.emp.other, value: emp.salary.other },
  ];

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Pending banner */}
      {(hasPendingRequest || submitted) && (
        <div className="flex items-center gap-2 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 p-3">
          <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
          <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
            {submitted ? t.profile.changesSubmitted : t.profile.changesPending}
          </p>
        </div>
      )}

      {/* Header */}
      <div className="glass-card rounded-2xl p-6 flex items-center gap-4">
        <div className={cn("w-16 h-16 rounded-2xl flex items-center justify-center text-white text-2xl font-bold", emp.color)}>
          {emp.initials}
        </div>
        <div className="flex-1 min-w-0">
          {editing ? (
            <div className="space-y-2">
              <input type="text" value={nameAr} onChange={(e) => setNameAr(e.target.value)} dir="rtl" className={inputClass} />
              <input type="text" value={nameEn} onChange={(e) => setNameEn(e.target.value)} dir="ltr" className={inputClass} />
            </div>
          ) : (
            <>
              <h1 className="text-xl font-bold">{isAr ? emp.nameAr : emp.nameEn}</h1>
              <p className="text-sm text-muted-foreground">{isAr ? emp.positionAr : emp.positionEn}</p>
            </>
          )}
          <span className={cn(
            "inline-block mt-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium",
            emp.status === "active" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400"
              : emp.status === "on-leave" ? "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400"
              : "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400"
          )}>
            {t.emp[emp.status === "active" ? "active" : emp.status === "on-leave" ? "onLeave" : "inactive"]}
          </span>
        </div>
        {!editing && !isAdmin && (
          <Button variant="outline" size="sm" className="gap-1.5 shrink-0" onClick={() => setEditing(true)}>
            <Pencil className="w-3.5 h-3.5" />
            {t.profile.editProfile}
          </Button>
        )}
      </div>

      {/* Personal Info */}
      <div className="glass-card rounded-2xl p-6">
        <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
          <User className="w-5 h-5 text-primary" />
          {t.emp.personalInfo}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {infoFields.map((item) => (
            <div key={item.label} className="flex items-start gap-3">
              <item.icon className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">{item.label}</p>
                {editing && item.editable && item.setter ? (
                  <input
                    type="text"
                    value={item.value ?? ""}
                    onChange={(e) => item.setter!(e.target.value)}
                    dir={item.dir}
                    className={cn(inputClass, "mt-1 h-8 text-sm")}
                  />
                ) : (
                  <p className="text-sm font-medium">{item.value}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Salary Info */}
      <div className="glass-card rounded-2xl p-6">
        <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
          <Wallet className="w-5 h-5 text-primary" />
          {t.emp.salaryInfo}
        </h2>
        <div className="space-y-3">
          {salaryItems.map((item) => (
            <div key={item.label} className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{item.label}</span>
              <span className="font-medium">{item.value.toLocaleString()} {t.common.sar}</span>
            </div>
          ))}
          <div className="border-t border-border pt-3 flex items-center justify-between text-sm font-bold">
            <span>{t.emp.netSalary}</span>
            <span className="text-primary">{totalSalary.toLocaleString()} {t.common.sar}</span>
          </div>
        </div>
      </div>

      {/* Extended Personal Details */}
      {(emp.nationalId || emp.dateOfBirth || emp.maritalStatus || emp.nationality || emp.mobileNumber) && (
        <div className="glass-card rounded-2xl p-6">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-primary" />
            {t.profile.nationalId}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {emp.nationalId && (
              <div className="flex items-start gap-3">
                <Hash className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">{t.profile.nationalId}</p>
                  <p className="text-sm font-medium" dir="ltr">{emp.nationalId}</p>
                </div>
              </div>
            )}
            {emp.nationality && (
              <div className="flex items-start gap-3">
                <Globe className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">{t.profile.nationality}</p>
                  <p className="text-sm font-medium">
                    {emp.nationality === "saudi" ? t.profile.saudi : emp.nationality === "non-saudi" ? t.profile.nonSaudi : emp.nationality}
                  </p>
                </div>
              </div>
            )}
            {emp.dateOfBirth && (
              <div className="flex items-start gap-3">
                <Cake className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">{t.profile.dateOfBirth}</p>
                  <p className="text-sm font-medium">{emp.dateOfBirth}</p>
                </div>
              </div>
            )}
            {emp.maritalStatus && (
              <div className="flex items-start gap-3">
                <Heart className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">{t.profile.maritalStatus}</p>
                  <p className="text-sm font-medium">
                    {t.profile[emp.maritalStatus as keyof typeof t.profile] ?? emp.maritalStatus}
                  </p>
                </div>
              </div>
            )}
            {emp.mobileNumber && (
              <div className="flex items-start gap-3">
                <Phone className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">{t.profile.mobileNumber}</p>
                  <p className="text-sm font-medium" dir="ltr">{emp.mobileNumber}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bank / IBAN */}
      {(emp.bankName || emp.iban) && (
        <div className="glass-card rounded-2xl p-6">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Landmark className="w-5 h-5 text-primary" />
            {t.profile.bankName}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {emp.bankName && (
              <div className="flex items-start gap-3">
                <Landmark className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">{t.profile.bankName}</p>
                  <p className="text-sm font-medium">{emp.bankName}</p>
                </div>
              </div>
            )}
            {emp.iban && (
              <div className="flex items-start gap-3">
                <CreditCard className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">{t.profile.iban}</p>
                  <p className="text-sm font-medium font-mono" dir="ltr">{emp.iban}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Documents */}
      {emp.documents && (
        <div className="glass-card rounded-2xl p-6">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            {t.profile.documents}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {([
              { key: "nationalIdDoc" as const, label: t.profile.nationalIdDoc },
              { key: "cv" as const, label: t.profile.cv },
              { key: "qualification" as const, label: t.profile.qualification },
              { key: "passport" as const, label: t.profile.passport },
            ]).map((doc) => {
              const file = emp.documents?.[doc.key];
              return (
                <div
                  key={doc.key}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-xl border",
                    file
                      ? "border-emerald-200 bg-emerald-50 dark:border-emerald-500/20 dark:bg-emerald-500/5"
                      : "border-border bg-muted/30"
                  )}
                >
                  {file ? (
                    <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  ) : (
                    <FileWarning className="w-5 h-5 text-muted-foreground shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{doc.label}</p>
                    {file ? (
                      <p className="text-xs text-emerald-600 dark:text-emerald-400 truncate">{file.name}</p>
                    ) : (
                      <p className="text-xs text-muted-foreground">{isAr ? "لم يتم الرفع" : "Not uploaded"}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Edit action bar */}
      {editing && (
        <div className="flex items-center justify-end gap-3 pb-4">
          <Button variant="outline" onClick={handleCancel} className="gap-1.5">
            <X className="w-4 h-4" />
            {t.common.cancel}
          </Button>
          <Button onClick={handleSubmit} className="gap-1.5">
            <Send className="w-4 h-4" />
            {t.profile.submitChanges}
          </Button>
        </div>
      )}
    </div>
  );
}
