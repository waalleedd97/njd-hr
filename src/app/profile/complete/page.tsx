"use client";

import { useState, useRef } from "react";
import { useLanguage, useAuth } from "@/components/providers";
import { useData } from "@/lib/data-store";
import { cn } from "@/lib/utils";
import type { UploadedDocument, Employee } from "@/lib/mock-data";
import {
  User,
  Upload,
  CheckCircle,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";

type DocKey = "nationalIdDoc" | "cv" | "qualification" | "passport";

export default function CompleteProfilePage() {
  const { t, lang } = useLanguage();
  const { user } = useAuth();
  const store = useData();
  const isAr = lang === "ar";

  const emp = store.employees.find((e) => e.id === user.id);

  const [fullNameAr, setFullNameAr] = useState("");
  const [fullNameEn, setFullNameEn] = useState("");
  const [maritalStatus, setMaritalStatus] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [nationalId, setNationalId] = useState("");
  const [bankName, setBankName] = useState("");
  const [iban, setIban] = useState("");
  const [salary, setSalary] = useState("");
  const [nationality, setNationality] = useState("سعودي");
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
    { key: "passport", label: t.profile.passport, required: nationality !== "سعودي" },
  ];

  const requiredFilled =
    fullNameAr && fullNameEn && maritalStatus && dateOfBirth && mobileNumber &&
    nationalId && bankName && iban && salary && nationality;

  const handleSubmit = () => {
    if (!emp || !requiredFilled) return;
    store.completeProfile(emp.id, {
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
    // Update auth state to reflect completed profile
    window.location.href = "/";
  };

  const inputClass =
    "h-10 w-full rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors";

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <input ref={fileInputRef} type="file" accept="image/*,.pdf" className="hidden" onChange={handleFileSelect} />

      {/* Header */}
      <div className="glass-card rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <User className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold">{t.profile.completeTitle}</h1>
            <p className="text-sm text-muted-foreground">{t.profile.completeDesc}</p>
          </div>
        </div>
      </div>

      {/* Personal Information */}
      <div className="glass-card rounded-2xl p-6 space-y-4">
        <h2 className="text-lg font-bold">{t.emp.personalInfo}</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm font-medium block mb-1">{t.profile.fullName} ({isAr ? "عربي" : "Arabic"})</label>
            <input type="text" value={fullNameAr} onChange={(e) => setFullNameAr(e.target.value)} dir="rtl" className={inputClass} />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">{t.profile.fullName} ({isAr ? "إنجليزي" : "English"})</label>
            <input type="text" value={fullNameEn} onChange={(e) => setFullNameEn(e.target.value)} dir="ltr" className={inputClass} />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm font-medium block mb-1">{t.profile.maritalStatus}</label>
            <select value={maritalStatus} onChange={(e) => setMaritalStatus(e.target.value)} className={inputClass}>
              <option value="">--</option>
              {maritalOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">{t.profile.dateOfBirth}</label>
            <input type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} className={inputClass} />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm font-medium block mb-1">{t.profile.mobileNumber}</label>
            <input type="tel" dir="ltr" value={mobileNumber} onChange={(e) => setMobileNumber(e.target.value)} placeholder="+966 5x xxx xxxx" className={inputClass} />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">{t.profile.nationalId}</label>
            <input type="text" dir="ltr" value={nationalId} onChange={(e) => setNationalId(e.target.value)} className={inputClass} />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm font-medium block mb-1">{t.profile.nationality}</label>
            <select value={nationality} onChange={(e) => setNationality(e.target.value)} className={inputClass}>
              <option value="">--</option>
              {[
                { v: "سعودي", ar: "سعودي", en: "Saudi" },
                { v: "إماراتي", ar: "إماراتي", en: "Emirati" },
                { v: "كويتي", ar: "كويتي", en: "Kuwaiti" },
                { v: "بحريني", ar: "بحريني", en: "Bahraini" },
                { v: "قطري", ar: "قطري", en: "Qatari" },
                { v: "عماني", ar: "عماني", en: "Omani" },
                { v: "عراقي", ar: "عراقي", en: "Iraqi" },
                { v: "أردني", ar: "أردني", en: "Jordanian" },
                { v: "لبناني", ar: "لبناني", en: "Lebanese" },
                { v: "سوري", ar: "سوري", en: "Syrian" },
                { v: "فلسطيني", ar: "فلسطيني", en: "Palestinian" },
                { v: "مصري", ar: "مصري", en: "Egyptian" },
                { v: "سوداني", ar: "سوداني", en: "Sudanese" },
                { v: "ليبي", ar: "ليبي", en: "Libyan" },
                { v: "تونسي", ar: "تونسي", en: "Tunisian" },
                { v: "جزائري", ar: "جزائري", en: "Algerian" },
                { v: "مغربي", ar: "مغربي", en: "Moroccan" },
                { v: "موريتاني", ar: "موريتاني", en: "Mauritanian" },
                { v: "يمني", ar: "يمني", en: "Yemeni" },
                { v: "صومالي", ar: "صومالي", en: "Somali" },
                { v: "جيبوتي", ar: "جيبوتي", en: "Djiboutian" },
                { v: "قمري", ar: "قمري", en: "Comorian" },
              ].map((n) => <option key={n.v} value={n.v}>{isAr ? n.ar : n.en}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">{t.profile.salary} ({t.common.sar})</label>
            <input type="number" dir="ltr" value={salary} onChange={(e) => setSalary(e.target.value)} className={inputClass} />
          </div>
        </div>
      </div>

      {/* Bank Information */}
      <div className="glass-card rounded-2xl p-6 space-y-4">
        <h2 className="text-lg font-bold">{t.profile.bankName} & {t.profile.iban}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm font-medium block mb-1">{t.profile.bankName}</label>
            <input type="text" value={bankName} onChange={(e) => setBankName(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">{t.profile.iban}</label>
            <input type="text" dir="ltr" value={iban} onChange={(e) => setIban(e.target.value)} placeholder="SA..." className={inputClass} />
          </div>
        </div>
      </div>

      {/* Document Uploads */}
      <div className="glass-card rounded-2xl p-6 space-y-4">
        <h2 className="text-lg font-bold">{t.profile.documents}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {docFields.filter((d) => d.required || nationality !== "سعودي").map((doc) => {
            const uploaded = documents[doc.key];
            return (
              <button
                key={doc.key}
                type="button"
                onClick={() => triggerUpload(doc.key)}
                className={cn(
                  "flex items-center gap-3 p-4 rounded-xl border-2 border-dashed transition-colors text-start",
                  uploaded
                    ? "border-emerald-300 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/5"
                    : "border-border hover:border-primary/50 hover:bg-accent/30"
                )}
              >
                <div className={cn(
                  "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
                  uploaded ? "bg-emerald-100 dark:bg-emerald-500/15" : "bg-muted"
                )}>
                  {uploaded ? (
                    <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <Upload className="w-5 h-5 text-muted-foreground" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{doc.label}</p>
                  {uploaded ? (
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 truncate">
                      <FileText className="w-3 h-3 inline me-1" />{uploaded.name}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">{t.profile.uploadFile}</p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Submit */}
      <div className="flex justify-end pb-6">
        <Button
          size="lg"
          disabled={!requiredFilled}
          onClick={handleSubmit}
          className="gap-2"
        >
          <CheckCircle className="w-4 h-4" />
          {t.profile.completeProfile}
        </Button>
      </div>
    </div>
  );
}
