# NJD HR — Deployment Runbook

The code is ready; these are the operational steps only you (with access to
Supabase, Vercel, and corporate Sentry/legal) can execute. Each section is
copy-paste-ready.

---

## 1. Environment variables

Copy `.env.example` → `.env.local` for local dev, and mirror every variable
into **Vercel → Project → Settings → Environment Variables** for production.

**Required minimum (app works without these but loses features):**

| Variable | Where | Consequence if missing |
|----------|-------|------------------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API | falls back to Landing project (may not be desired) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | same | same |
| `SUPABASE_SERVICE_ROLE_KEY` | same | `/api/notifications/*` returns 503 |
| `RESEND_API_KEY` | resend.com | `/api/invite` returns 503 |
| `NEXT_PUBLIC_APP_URL` | your domain | invite emails point to `njd-hr.vercel.app` |

**Optional (disabled gracefully if unset):**

| Variable | Feature |
|----------|---------|
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Browser push subscriptions |
| `NEXT_PUBLIC_SENTRY_DSN` | Error reporting to Sentry |
| `NEXT_PUBLIC_APP_VERSION` | Release tagging in Sentry |

---

## 2. Supabase — apply migrations

All SQL files live in `supabase/migrations/`. Apply them **in order** via the
Supabase Dashboard → SQL Editor (or `supabase db push` if you use the CLI).

Current migrations (idempotent — safe to re-run):

```
003_daily_reports.sql          # daily_reports table + storage bucket
004_leave_requests.sql         # leave_requests schema
005_server_tables.sql          # server-side helpers
006_notifications_fix.sql      # notifications publication for Realtime
007_lifecycle_jobs.sql         # annual_leave_rollover / expire_invitations /
                               # archive_attendance functions + attendance_archive
008_schedule_cron_jobs.sql     # schedules the above via pg_cron
```

### One-time: enable required extensions

Supabase Dashboard → **Database → Extensions** → enable:
- `pg_cron` (for 008)
- `pg_net` (only if you plan to add HTTP-calling cron jobs later)

### Apply 007 and 008

1. Dashboard → **SQL Editor** → **New query**.
2. Paste the entire contents of `supabase/migrations/007_lifecycle_jobs.sql`. Run.
3. Paste the entire contents of `supabase/migrations/008_schedule_cron_jobs.sql`. Run.
4. Verify:
   ```sql
   select jobname, schedule, active
   from cron.job
   where jobname like 'njd_hr_%';
   ```
   Should return 3 rows, all `active = true`.

### Verify RLS depends on `is_super_admin()`

`schema.sql` assumes `public.is_super_admin(uuid)` exists (defined in the
Landing project). If deploying NJD HR to a fresh Supabase project, re-create it:

```sql
create or replace function is_super_admin(uid uuid)
returns boolean
language sql
stable
security definer
as $$
  select exists (
    select 1 from user_roles
    where user_id = uid and role_name = 'super_admin'
  );
$$;
```

---

## 3. Push notifications (optional)

To enable browser push:

```bash
npx web-push generate-vapid-keys
```

- Put the **public** key in `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (both local + Vercel).
- Keep the **private** key in a Supabase Edge Function that signs push payloads
  before calling `https://fcm.googleapis.com/fcm/send`. Do NOT expose it.

Without these keys, `requestPushPermission()` grants browser permission but
doesn't register a subscription — local notifications from the running tab
still work, but admin-sent pushes will not reach closed tabs.

---

## 4. Sentry (optional)

1. Create a Sentry project → copy the DSN.
2. Set `NEXT_PUBLIC_SENTRY_DSN` locally and in Vercel.
3. Redeploy. The lightweight client in `src/lib/observability.ts` will start
   forwarding errors from both error boundaries. CSP already whitelists the
   Sentry host dynamically from the DSN.

---

## 5. PDPL review (legal, cannot be code-automated)

Before announcing the "Request data erasure" button to staff:

1. Review with counsel which fields must be retained for how long
   (GOSI, ZATCA tax, labor disputes, HR audits).
2. Draft the retained-fields schedule into a policy doc.
   See [`docs/PDPL_RETENTION_POLICY.md`](./docs/PDPL_RETENTION_POLICY.md) for the
   NJD-approved schedule (Saudi Labor Law + GOSI + ZATCA + PDPL Art. 18).
3. Configure HR to triage `employee_requests` where `type_key = 'dataErasure'`
   and apply the lawful erasure + log the retention rationale in
   `reviewed_by` / `reviewed_at`.

The code files the request — it does NOT auto-delete anything.

---

## 6. Verify the deploy

After the first deploy:

```bash
# Local smoke test
npm run dev
# → visit http://localhost:3000, log in, complete a flow

# Security headers
curl -I https://hr.njd-services.net/
# → must show Content-Security-Policy, Strict-Transport-Security,
#   X-Frame-Options: DENY, X-Content-Type-Options: nosniff

# Supabase migrations applied
# → in Supabase dashboard, run:
#   select count(*) from pg_proc where proname in
#   ('annual_leave_rollover','expire_stale_invitations','archive_attendance');
# → expect 3

# pg_cron active
select jobname, active from cron.job where jobname like 'njd_hr_%';
```

---

## 7. Rollback plan

Each migration can be reverted individually:

```sql
-- Unschedule cron jobs (keeps the functions themselves)
select cron.unschedule(jobid) from cron.job where jobname like 'njd_hr_%';

-- Drop lifecycle functions
drop function if exists annual_leave_rollover(int);
drop function if exists expire_stale_invitations(int);
drop function if exists archive_attendance(date);
drop table if exists attendance_archive;
```

Frontend rollback is git-driven: `git revert <commit>` and Vercel redeploys.

---

## 8. Secrets checklist before go-live

- [ ] `SUPABASE_SERVICE_ROLE_KEY` set in Vercel **Server** env only (never prefixed `NEXT_PUBLIC_`)
- [ ] `RESEND_API_KEY` set in Vercel **Server** env only
- [ ] No keys in git history (`git log -p -- .env*` should return nothing)
- [ ] Supabase Landing project CORS allowlist includes `hr.njd-services.net`
- [ ] Domain `hr.njd-services.net` has TLS via Vercel with HSTS header
