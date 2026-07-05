# NJD HR — Master Fix Plan (Full Audit Remediation)

> **Audit date:** 2026-07-05. Produced from a full-project audit (code + Supabase DB + Vercel runtime logs + dependency audit).
> **Executor:** This plan is written for an AI coding agent (Codex) to execute end-to-end.
> **Repo:** NJD HR (Next.js 16 App Router, TypeScript, Supabase, Vercel). Read `CLAUDE.md` first — all its rules apply.

---

## ⚠️ Global constraints (read before touching anything)

1. **NEVER** modify the loading screen (`--njd-loader-*` CSS vars, `njd-*` keyframes, `.njd-loader` HTML).
2. **NEVER** edit `public/njd-navbar.js` (vendored copy; source of truth is the Landing Page repo).
3. **RTL rule:** never `right-*`/`left-*`/`pr-*`/`pl-*`/`mr-*`/`ml-*` for directional positioning — use `end-*`/`start-*`/`pe-*`/`ps-*`/`me-*`/`ms-*`. (`left-1/2 -translate-x-1/2` centering is the allowed exception.)
4. **i18n:** every user-facing string must have both `ar` and `en` entries in `src/lib/i18n.ts`. Western Arabic numerals only (0-9), locale `ar-SA-u-nu-latn`.
5. **Supabase is the single source of truth for business data.** localStorage is for theme/language/settings only.
6. **All SQL migrations run in the Supabase _Landing_ project** (`iauulqfgrbegwcnfatmx`) — add them as files under `supabase/migrations/` in this repo for reference, numbered sequentially (next free number: `007_`).
7. After every phase: `npm run check` must pass (0 type errors). Final gate: `npm run build` succeeds.

---

## 🔴 PHASE 0 — Manual prerequisites (HUMAN ONLY — Codex must skip these, they are listed so nothing is forgotten)

| # | Action | Where | Why |
|---|--------|-------|-----|
| 0.1 | Verify domain `njd-services.net`: add SPF + DKIM DNS records | https://resend.com/domains | **This is the actual cause of the "فشل إرسال الدعوة" bug.** Prod logs show Resend 403: "The njd-services.net domain is not verified". No code change fixes this. |
| 0.2 | Confirm `RESEND_FROM_EMAIL` on Vercel uses the verified domain (e.g. `NJD Games HR <hr@njd-services.net>`) | Vercel → njd-hr → Env Vars | Sender must match the verified domain. |
| 0.3 | Add `RESEND_API_KEY` + `RESEND_FROM_EMAIL` to local `.env.local` | local file | Invitations currently ALWAYS return 503 in local dev (key missing). |
| 0.4 | Enable "Leaked password protection" | Supabase Dashboard → Auth → Passwords | Advisor warning; one toggle. |

---

## 🔴 PHASE 1 — Database migration: invitation integrity (SQL, Landing project)

Create `supabase/migrations/007_pending_invitations_integrity.sql` and run it in the Landing project:

```sql
-- 1) Remove existing duplicates, keep the NEWEST row per email
--    (verified in prod: 5 rows exist for abdullah@njdstudio.net)
DELETE FROM public.pending_invitations p
USING public.pending_invitations newer
WHERE lower(p.email) = lower(newer.email)
  AND p.status = 'pending' AND newer.status = 'pending'
  AND p.created_at < newer.created_at;

-- 2) Prevent future duplicates: one PENDING invitation per email
CREATE UNIQUE INDEX IF NOT EXISTS uq_pending_invitations_email_pending
  ON public.pending_invitations (lower(email))
  WHERE status = 'pending';
```

**Acceptance:** `SELECT lower(email), count(*) FROM pending_invitations WHERE status='pending' GROUP BY 1 HAVING count(*)>1;` returns 0 rows; re-inserting a second pending invite for the same email fails with a unique violation.

---

## 🔴 PHASE 2 — Fix the invitation flow end-to-end (the reported bug)

All in `src/app/employees/employees-view.tsx` + `src/app/api/invite/route.ts`.

### 2.1 Surface the real error instead of a generic message
In `handleInviteSubmit` (around line 350) and `sendInviteEmail` (around line 338):
- `sendInviteEmail` must read the response body on failure and throw an `Error` carrying the server's `error` string: `const body = await res.json().catch(() => null); throw new Error(body?.error || \`HTTP ${res.status}\`)`.
- The `catch` in `handleInviteSubmit` must `console.error` the caught error and append its message to the UI text, e.g. Arabic: `فشل إرسال الدعوة: {message}` / English: `Failed to send invitation: {message}`. Add proper keys to `src/lib/i18n.ts` (module `invite`), don't hardcode inline.
- Distinguish the two failure steps: if `store.sendInvitation` throws a Postgres unique violation (code `23505`), show a dedicated "invitation already pending for this email" message (both languages).

