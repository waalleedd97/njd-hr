-- =====================================================================
-- NJD HR — handle_new_user must also create the profiles row
-- =====================================================================
-- Root cause of the 2026-07-22 invite failure: `handle_new_user()` only
-- seeded user_roles / app_access / notification_preferences. It never
-- inserted into `profiles`, so a newly registered employee arrived with
-- NO profiles row. Profile completion (`/profile/complete`) then ran an
-- UPDATE that matched 0 rows and silently "succeeded", the layout gate
-- kept seeing profile_completed = false, and the user was bounced back —
-- invite flow broken end-to-end (discovered with abdullah@njdstudio.net).
--
-- Fix: seed `profiles` in the same trigger. `name_ar`/`name_en` are NOT
-- NULL with no default, so derive them from the auth metadata with a
-- guaranteed non-empty fallback (the email local-part). Data from the
-- pending invitation (department, position) is NOT available here — the
-- HR app already reconciles that on first load.
-- =====================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  fallback_name text;
begin
  fallback_name := coalesce(
    nullif(trim(NEW.raw_user_meta_data->>'full_name'), ''),
    nullif(trim(NEW.raw_user_meta_data->>'name'), ''),
    split_part(NEW.email, '@', 1)
  );

  insert into public.profiles (id, name_ar, name_en)
  values (
    NEW.id,
    coalesce(nullif(trim(NEW.raw_user_meta_data->>'name_ar'), ''), fallback_name),
    coalesce(nullif(trim(NEW.raw_user_meta_data->>'name_en'), ''), fallback_name)
  )
  on conflict (id) do nothing;

  insert into public.user_roles (user_id, role_name)
  values (NEW.id, 'employee')
  on conflict (user_id) do nothing;

  insert into public.app_access (user_id, app_name)
  values (NEW.id, 'board'), (NEW.id, 'hr')
  on conflict (user_id, app_name) do nothing;

  insert into public.notification_preferences (user_id, app_name)
  values (NEW.id, 'board'), (NEW.id, 'hr')
  on conflict (user_id, app_name) do nothing;

  return NEW;
end;
$$;

comment on function public.handle_new_user is
  'Seeds profiles, user_roles (employee), app_access (board+hr) and notification_preferences for every new auth user.';
