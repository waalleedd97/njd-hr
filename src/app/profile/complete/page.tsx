"use client";

import { useState, useRef } from "react";
import { useLanguage, useAuth } from "@/components/providers";
import { useData } from "@/lib/data-store";
import { cn } from "@/lib/utils";
import type { UploadedDocument, Employee } from "@/lib/mock-data";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";

type DocKey = "nationalIdDoc" | "cv" | "qualification" | "passport";

const NATIONALITIES = [
  { code: "SA", ar: "سعودي", en: "Saudi" },
  { code: "AE", ar: "إماراتي", en: "Emirati" },
  { code: "KW", ar: "كويتي", en: "Kuwaiti" },
  { code: "BH", ar: "بحريني", en: "Bahraini" },
  { code: "QA", ar: "قطري", en: "Qatari" },
  { code: "OM", ar: "عماني", en: "Omani" },
  { code: "IQ", ar: "عراقي", en: "Iraqi" },
  { code: "JO", ar: "أردني", en: "Jordanian" },
  { code: "LB", ar: "لبناني", en: "Lebanese" },
  { code: "SY", ar: "سوري", en: "Syrian" },
  { code: "PS", ar: "فلسطيني", en: "Palestinian" },
  { code: "EG", ar: "مصري", en: "Egyptian" },
  { code: "SD", ar: "سوداني", en: "Sudanese" },
  { code: "LY", ar: "ليبي", en: "Libyan" },
  { code: "TN", ar: "تونسي", en: "Tunisian" },
  { code: "DZ", ar: "جزائري", en: "Algerian" },
  { code: "MA", ar: "مغربي", en: "Moroccan" },
  { code: "MR", ar: "موريتاني", en: "Mauritanian" },
  { code: "YE", ar: "يمني", en: "Yemeni" },
  { code: "SO", ar: "صومالي", en: "Somali" },
  { code: "DJ", ar: "جيبوتي", en: "Djiboutian" },
  { code: "KM", ar: "قمري", en: "Comorian" },
] as const;

const DEFAULT_NATIONALITY = "SA";