### 2.2 Stop leaving orphan DB rows when the email fails
In `handleInviteSubmit`: if `store.sendInvitation` succeeded but `sendInviteEmail` threw, delete the just-created row (add a `deleteInvitation(id)` action in `src/lib/data-store.tsx` that deletes from `pending_invitations`, checks the error, and removes it from local state). Wrap so the UI error still shows.

### 2.3 Pre-insert duplicate check (UX layer, DB constraint is the backstop)
Before inserting in `sendInvitation` (`src/lib/data-store.tsx` ~line 1084): if `pendingInvitations` already contains a pending invite with the same email (case-insensitive), or `employees` contains that email, throw a typed error and show the dedicated message from 2.1.

### 2.4 Fix operator-precedence bug (line ~343)
`department: isAr ? deptLabel?.ar : deptLabel?.en || data.department`
→ `department: (isAr ? deptLabel?.ar : deptLabel?.en) || data.department`

### 2.5 Add error handling to `handleResend` (line ~385)
Wrap in try/catch; on failure show `toast.error` with the real message (same helper as 2.1); on success show the existing success toast. Also note `resendInvitation` updates `sent_date` — keep that.

### 2.6 Add admin authorization to `/api/invite` (SECURITY — currently ANY request with same-origin headers can send invites)
Follow the existing pattern in `src/app/api/notifications/admins/route.ts` (Bearer token → `anonClient.auth.getUser(token)`), then **additionally** verify the caller is an admin: query `user_roles` for `role_name = 'super_admin'` with the service-role client (fallback: email in the hardcoded admin list `waleed@njdstudio.net` / `salman@njdstudio.net`, same as the notifications route). Return 403 otherwise.
Client side: `sendInviteEmail` must now send `Authorization: Bearer ${session.access_token}` (get the session from the supabase client like other authed calls in the codebase).

**Acceptance:** invite with duplicate email shows the specific message and creates no row; email-send failure leaves no orphan row and shows the real server error; POST to `/api/invite` without a valid admin token returns 401/403; `npm run check` passes.

---

## 🔴 PHASE 3 — Money-affecting correctness bugs (attendance + payroll)

### 3.1 Check-in/out timestamps use BROWSER time, not KSA time (fraud vector)
`src/app/attendance/attendance-view.tsx` ~line 326: `getCurrentTime()` uses `new Date()` (browser local). An employee in a different timezone gets wrong check-in times and can bypass late penalties.
**Fix:** make `getCurrentTime()` derive from the existing `getKSATime()` helper (line 31). Also audit the same file for `new Date().toISOString().split("T")[0]` used as "today" (line ~444) — the calendar date must also be computed in Asia/Riyadh (at ~21:00-24:00 Riyadh time, UTC date differs). Add a `getKSADateString()` helper next to `getKSATime()` and use it everywhere "today" is computed in attendance.

### 3.2 Payroll ignores the remote-employee exemption (verified: `locationRequired` appears nowhere in `src/app/payroll/payroll-view.tsx`)
CLAUDE.md: remote employees (`locationRequired = false`) are exempt from ALL penalties. In the payroll penalty computation (~lines 59-73), skip late/early/absence penalties entirely when the employee's `locationRequired === false`. Use the freshest value available on the employee record (see 3.5).

### 3.3 Guard leave-balance writes in `approveLeaveRequest`
`src/lib/data-store.tsx` ~lines 882-895: the `leave_balances` `update`/`insert` results are not checked. If the write fails, the request is still marked approved → quota bypass.
**Fix:** capture `{ error }` from both calls and `throw` on error BEFORE marking the request approved; order should be: update request row → update balance → refresh; if the balance write fails, revert the request row to pending (or perform balance first, then request approval — choose the order that leaves consistent state on failure and document it in a comment).

### 3.4 `acceptInvitation` fire-and-forget Supabase write
`src/lib/data-store.tsx` ~line 1490: `supabase.from("pending_invitations").update({status:"expired"})` is called inside a `setState` closure — not awaited, errors ignored, and side effects inside setState may fire twice under StrictMode.
**Fix:** make `acceptInvitation` `async`; move the Supabase update OUT of the setState closure; await it, check the error, and only then update local state.

