/**
 * Centralised timing and UX constants.
 *
 * Pulling these out of component files prevents "magic number drift" — where
 * two files disagree on what "short delay" means — and makes them trivially
 * tunable from one place.
 */

// ─── Auth / Session ──────────────────────────────────────────────────

/** Max time to wait for onAuthStateChange before falling through. */
export const AUTH_TIMEOUT_MS = 3000;

/** Safety timeout before forcibly marking the app "ready" even if sync didn't finish. */
export const APP_READY_FALLBACK_MS = 8000;

/** Grace period before redirecting a non-admin away from admin routes. */
export const ADMIN_ROUTE_REDIRECT_MS = 1500;

// ─── Attendance ──────────────────────────────────────────────────────

/** Earliest permitted check-in hour (KSA, 24h). */
export const CHECK_IN_EARLIEST_HOUR = 6;

/** Reference hour for computing "late" minutes (KSA, 24h). 10:00 AM. */
export const LATE_REFERENCE_HOUR = 10;

/** Tooltip refresh interval for "too early" banner. */
export const TOO_EARLY_CHECK_INTERVAL_MS = 30_000;

/** Geolocation request timeout. */
export const GEOLOCATION_TIMEOUT_MS = 10_000;

// ─── Daily Reports ───────────────────────────────────────────────────

/** Max number of attachments per daily report. */
export const DAILY_REPORT_MAX_FILES = 5;

/** Max size per attachment (bytes). */
export const DAILY_REPORT_MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

/** Signed URL TTL for daily-report attachments (seconds). */
export const SIGNED_URL_TTL_SEC = 3600;

/** Refresh the signed URL when this many ms are left before expiry. */
export const SIGNED_URL_REFRESH_MARGIN_MS = 5 * 60 * 1000;

// ─── Work Timer (Dashboard) ──────────────────────────────────────────

/** Expected full workday in minutes. */
export const WORK_DAY_TARGET_MIN = 420; // 7 hours

/** Update cadence for the live "elapsed work" counter. */
export const WORK_TIMER_TICK_MS = 60_000;
