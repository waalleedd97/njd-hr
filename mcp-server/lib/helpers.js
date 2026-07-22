// Shared helpers: KSA timezone, tool response formatting, error wrapper,
// employee resolution, penalty rules (mirrors src/lib/mock-data.ts).

// ─── KSA timezone (Asia/Riyadh) ──────────────────────────────────────

const dateFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Riyadh",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const timeFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Riyadh",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** Today's date in KSA as YYYY-MM-DD. */
export function ksaToday() {
  return dateFmt.format(new Date());
}

/** Current time in KSA as HH:MM (24h, Western numerals). */
export function ksaNow() {
  return timeFmt.format(new Date());
}

/** Current year in KSA. */
export function ksaYear() {
  return Number(ksaToday().slice(0, 4));
}

// ─── Response formatting ─────────────────────────────────────────────

/** Wrap any JSON-serializable payload into an MCP text response. */
export function json(data) {
  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
  };
}

/** Human-readable bilingual summary response for write operations. */
export function summary(ar, en, extra) {
  return json({ ok: true, ar, en, ...(extra || {}) });
}

/** Wrap a tool handler so thrown errors become isError responses. */
export function withError(fn) {
  return async (args) => {
    try {
      return await fn(args);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `خطأ / Error: ${message}`,
          },
        ],
      };
    }
  };
}

/** Throw if a Supabase query returned an error. */
export function throwIfError(error) {
  if (error) throw new Error(error.message || String(error));
}

// ─── Penalty rules (mirror src/lib/mock-data.ts) ─────────────────────

export const LATE_REFERENCE_MINUTES = 10 * 60; // 10:00 KSA
export const GOSI_RATE = 0.0975;
export const GOSI_RATE_COMPANY = 0.1225;
export const GOSI_CAP = 45000;

/** Minutes late relative to 10:00 KSA. Negative/zero = on time. */
export function minutesLate(checkIn) {
  if (!checkIn) return 0;
  const [h, m] = String(checkIn).split(":").map(Number);
  return h * 60 + m - LATE_REFERENCE_MINUTES;
}

/**
 * Late-arrival penalty percentage for given minutes late (from 10:00):
 * 1-15 -> 0 (grace), 16-30 -> 0 (warning), 31-60 -> 5, >60 -> 10, absent -> 100.
 */
export function calcPenaltyPct(minutes) {
  if (minutes <= 0) return 0;
  if (minutes <= 15) return 0;
  if (minutes <= 30) return 0; // warning only
  if (minutes <= 60) return 5;
  return 10;
}

/** Daily salary = gross / 30. */
export function calcDailySalary(gross) {
  return gross / 30;
}

export function roundMoney(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

// ─── Employee resolution ─────────────────────────────────────────────

/**
 * Fetch all users (auth + profiles + roles), merged into admin_list_users()-shaped
 * rows: user_id, email, created_at, role_name, name_ar, name_en, full_name_ar,
 * full_name_en, phone, department, job_title_ar, profile_completed, manager_id,
 * national_id, employee_number, location_required.
 *
 * Note: the admin_list_users() RPC is granted to `authenticated` only, so it
 * rejects the service-role PostgREST role. We use the Auth Admin API instead.
 */
export async function listUsers(supabase) {
  const authUsers = [];
  let page = 1;
  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(error.message || String(error));
    const batch = data?.users || [];
    authUsers.push(...batch);
    if (batch.length < 1000) break;
    page += 1;
  }

  const [{ data: profiles, error: pErr }, { data: roles, error: rErr }] =
    await Promise.all([
      supabase.from("profiles").select("*"),
      supabase.from("user_roles").select("user_id, role_name"),
    ]);
  throwIfError(pErr);
  throwIfError(rErr);
  const profileMap = new Map((profiles || []).map((p) => [p.id, p]));
  const roleMap = new Map((roles || []).map((r) => [r.user_id, r.role_name]));

  return authUsers.map((u) => {
    const p = profileMap.get(u.id) || {};
    return {
      user_id: u.id,
      email: u.email,
      created_at: u.created_at,
      role_name: roleMap.get(u.id) || null,
      name_ar: p.name_ar ?? null,
      name_en: p.name_en ?? null,
      full_name_ar: p.full_name_ar ?? null,
      full_name_en: p.full_name_en ?? null,
      phone: p.phone ?? null,
      department: p.department ?? null,
      job_title_ar: p.job_title_ar ?? null,
      profile_completed: p.profile_completed ?? null,
      manager_id: p.manager_id ?? null,
      national_id: p.national_id ?? null,
      employee_number: p.employee_number ?? null,
      location_required: p.location_required ?? null,
    };
  });
}

/**
 * Resolve an employee reference ({ employee_id } or { email }) to a user row.
 * Throws if neither is provided or no match is found.
 */
export async function resolveEmployee(supabase, args) {
  const users = await listUsers(supabase);
  let user = null;
  if (args.employee_id) {
    user = users.find((u) => u.user_id === args.employee_id) || null;
  } else if (args.email) {
    const email = String(args.email).toLowerCase().trim();
    user = users.find((u) => String(u.email).toLowerCase() === email) || null;
  }
  if (!user) {
    throw new Error(
      `الموظف غير موجود / Employee not found: ${args.employee_id || args.email || "(no reference given)"}`
    );
  }
  return user;
}

/** Build a user_id -> user map for name lookups. */
export function userMap(users) {
  const map = new Map();
  for (const u of users) map.set(u.user_id, u);
  return map;
}

/** Concise display name pair for a user row. */
export function displayName(u) {
  if (!u) return { nameAr: null, nameEn: null };
  return {
    nameAr: u.name_ar || u.full_name_ar || null,
    nameEn: u.name_en || u.full_name_en || null,
  };
}

// ─── HTML escaping (mirror src/app/api/invite/route.ts) ──────────────

export function escapeHtml(input) {
  const s = String(input ?? "");
  return s.replace(/[&<>"'`/]/g, (c) => {
    switch (c) {
      case "&": return "&amp;";
      case "<": return "&lt;";
      case ">": return "&gt;";
      case '"': return "&quot;";
      case "'": return "&#x27;";
      case "`": return "&#x60;";
      case "/": return "&#x2F;";
      default: return c;
    }
  });
}