### 3.5 Refresh `locationRequired` at the moment of action
`attendance-view.tsx` fetches `location_required` once on mount. Refetch it from `profiles` immediately before processing a clock-in AND clock-out (cheap single-row select; rule 7 in CLAUDE.md demands freshness).

### 3.6 Negative net salary guard (payroll)
Net can go below zero when penalties + advance deductions exceed gross. Clamp displayed/WPS net at 0 and render a warning badge (both languages) when the raw value is negative, so HR notices instead of exporting a negative WPS row.

### 3.7 Money rounding consistency (payroll)
Round each component (gosi, penalty, advance, net) to 2 decimals at computation time with a single shared `roundMoney(n)` helper in `src/lib/utils.ts`; never display raw floats.

**Acceptance:** unit-style manual checks — employee with `locationRequired=false` and a late check-in gets penalty 0; approving leave with a forced balance-write failure leaves the request non-approved; check-in stored time equals Riyadh wall-clock regardless of system timezone (test by setting system TZ to UTC).

---

## 🟠 PHASE 4 — TypeScript errors + auth-guard hardening

`npm run typecheck` currently FAILS with 4 errors — this blocks CI and must be phase-gated first among code fixes if you prefer, but it's grouped here.

### 4.1 Fix TS7006 implicit-any (4 errors)
`src/components/supabase-auth-guard.tsx` lines 61 and 113: type the `onAuthStateChange` callbacks:
```ts
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
// line 61: (_event: AuthChangeEvent, s: Session | null) => ...
// line 113: (event: AuthChangeEvent, session: Session | null) => ...
```

### 4.2 Handle errors in the session-recovery chain (same file)
- `setSession()` from URL-hash tokens: wrap in try/catch + check returned `error`; on failure fall through to the next recovery step (do not silently proceed with half-set state).
- `refreshSession()`: inspect the returned `error`; log it (`console.warn`) before falling through.

### 4.3 De-duplicate sign-out listeners
There are two `onAuthStateChange` SIGNED_OUT redirects (auth-guard ~line 111 and `providers.tsx` ~line 127). Keep exactly ONE (prefer the auth-guard, it owns session lifecycle); remove the redirect from the other, keeping any state-sync logic it performs. Ensure every subscription is unsubscribed in the effect cleanup and cannot double-fire `resolve()`/`unsubscribe()` (guard with a `settled` flag in the timeout race).

### 4.4 `handleLogout` must await
`src/components/layout/app-shell.tsx` ~line 68: `supabase.auth.signOut()` is not awaited and errors are ignored. Make it `await`, catch failures, and still redirect (logout should be best-effort but observable: `console.error` on failure).

### 4.5 Apply or delete `ADMIN_ROUTE_REDIRECT_MS`
`src/lib/constants.ts:18` exports `ADMIN_ROUTE_REDIRECT_MS = 1500` but nothing uses it. CLAUDE.md says employees are redirected off admin routes after 1.5s — wire the constant into that timeout in `app-shell.tsx`; if the behavior exists with a hardcoded 1500, replace the literal with the constant.

### 4.6 Profile-fetch error handling in app-shell
`app-shell.tsx` ~lines 42-61: the `.single()` profile query ignores `error`. Distinguish "row missing" (redirect to profile completion) from query failure (log + do NOT redirect, to avoid bouncing users on transient network errors).

**Acceptance:** `npm run check` → 0 errors, 0 new warnings; sign-out redirects exactly once; killing the network while loading the shell does not redirect a logged-in user to the landing page.

---

## 🟠 PHASE 5 — API route security hardening

### 5.1 `/api/notifications/admins` — verified: checks token validity but NOT the caller's role
Any authenticated employee can spam all admins. After `getUser(token)`, require the caller to be super_admin (query `user_roles` via the service-role client; fallback to the `ADMIN_EMAILS` list already in the file)? **Careful:** legitimate employee actions (submitting a leave request) notify admins through this route. So instead of requiring admin, enforce: (a) valid session (already done), (b) rate limiting is out of scope, but (c) restrict the payload to a whitelist of notification `type` values and cap title/body lengths (e.g. 200/500 chars) to neuter spam/abuse. Document the decision in a comment.

### 5.2 `/api/notifications/user` — caller can notify ANY user
Require: caller is super_admin, OR `body.userId === caller.id`. Otherwise 403. (Employee flows that notify a specific other user, if any exist, go through admin-triggered actions — verify call sites in `src/lib/notifications.ts` / `data-store.tsx` and adjust so employee-originated calls only target admins via 5.1 or themselves.)

