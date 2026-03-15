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
