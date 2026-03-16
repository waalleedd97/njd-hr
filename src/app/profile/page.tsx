"use client";

import { useLanguage, useAuth } from "@/components/providers";
import { employees } from "@/lib/mock-data";
import { useData } from "@/lib/data-store";
import { cn } from "@/lib/utils";
import { User, Mail, Phone, Building2, Briefcase, CalendarDays, Hash, Wallet } from "lucide-react";

export default function ProfilePage() {
  const { t, lang } = useLanguage();
  const { user } = useAuth();
  const store = useData();
  const departments = store.departments;
  const isAr = lang === "ar";

  const emp = employees.find((e) => e.id === user.id);
  if (!emp) return null;

  const dept = departments[emp.department];
  const totalSalary = emp.salary.basic + emp.salary.housing + emp.salary.transport + emp.salary.other;

  const infoItems = [
    { icon: Hash, label: t.emp.empId, value: emp.id },
    { icon: Mail, label: t.emp.email, value: emp.email },
    { icon: Phone, label: t.emp.phone, value: emp.phone },
    { icon: Building2, label: t.common.department, value: isAr ? dept?.ar : dept?.en },
    { icon: Briefcase, label: t.emp.position, value: isAr ? emp.positionAr : emp.positionEn },
    { icon: CalendarDays, label: t.emp.joinDate, value: emp.joinDate },
  ];

  const salaryItems = [
    { label: t.emp.basic, value: emp.salary.basic },
    { label: t.emp.housing, value: emp.salary.housing },
    { label: t.emp.transport, value: emp.salary.transport },
    { label: t.emp.other, value: emp.salary.other },
  ];

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="glass-card rounded-2xl p-6 flex items-center gap-4">
        <div className={cn("w-16 h-16 rounded-2xl flex items-center justify-center text-white text-2xl font-bold", emp.color)}>
          {emp.initials}
        </div>
        <div>
          <h1 className="text-xl font-bold">{isAr ? emp.nameAr : emp.nameEn}</h1>
          <p className="text-sm text-muted-foreground">{isAr ? emp.positionAr : emp.positionEn}</p>
          <span className={cn(
            "inline-block mt-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium",
            emp.status === "active" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400"
              : emp.status === "on-leave" ? "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400"
              : "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400"
          )}>
            {t.emp[emp.status === "active" ? "active" : emp.status === "on-leave" ? "onLeave" : "inactive"]}
          </span>
        </div>
      </div>

      {/* Personal Info */}
      <div className="glass-card rounded-2xl p-6">
        <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
          <User className="w-5 h-5 text-primary" />
          {t.emp.personalInfo}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {infoItems.map((item) => (
            <div key={item.label} className="flex items-start gap-3">
              <item.icon className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">{item.label}</p>
                <p className="text-sm font-medium">{item.value}</p>
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
    </div>
  );
}
