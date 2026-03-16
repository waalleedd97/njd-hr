"use client";

import { useState, useRef } from "react";
import { useLanguage, useAuth } from "@/components/providers";
import { useData } from "@/lib/data-store";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { UploadedDocument } from "@/lib/mock-data";
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
  Upload,
} from "lucide-react";

type DocKey = "nationalIdDoc" | "cv" | "qualification" | "passport";

export default function ProfilePage() {
  const { t, lang } = useLanguage();
  const { user, isAdmin } = useAuth();
  const store = useData();
  const departments = store.departments;
  const isAr = lang === "ar";

  const emp = store.employees.find((e) => e.id === user.id);

  // All hooks must be before early return
  const [editing, setEditing] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Personal info
  const [phone, setPhone] = useState(emp?.phone ?? "");
  const [email, setEmail] = useState(emp?.email ?? "");
  const [nameAr, setNameAr] = useState(emp?.nameAr ?? "");
  const [nameEn, setNameEn] = useState(emp?.nameEn ?? "");
  const [positionAr, setPositionAr] = useState(emp?.positionAr ?? "");
  const [positionEn, setPositionEn] = useState(emp?.positionEn ?? "");

  // Identity fields
  const [nationalId, setNationalId] = useState(emp?.nationalId ?? "");
  const [nationality, setNationality] = useState(emp?.nationality ?? "");
  const [dateOfBirth, setDateOfBirth] = useState(emp?.dateOfBirth ?? "");
  const [maritalStatus, setMaritalStatus] = useState(emp?.maritalStatus ?? "");
  const [mobileNumber, setMobileNumber] = useState(emp?.mobileNumber ?? "");

  // Bank fields
  const [bankName, setBankName] = useState(emp?.bankName ?? "");
  const [iban, setIban] = useState(emp?.iban ?? "");

  // Document uploads
  const [documents, setDocuments] = useState<Record<string, UploadedDocument | undefined>>(emp?.documents ?? {});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeDocKey, setActiveDocKey] = useState<DocKey | null>(null);

  if (!emp) return null;

  const dept = departments[emp.department];
  const totalSalary = emp.salary.basic + emp.salary.housing + emp.salary.transport + emp.salary.other;

  const hasPendingRequest = store.employeeRequests.some(
    (r) => r.employeeId === emp.id && r.typeKey === "profileUpdate" && r.status === "pending"
  );

  const inputClass =
    "h-9 w-full rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors";

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeDocKey) return;
    setDocuments((prev) => ({
      ...prev,
      [activeDocKey]: { name: file.name, type: file.type, size: file.size, uploadedAt: new Date().toISOString() },
    }));
    setActiveDocKey(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const triggerUpload = (key: DocKey) => {
    setActiveDocKey(key);
    fileInputRef.current?.click();
  };

  const handleCancel = () => {
    setPhone(emp.phone); setEmail(emp.email);
    setNameAr(emp.nameAr); setNameEn(emp.nameEn);
    setPositionAr(emp.positionAr); setPositionEn(emp.positionEn);
    setNationalId(emp.nationalId ?? ""); setNationality(emp.nationality ?? "");
    setDateOfBirth(emp.dateOfBirth ?? ""); setMaritalStatus(emp.maritalStatus ?? "");
    setMobileNumber(emp.mobileNumber ?? "");
    setBankName(emp.bankName ?? ""); setIban(emp.iban ?? "");
    setDocuments(emp.documents ?? {});
    setEditing(false);
  };

  const handleSubmit = () => {
    const changes: string[] = [];
    if (nameAr !== emp.nameAr) changes.push(`${t.common.name}(AR): ${nameAr}`);
    if (nameEn !== emp.nameEn) changes.push(`${t.common.name}(EN): ${nameEn}`);
    if (email !== emp.email) changes.push(`${t.emp.email}: ${email}`);
    if (phone !== emp.phone) changes.push(`${t.emp.phone}: ${phone}`);
    if (positionAr !== emp.positionAr) changes.push(`${t.emp.position}(AR): ${positionAr}`);
    if (positionEn !== emp.positionEn) changes.push(`${t.emp.position}(EN): ${positionEn}`);
    if (nationalId !== (emp.nationalId ?? "")) changes.push(`${t.profile.nationalId}: ${nationalId}`);
    if (nationality !== (emp.nationality ?? "")) changes.push(`${t.profile.nationality}: ${nationality}`);
    if (dateOfBirth !== (emp.dateOfBirth ?? "")) changes.push(`${t.profile.dateOfBirth}: ${dateOfBirth}`);
    if (maritalStatus !== (emp.maritalStatus ?? "")) changes.push(`${t.profile.maritalStatus}: ${maritalStatus}`);
    if (mobileNumber !== (emp.mobileNumber ?? "")) changes.push(`${t.profile.mobileNumber}: ${mobileNumber}`);
    if (bankName !== (emp.bankName ?? "")) changes.push(`${t.profile.bankName}: ${bankName}`);
    if (iban !== (emp.iban ?? "")) changes.push(`${t.profile.iban}: ${iban}`);
    // Check document changes
    for (const key of ["nationalIdDoc", "cv", "qualification", "passport"] as DocKey[]) {
      const oldName = emp.documents?.[key]?.name;
      const newName = documents[key]?.name;
      if (newName !== oldName) changes.push(`${t.profile[key === "nationalIdDoc" ? "nationalIdDoc" : key]}: ${newName ?? "—"}`);
    }

    if (changes.length === 0) { setEditing(false); return; }

    store.submitEmployeeRequest({
      employeeId: emp.id, typeKey: "profileUpdate",
      date: new Date().toISOString().split("T")[0], status: "pending",
      detailsAr: changes.join(" | "), detailsEn: changes.join(" | "),
    });
    store.addNotification({
      type: "request", titleAr: "طلب تعديل بيانات", titleEn: "Profile Update Request",
      descAr: `طلب تعديل بيانات من ${emp.nameAr}`, descEn: `Profile update request from ${emp.nameEn}`,
      time: 0, read: false, href: "/requests",
    });
    setEditing(false); setSubmitted(true);
    setTimeout(() => setSubmitted(false), 3000);
  };

  const maritalLabel = (v: string) => {
    const key = v as keyof typeof t.profile;
    return t.profile[key] ?? v;
  };

  const natLabel = (v: string) => v || "—";

  // Field renderer
  const Field = ({ icon: Icon, label, value, dir }: { icon: typeof Hash; label: string; value: string | undefined | null; dir?: string }) => (
    <div className="flex items-start gap-3">
      <Icon className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={cn("text-sm", value ? "font-medium" : "text-muted-foreground")} dir={dir}>{value || "—"}</p>
      </div>
    </div>
  );

  const EditField = ({ icon: Icon, label, value, onChange, dir, type }: { icon: typeof Hash; label: string; value: string; onChange: (v: string) => void; dir?: string; type?: string }) => (
    <div className="flex items-start gap-3">
      <Icon className="w-4 h-4 text-muted-foreground mt-2.5 shrink-0" />
      <div className="flex-1">
        <p className="text-xs text-muted-foreground mb-1">{label}</p>
        <input type={type ?? "text"} value={value} onChange={(e) => onChange(e.target.value)} dir={dir} className={cn(inputClass, "h-8 text-sm")} />
      </div>
    </div>
  );

  const SelectField = ({ icon: Icon, label, value, onChange, options }: { icon: typeof Hash; label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) => (
    <div className="flex items-start gap-3">
      <Icon className="w-4 h-4 text-muted-foreground mt-2.5 shrink-0" />
      <div className="flex-1">
        <p className="text-xs text-muted-foreground mb-1">{label}</p>
        <select value={value} onChange={(e) => onChange(e.target.value)} className={cn(inputClass, "h-8 text-sm")}>
          <option value="">—</option>
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
    </div>
  );

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

  const docFields: { key: DocKey; label: string }[] = [
    { key: "nationalIdDoc", label: t.profile.nationalIdDoc },
    { key: "cv", label: t.profile.cv },
    { key: "qualification", label: t.profile.qualification },
    { key: "passport", label: t.profile.passport },
  ];

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <input ref={fileInputRef} type="file" accept="image/*,.pdf" className="hidden" onChange={handleFileSelect} />

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
                  <input type="text" value={item.value ?? ""} onChange={(e) => item.setter!(e.target.value)} dir={item.dir} className={cn(inputClass, "mt-1 h-8 text-sm")} />
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

      {/* Identity & Personal Details */}
      <div className="glass-card rounded-2xl p-6">
        <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-primary" />
          {t.profile.nationalId}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {editing ? (
            <>
              <EditField icon={Hash} label={t.profile.nationalId} value={nationalId} onChange={setNationalId} dir="ltr" />
              <SelectField icon={Globe} label={t.profile.nationality} value={nationality} onChange={setNationality} options={[
                { value: "سعودي", label: isAr ? "سعودي" : "Saudi" },
                { value: "إماراتي", label: isAr ? "إماراتي" : "Emirati" },
                { value: "كويتي", label: isAr ? "كويتي" : "Kuwaiti" },
                { value: "بحريني", label: isAr ? "بحريني" : "Bahraini" },
                { value: "قطري", label: isAr ? "قطري" : "Qatari" },
                { value: "عماني", label: isAr ? "عماني" : "Omani" },
                { value: "عراقي", label: isAr ? "عراقي" : "Iraqi" },
                { value: "أردني", label: isAr ? "أردني" : "Jordanian" },
                { value: "لبناني", label: isAr ? "لبناني" : "Lebanese" },
                { value: "سوري", label: isAr ? "سوري" : "Syrian" },
                { value: "فلسطيني", label: isAr ? "فلسطيني" : "Palestinian" },
                { value: "مصري", label: isAr ? "مصري" : "Egyptian" },
                { value: "سوداني", label: isAr ? "سوداني" : "Sudanese" },
                { value: "ليبي", label: isAr ? "ليبي" : "Libyan" },
                { value: "تونسي", label: isAr ? "تونسي" : "Tunisian" },
                { value: "جزائري", label: isAr ? "جزائري" : "Algerian" },
                { value: "مغربي", label: isAr ? "مغربي" : "Moroccan" },
                { value: "موريتاني", label: isAr ? "موريتاني" : "Mauritanian" },
                { value: "يمني", label: isAr ? "يمني" : "Yemeni" },
                { value: "صومالي", label: isAr ? "صومالي" : "Somali" },
                { value: "جيبوتي", label: isAr ? "جيبوتي" : "Djiboutian" },
                { value: "قمري", label: isAr ? "قمري" : "Comorian" },
              ]} />
              <EditField icon={Cake} label={t.profile.dateOfBirth} value={dateOfBirth} onChange={setDateOfBirth} type="date" />
              <SelectField icon={Heart} label={t.profile.maritalStatus} value={maritalStatus} onChange={setMaritalStatus} options={[
                { value: "single", label: t.profile.single },
                { value: "married", label: t.profile.married },
                { value: "divorced", label: t.profile.divorced },
                { value: "widowed", label: t.profile.widowed },
              ]} />
              <EditField icon={Phone} label={t.profile.mobileNumber} value={mobileNumber} onChange={setMobileNumber} dir="ltr" />
            </>
          ) : (
            <>
              <Field icon={Hash} label={t.profile.nationalId} value={emp.nationalId} dir="ltr" />
              <Field icon={Globe} label={t.profile.nationality} value={emp.nationality ? natLabel(emp.nationality) : null} />
              <Field icon={Cake} label={t.profile.dateOfBirth} value={emp.dateOfBirth} />
              <Field icon={Heart} label={t.profile.maritalStatus} value={emp.maritalStatus ? maritalLabel(emp.maritalStatus) : null} />
              <Field icon={Phone} label={t.profile.mobileNumber} value={emp.mobileNumber} dir="ltr" />
            </>
          )}
        </div>
      </div>

      {/* Bank / IBAN */}
      <div className="glass-card rounded-2xl p-6">
        <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
          <Landmark className="w-5 h-5 text-primary" />
          {t.profile.bankName} & {t.profile.iban}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {editing ? (
            <>
              <EditField icon={Landmark} label={t.profile.bankName} value={bankName} onChange={setBankName} />
              <EditField icon={CreditCard} label={t.profile.iban} value={iban} onChange={setIban} dir="ltr" />
            </>
          ) : (
            <>
              <Field icon={Landmark} label={t.profile.bankName} value={emp.bankName} />
              <Field icon={CreditCard} label={t.profile.iban} value={emp.iban} dir="ltr" />
            </>
          )}
        </div>
      </div>

      {/* Documents */}
      <div className="glass-card rounded-2xl p-6">
        <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
          <FileText className="w-5 h-5 text-primary" />
          {t.profile.documents}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {docFields.map((doc) => {
            const file = documents[doc.key];
            return (
              <button
                key={doc.key}
                type="button"
                disabled={!editing}
                onClick={() => editing && triggerUpload(doc.key)}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-xl border text-start transition-colors",
                  file
                    ? "border-emerald-200 bg-emerald-50 dark:border-emerald-500/20 dark:bg-emerald-500/5"
                    : "border-border bg-muted/30",
                  editing && "cursor-pointer hover:border-primary/50 hover:bg-accent/30"
                )}
              >
                {file ? (
                  <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                ) : editing ? (
                  <Upload className="w-5 h-5 text-primary shrink-0" />
                ) : (
                  <FileWarning className="w-5 h-5 text-muted-foreground shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{doc.label}</p>
                  {file ? (
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 truncate">{file.name}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      {editing ? t.profile.uploadFile : (isAr ? "لم يتم الرفع" : "Not uploaded")}
                    </p>
                  )}
                </div>
                {editing && file && (
                  <span className="text-[10px] text-primary font-medium shrink-0">{isAr ? "تغيير" : "Change"}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

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