### 5.3 `/api/invite` — covered in 2.6.

### 5.4 Remove hardcoded Supabase URL/key fallbacks
`src/lib/supabase/browser.ts` (and the same pattern in `src/lib/supabase/server.ts`, `admin.ts`, both notification routes, and anywhere else `sb_publishable_` appears — grep it): if `NEXT_PUBLIC_SUPABASE_URL`/`ANON_KEY` are unset, `throw new Error("Supabase env vars missing")` instead of silently falling back to embedded literals. (The anon key is public by design, but silent fallbacks mask misconfiguration and pin the app to one project.)

**Acceptance:** POST `/api/notifications/user` with someone else's userId as a non-admin → 403; grep for `sb_publishable_` in `src/` returns 0 hits.

---

## 🟡 PHASE 6 — Data-store robustness

All in `src/lib/data-store.tsx`.

6.1 **Optimistic update without rollback** — `updateEmployeeManager` (~1421): snapshot previous state, apply optimistic update, on Supabase error restore the snapshot, then rethrow.
6.2 **`processPayroll`** (~1439): move the per-employee `createNotification` loop OUT of the `setState` closure (side effects in setState can double-fire under StrictMode). Fire notifications after state update; keep them non-blocking but count failures and `console.warn` a summary.
6.3 **`departments` persisted in localStorage** (~334): business data — stop persisting/hydrating `departments` from localStorage; fetch from Supabase `departments` table on load (a refresh function likely exists — verify; if departments are currently only local, keep the settings-page editing behavior but treat Supabase as source when available). If a full migration is too invasive, at minimum stop letting a stale localStorage copy override fresher Supabase data.
6.4 **Consistent refresh error logging**: every `refresh*` function must `console.error("[HR] <table> fetch error:", error.message)` on error (several have bare `catch {}` — normalize).
6.5 **`genId` collisions** (~146): the session counter resets on reload. For locally-generated entities that persist (any that end up in Supabase or localStorage), switch to `crypto.randomUUID()`. Keep the readable prefix pattern ONLY for display codes that come from Supabase.
6.6 **`approveLeaveRequest` unknown leave type** (~862): if `req.type` isn't one of the known keys, log a warning and skip balance mutation instead of silently creating a `total: 0` balance row.

---

## 🟡 PHASE 7 — UI / i18n / RTL polish

7.1 `src/app/settings/settings-view.tsx:859`: `className="-mr-2"` → `"-me-2"` (RTL rule).
7.2 `src/app/attendance/attendance-view.tsx` admin KPI tiles (~518-551 and render ~625): wrap counts with the `initialLoaded` guard + pulse skeleton per CLAUDE.md pitfall 8.
7.3 `src/app/profile/complete/page.tsx` (~156-160): move inline `isAr ? "عربي" : "Arabic"` strings into `src/lib/i18n.ts` keys.
7.4 New invite error strings from 2.1 get proper `t.invite.*` keys (ar + en).
7.5 `src/app/layout.tsx:102,109`: remove the unused `eslint-disable` directive and resolve the `google-font-display` warning (add `display: "swap"` to the Tajawal font config if not present — check how the font is loaded first).

---

## 🟡 PHASE 8 — Dependencies

8.1 `npm audit fix` — resolves `ws` (high: memory disclosure + DoS) and others where semver-compatible.
8.2 Upgrade `resend` past the vulnerable `svix` range (audit shows `resend 6.2.0-canary.0 – 6.12.2` affected → move to the latest 6.x above 6.12.2 or 7.x if API-compatible; the only usage is `resend.emails.send` in `/api/invite` — verify signature unchanged).
8.3 Re-run `npm run audit:prod` — target: 0 high/critical in prod deps.

---

## 🟢 PHASE 9 — Supabase hardening & performance (SQL migration, Landing project)

Create `supabase/migrations/008_db_hardening.sql`. **These affect the shared Landing project — every statement must be idempotent and non-breaking for the Landing/Board apps.**

