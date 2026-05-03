-- =====================================================================
-- NJD HR — Add manager_id to profiles for Org Chart hierarchy
-- =====================================================================
-- Adds an optional self-referencing FK so each employee can point at their
-- direct manager. Used by Settings → Employees → Org Chart and by the
-- profile dialog's "Direct manager" picker.
-- =====================================================================

alter table public.profiles
  add column if not exists manager_id uuid references public.profiles(id) on delete set null;

create index if not exists idx_profiles_manager_id on public.profiles(manager_id);

comment on column public.profiles.manager_id is
  'Optional FK to profiles.id — the employee''s direct line manager.
   Used to render the Org Chart tab in the HR app.';
