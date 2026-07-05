-- Invitation integrity backstop for the shared Landing Supabase project.
-- Review and apply manually in project iauulqfgrbegwcnfatmx.

-- 1) Remove existing duplicate pending invitations, keeping the newest row per email.
DELETE FROM public.pending_invitations p
USING public.pending_invitations newer
WHERE lower(p.email) = lower(newer.email)
  AND p.status = 'pending'
  AND newer.status = 'pending'
  AND p.created_at < newer.created_at;

-- 2) Prevent future duplicates: one pending invitation per email.
CREATE UNIQUE INDEX IF NOT EXISTS uq_pending_invitations_email_pending
  ON public.pending_invitations (lower(email))
  WHERE status = 'pending';