9.1 **Pin `search_path` on all 13 flagged functions** (advisor: `function_search_path_mutable`):
```sql
ALTER FUNCTION public.get_user_role(uuid) SET search_path = public;
ALTER FUNCTION public.has_app_access(uuid, text) SET search_path = public;
ALTER FUNCTION public.is_super_admin(uuid) SET search_path = public;
ALTER FUNCTION public.is_email_allowed(text) SET search_path = public;
ALTER FUNCTION public.handle_new_user() SET search_path = public;
ALTER FUNCTION public.admin_update_role(uuid, text) SET search_path = public;
ALTER FUNCTION public.admin_toggle_app_access(uuid, text, boolean) SET search_path = public;
ALTER FUNCTION public.admin_delete_user(uuid) SET search_path = public;
ALTER FUNCTION public.admin_send_notification(uuid, text, text, text, text, text, text) SET search_path = public;
ALTER FUNCTION public.admin_add_allowed_email(text) SET search_path = public;
ALTER FUNCTION public.admin_remove_allowed_email(uuid) SET search_path = public;
ALTER FUNCTION public.admin_update_location_required(uuid, boolean) SET search_path = public;
ALTER FUNCTION public.admin_list_users() SET search_path = public;
```

9.2 **Revoke anon execution on SECURITY DEFINER functions** (they're only meaningful for signed-in users; the internal `is_super_admin` checks already protect admin_*, this is defense-in-depth):
```sql
REVOKE EXECUTE ON FUNCTION public.get_user_role(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_app_access(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_super_admin(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;
```
⚠️ Do NOT revoke `is_email_allowed` from anon — verify first whether the Landing signup flow calls it pre-auth; if unsure, leave it.

9.3 **RLS performance — `auth_rls_initplan` (59 warnings):** for each flagged policy, replace bare `auth.uid()` with `(SELECT auth.uid())` so it's evaluated once per query instead of per row. Fetch the exact list with the Supabase advisor before writing; prioritize the hot tables: `attendance`, `profiles`, `notifications`, `leave_requests`, `daily_reports`.

9.4 **Multiple permissive policies (130 warnings):** mostly duplicate SELECT policies (`"Super admins manage access"` + `"Users read own access"` etc.). Consolidate per table into a single SELECT policy with `OR` conditions. Start with `app_access`, `app_settings`, `profiles`; verify each app still works after each table.

9.5 **Add the 16 missing FK indexes** (advisor `unindexed_foreign_keys`), e.g.:
```sql
CREATE INDEX IF NOT EXISTS idx_attendance_adjustments_employee_id ON public.attendance_adjustments(employee_id);
CREATE INDEX IF NOT EXISTS idx_attendance_adjustments_reviewed_by ON public.attendance_adjustments(reviewed_by);
-- ...fetch the full list from the performance advisor and cover all 16.
```

9.6 **Drop the 4 unused indexes** flagged by the advisor (`idx_profiles_manager_id`, `idx_employee_assets_employee_id`, `idx_employee_assets_status`, `idx_attendance_archive_employee_date`) — ONLY if they've been unused since before the last deploy; otherwise skip (org-chart manager queries are new).

9.7 **`attachments` bucket listing:** the public bucket has a broad SELECT policy allowing full listing. Narrow it (drop the listing policy; public object-URL access doesn't need it) — verify nothing in Landing/Board lists that bucket first.

---

## ✅ PHASE 10 — Verification protocol (run after ALL phases)

1. `npm run check` → 0 errors.
2. `npm run build` → succeeds.
3. `npm run audit:prod` → 0 high/critical.
4. Manual flows (dev server + real Supabase):
   - Invite: new email → success toast + email received; same email again → "already pending" message, no duplicate row; invalid session → 401.
   - Resend invitation → success/failure toasts both reachable.
   - Attendance: clock-in with system TZ set to UTC → stored time is Riyadh wall-clock.
   - Payroll: remote employee (`locationRequired=false`) with late check-in → penalty 0; penalties+advances > gross → net clamped to 0 + warning badge.
   - Leaves: approve → balance decremented exactly once; reject → unchanged.
   - DevTools Slow-3G hard refresh on Dashboard, Attendance (admin), Employees, Payroll, Reports → no `0` flashes (skeletons instead).
   - RTL: switch to Arabic → settings compliance edit button (7.1) aligned correctly.
5. SQL: duplicate-email insert into `pending_invitations` fails; advisors re-run shows the addressed warnings cleared.

---

## Priority order for execution

`Phase 4.1 (unblock typecheck)` → `1` → `2` → `3` → remaining `4` → `5` → `6` → `7` → `8` → `9` → `10`.

Phases 1 and 9 are SQL against the shared Landing project — generate the migration files in-repo, but flag them for human review before applying (they affect Landing + Board too). Everything else is safe to implement and verify autonomously.
