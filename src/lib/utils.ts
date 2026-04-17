import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Returns the locale string for the given language.
 * Always uses Western Arabic numerals (1, 2, 3) via the `-u-nu-latn` Unicode extension.
 */
export function getLocale(lang: string): string {
  return lang === "ar" ? "ar-SA-u-nu-latn" : "en-US";
}

/** Format a date using Western Arabic numerals regardless of language. */
export function formatDate(
  date: Date | string,
  lang: string,
  options?: Intl.DateTimeFormatOptions
): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString(getLocale(lang), options);
}

/** Format a number using Western Arabic numerals regardless of language. */
export function formatNumber(value: number, lang: string): string {
  return value.toLocaleString(getLocale(lang));
}

// ─── KSA (Asia/Riyadh) timezone helpers ───────────────────────────────
//
// All business-logic times (check-in/out, attendance dates, leave request
// dates, payroll calculations, etc.) must be anchored to Asia/Riyadh
// regardless of where the employee physically is. An employee in Karachi
// at 9:00 AM local (= 7:00 AM KSA) gets stamped as 07:00 and is within
// the 6:00 AM–10:00 AM check-in window.
//
// Do NOT use these for audit timestamps (created_at, reviewed_at,
// uploaded_at) — those stay UTC so Supabase/Postgres can compare them
// consistently across deployments.

const KSA_TZ = "Asia/Riyadh";

/** Current moment shifted to Asia/Riyadh wall-clock. */
export function getKSANow(): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: KSA_TZ }));
}

/** "YYYY-MM-DD" string using the Riyadh calendar day. */
export function getKSADateString(): string {
  const d = getKSANow();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** "HH:MM" 24-hour string in Riyadh local time. */
export function getKSATimeString(): string {
  const d = getKSANow();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Hour 0-23 in Riyadh. */
export function getKSAHour(): number {
  return getKSANow().getHours();
}

/** Year (4 digits) in Riyadh. */
export function getKSAYear(): number {
  return getKSANow().getFullYear();
}

/** Day of week 0-6 (0 = Sunday) in Riyadh. */
export function getKSADayOfWeek(): number {
  return getKSANow().getDay();
}