export default function CompleteProfilePage() {
  const { t, lang } = useLanguage();
  const { user } = useAuth();
  const store = useData();
  const isAr = lang === "ar";

  const emp = store.employees.find((e) => e.id === user.id || e.email === user.email);
  const employeeId = emp?.id || user.id;

  const [fullNameAr, setFullNameAr] = useState("");
  const [fullNameEn, setFullNameEn] = useState("");
  const [maritalStatus, setMaritalStatus] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [nationalId, setNationalId] = useState("");
  const [bankName, setBankName] = useState("");
  const [iban, setIban] = useState("");
  const [salary, setSalary] = useState("");
  const [nationality, setNationality] = useState(DEFAULT_NATIONALITY);
  const [documents, setDocuments] = useState<Record<string, UploadedDocument | undefined>>({});

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeDocKey, setActiveDocKey] = useState<DocKey | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeDocKey) return;
    setDocuments((prev) => ({
      ...prev,
      [activeDocKey]: {
        name: file.name,
        type: file.type,
        size: file.size,
        uploadedAt: new Date().toISOString(),
      },
    }));
    setActiveDocKey(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const triggerUpload = (key: DocKey) => {
    setActiveDocKey(key);
    fileInputRef.current?.click();
  };

  const maritalOptions = [
    { value: "single", label: t.profile.single },
    { value: "married", label: t.profile.married },
  ];

  const docFields: { key: DocKey; label: string; required: boolean }[] = [
    { key: "nationalIdDoc", label: t.profile.nationalIdDoc, required: true },
    { key: "cv", label: t.profile.cv, required: true },
    { key: "qualification", label: t.profile.qualification, required: true },
    { key: "passport", label: t.profile.passport, required: nationality !== DEFAULT_NATIONALITY },
  ];

  const requiredFilled =
    fullNameAr && fullNameEn && maritalStatus && dateOfBirth && mobileNumber &&
    nationalId && bankName && iban && salary && nationality;

  const handleSubmit = async () => {
    if (!employeeId || !requiredFilled) return;
    try {
      await store.completeProfile(employeeId, {
        fullNameAr,
        fullNameEn,
        nameAr: fullNameAr,
        nameEn: fullNameEn,
        maritalStatus,
        dateOfBirth,
        mobileNumber,
        phone: mobileNumber,
        nationalId,
        bankName,
        iban,
        nationality,
        salary: { basic: Number(salary), housing: 0, transport: 0, other: 0 },
        initials: fullNameAr.split(" ").map((w) => w[0]).slice(0, 2).join(""),
        documents: documents as Employee["documents"],
      });
      window.location.href = "/";
    } catch (error) {
      console.error("[HR] profile completion failed:", error);
    }
  };

  const inputClass =
    "h-11 w-full rounded-xl bg-surface-container-high px-4 text-sm outline-none focus:ring-2 focus:ring-primary/40";

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-8">
      <input ref={fileInputRef} type="file" accept="image/*,.pdf" className="hidden" onChange={handleFileSelect} />

      {/* Header */}
      <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-primary-container/40 flex items-center justify-center">
            <Icon name="person" size={30} fill className="text-primary" />
          </div>
          <div>
            <h1 className="font-headline text-2xl font-bold tracking-tight">{t.profile.completeTitle}</h1>
            <p className="text-sm text-on-surface-variant mt-1">{t.profile.completeDesc}</p>
          </div>
        </div>
      </div>

      {/* Personal Information */}
      <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm space-y-5">
        <div className="flex items-center gap-3">
          <span className="w-1.5 h-7 bg-primary rounded-full" />
          <h2 className="font-headline font-bold text-lg">{t.emp.personalInfo}</h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
	            <label className="text-sm font-bold block mb-1.5">{t.profile.fullName} ({t.profile.arabicLabel})</label>
            <input type="text" value={fullNameAr} onChange={(e) => setFullNameAr(e.target.value)} dir="rtl" className={inputClass} />
          </div>
          <div>
	            <label className="text-sm font-bold block mb-1.5">{t.profile.fullName} ({t.profile.englishLabel})</label>
            <input type="text" value={fullNameEn} onChange={(e) => setFullNameEn(e.target.value)} dir="ltr" className={inputClass} />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm font-bold block mb-1.5">{t.profile.maritalStatus}</label>
            <select value={maritalStatus} onChange={(e) => setMaritalStatus(e.target.value)} className={inputClass}>
              <option value="">--</option>
              {maritalOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm font-bold block mb-1.5">{t.profile.dateOfBirth}</label>
            <input type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} className={inputClass} />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm font-bold block mb-1.5">{t.profile.mobileNumber}</label>
            <input type="tel" dir="ltr" value={mobileNumber} onChange={(e) => setMobileNumber(e.target.value)} placeholder="+966 5x xxx xxxx" className={inputClass} />
          </div>
          <div>
            <label className="text-sm font-bold block mb-1.5">{t.profile.nationalId}</label>
            <input type="text" dir="ltr" value={nationalId} onChange={(e) => setNationalId(e.target.value)} className={inputClass} />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm font-bold block mb-1.5">{t.profile.nationality}</label>
            <select value={nationality} onChange={(e) => setNationality(e.target.value)} className={inputClass}>
              <option value="">--</option>
              {NATIONALITIES.map((n) => (
                <option key={n.code} value={n.code}>{isAr ? n.ar : n.en}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-bold block mb-1.5">{t.profile.salary} ({t.common.sar})</label>
            <input type="number" dir="ltr" value={salary} onChange={(e) => setSalary(e.target.value)} className={inputClass} />
          </div>
        </div>
      </div>

      {/* Bank Information */}
      <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm space-y-5">
        <div className="flex items-center gap-3">
          <span className="w-1.5 h-7 bg-emerald-500 rounded-full" />
          <h2 className="font-headline font-bold text-lg">{t.profile.bankName} & {t.profile.iban}</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm font-bold block mb-1.5">{t.profile.bankName}</label>
            <input type="text" value={bankName} onChange={(e) => setBankName(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="text-sm font-bold block mb-1.5">{t.profile.iban}</label>
            <input type="text" dir="ltr" value={iban} onChange={(e) => setIban(e.target.value)} placeholder="SA..." className={inputClass} />
          </div>
        </div>
      </div>

      {/* Document Uploads */}
      <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm space-y-5">
        <div className="flex items-center gap-3">
          <span className="w-1.5 h-7 bg-tertiary rounded-full" />
          <h2 className="font-headline font-bold text-lg">{t.profile.documents}</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {docFields.filter((d) => d.required || nationality !== DEFAULT_NATIONALITY).map((doc) => {
            const uploaded = documents[doc.key];
            return (
              <button
                key={doc.key}
                type="button"
                onClick={() => triggerUpload(doc.key)}
                className={cn(
                  "flex items-center gap-3 p-4 rounded-2xl transition-all text-start",
                  uploaded
                    ? "bg-emerald-500/10 ring-2 ring-emerald-500/30"
                    : "bg-surface-container-high hover:bg-surface-container-highest ring-2 ring-transparent hover:ring-primary/20"
                )}
              >
                <div className={cn(
                  "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0",
                  uploaded ? "bg-emerald-500/20" : "bg-surface-container-lowest"
                )}>
                  <Icon
                    name={uploaded ? "check_circle" : "cloud_upload"}
                    fill={!!uploaded}
                    size={24}
                    className={uploaded ? "text-emerald-600 dark:text-emerald-400" : "text-on-surface-variant"}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold truncate">{doc.label}</p>
                  {uploaded ? (
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 truncate font-medium mt-0.5 flex items-center gap-1">
                      <Icon name="description" size={12} />
                      {uploaded.name}
                    </p>
                  ) : (
                    <p className="text-xs text-on-surface-variant mt-0.5 font-medium">{t.profile.uploadFile}</p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Submit */}
      <div className="flex justify-end">
        <Button size="lg" disabled={!requiredFilled} onClick={handleSubmit}>
          <Icon name="check_circle" size={20} fill />
          {t.profile.completeProfile}
        </Button>
      </div>
    </div>
  );
}
