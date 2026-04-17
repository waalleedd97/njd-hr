/**
 * Saudi Labor Law calculators.
 *
 * All references are to the Saudi Labor Law (Royal Decree No. M/51, 2005,
 * as amended). Values are pragmatic defaults that should be overridable
 * per-employee in `profiles` or `app_settings` when individual contracts
 * diverge.
 */

import type { Employee } from "./mock-data";
import { getKSANow } from "./utils";

// ─── Article 84–85: End-of-Service Benefits (EoSB) ────────────────────

/** Months of work (monthly salary units) due as EoSB for a given tenure. */
export function calcEndOfServiceMonths(years: number): number {
  if (years <= 0) return 0;
  // Article 84: half-month for each of the first 5 years, full month after.
  if (years <= 5) return years * 0.5;
  return 2.5 + (years - 5); // 5 × 0.5 = 2.5 months for first 5 years
}

/** Number of full years (including pro-rated tail) between two dates. */
export function tenureYears(joinDate: string, asOf: Date = getKSANow()): number {
  if (!joinDate) return 0;
  const join = new Date(joinDate + "T00:00:00");
  if (isNaN(join.getTime())) return 0;
  const ms = asOf.getTime() - join.getTime();
  return Math.max(0, ms / (1000 * 60 * 60 * 24 * 365.25));
}

/**
 * Amount of EoSB owed as of today. Uses **monthly gross salary**
 * (basic + housing + transport + other) per Saudi labor-law interpretation.
 * `reasonCode` lets callers apply the partial entitlement rules
 * (resignation short of 2 years = 0, 2–5 years = 1/3, 5–10 = 2/3).
 */
export function calcEndOfServiceBenefit(
  emp: Pick<Employee, "salary" | "joinDate">,
  reasonCode: "termination" | "resignation" = "termination"
): { years: number; months: number; amount: number } {
  const years = tenureYears(emp.joinDate);
  let months = calcEndOfServiceMonths(years);

  if (reasonCode === "resignation") {
    // Article 85: employees who resign receive fractional EoSB
    if (years < 2) months = 0;
    else if (years < 5) months = months / 3;
    else if (years < 10) months = (months * 2) / 3;
    // 10+ years → full entitlement
  }

  const monthlySalary =
    emp.salary.basic + emp.salary.housing + emp.salary.transport + emp.salary.other;
  const amount = Math.round(months * monthlySalary * 100) / 100;
  return { years, months, amount };
}

// ─── Article 53: Probation Period ─────────────────────────────────────

/** Default probation window in days; may be extended to 180 by written agreement. */
export const PROBATION_DEFAULT_DAYS = 90;
export const PROBATION_MAX_DAYS = 180;

export function probationEndDate(joinDate: string, days = PROBATION_DEFAULT_DAYS): Date {
  const join = new Date(joinDate + "T00:00:00");
  return new Date(join.getTime() + days * 24 * 60 * 60 * 1000);
}

export function probationStatus(
  joinDate: string,
  days = PROBATION_DEFAULT_DAYS,
  asOf: Date = getKSANow()
): { inProbation: boolean; daysRemaining: number; endDate: Date } {
  const endDate = probationEndDate(joinDate, days);
  const ms = endDate.getTime() - asOf.getTime();
  const daysRemaining = Math.ceil(ms / (1000 * 60 * 60 * 24));
  return {
    inProbation: daysRemaining > 0,
    daysRemaining: Math.max(0, daysRemaining),
    endDate,
  };
}

// ─── Article 98: Ramadan Working Hours ───────────────────────────────
//
// During Ramadan, Muslim employees work 6 hours/day (instead of 8) with
// no reduction in pay. We approximate "is it Ramadan?" using the Islamic
// calendar from Intl.DateTimeFormat when available.

export function isRamadan(date: Date = getKSANow()): boolean {
  try {
    const parts = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura", {
      month: "numeric",
    }).formatToParts(date);
    const monthPart = parts.find((p) => p.type === "month");
    return monthPart?.value === "9";
  } catch {
    return false;
  }
}

/**
 * Latest permissible check-in time in minutes-past-midnight.
 * During Ramadan the office opens later (8:00 AM) since shifts are shorter.
 */
export function lateReferenceMinutes(date: Date = getKSANow()): number {
  return isRamadan(date) ? 8 * 60 : 10 * 60;
}

/** Expected working minutes for a day (7.5h baseline, 6h in Ramadan). */
export function expectedWorkMinutes(date: Date = getKSANow()): number {
  return isRamadan(date) ? 6 * 60 : 7 * 60 + 30;
}

// ─── Article 107: Overtime Pay ───────────────────────────────────────

/** Saudi Labor Law: overtime pay = hourly wage + 50% premium. */
export const OVERTIME_MULTIPLIER = 1.5;

/** Standard working hours per day (used as overtime threshold). */
export const STANDARD_HOURS_PER_DAY = 8;

/** Standard working days per month for hourly-rate derivation. */
export const WORKING_DAYS_PER_MONTH = 22;

/** Derived hourly wage from monthly gross salary. */
export function hourlyWage(monthlyGross: number): number {
  return monthlyGross / (WORKING_DAYS_PER_MONTH * STANDARD_HOURS_PER_DAY);
}

/**
 * Given actual hours worked on a day and monthly gross, return the
 * overtime premium due (not including the base hours which are paid via
 * salary already).
 */
export function calcOvertimePay(
  hoursWorked: number,
  monthlyGross: number,
  standardHours = STANDARD_HOURS_PER_DAY
): number {
  const overtimeHours = Math.max(0, hoursWorked - standardHours);
  if (overtimeHours === 0) return 0;
  const rate = hourlyWage(monthlyGross);
  // Overtime *total* = hours × rate × 1.5; salary already covers hours × rate.
  // So the *additional* amount owed is hours × rate × 0.5.
  return Math.round(overtimeHours * rate * (OVERTIME_MULTIPLIER - 1) * 100) / 100;
}
