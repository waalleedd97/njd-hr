-- =====================================================================
-- NJD HR — Departments id type fix + employee self-service documents
-- =====================================================================
-- 1) departments.id was uuid, but the HR app inserts kebab-case string
--    keys (e.g. 'software-dev') — every insert from HR Settings failed
--    silently, so departments never reached the DB. Switch to text.
--    (Table was empty at migration time; verified before writing this.)
--
-- 2) Employees manage their OWN rows in employee_documents and their OWN
--    folder in the employee-documents bucket, so the Landing profile page
--    can offer self-service document upload (previously admin-only).
--
-- 3) Backfill: the Landing profile used to store document paths in
--    profiles.iqama_file / passport_file / cv_file / degree_file. Copy
--    them into employee_documents so both apps read one source of truth.
-- =====================================================================

-- ── 1) departments.id: uuid → text ──────────────────────────────────
alter table departments alter column id drop default;
alter table departments alter column id type text;

-- ── 2) employee self-write policies ─────────────────────────────────
drop policy if exists "employee_documents_self_write" on employee_documents;
create policy "employee_documents_self_write" on employee_documents
  for all using (employee_id = auth.uid())
  with check (employee_id = auth.uid());

drop policy if exists "employee_documents_self_storage_write" on storage.objects;
create policy "employee_documents_self_storage_write" on storage.objects
  for all using (
    bucket_id = 'employee-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'employee-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ── 3) backfill legacy profile-column documents ─────────────────────
insert into employee_documents (employee_id, doc_type, file_name, file_path)
  select id, 'national_id', substring(iqama_file from '[^/]+$'), iqama_file
  from profiles where iqama_file is not null
on conflict (employee_id, doc_type) do nothing;

insert into employee_documents (employee_id, doc_type, file_name, file_path)
  select id, 'passport', substring(passport_file from '[^/]+$'), passport_file
  from profiles where passport_file is not null
on conflict (employee_id, doc_type) do nothing;

insert into employee_documents (employee_id, doc_type, file_name, file_path)
  select id, 'cv', substring(cv_file from '[^/]+$'), cv_file
  from profiles where cv_file is not null
on conflict (employee_id, doc_type) do nothing;

insert into employee_documents (employee_id, doc_type, file_name, file_path)
  select id, 'degree', substring(degree_file from '[^/]+$'), degree_file
  from profiles where degree_file is not null
on conflict (employee_id, doc_type) do nothing;
