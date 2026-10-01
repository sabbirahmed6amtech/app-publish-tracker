-- ============================================================================
-- 003 — real keystore files
--
-- The JKS column stays as free text (key.properties, alias, passwords …) and
-- each app can now also carry the actual .jks / .keystore file, kept in a
-- private storage bucket. Only signed-in team members can read or write it.
--
-- Run this in the SQL editor.
-- ============================================================================

alter table apps add column if not exists jks_file_path text;
alter table apps add column if not exists jks_file_name text;

insert into storage.buckets (id, name, public)
values ('jks', 'jks', false)
on conflict (id) do nothing;

drop policy if exists jks_team_all on storage.objects;
create policy jks_team_all on storage.objects
  for all to authenticated
  using (bucket_id = 'jks')
  with check (bucket_id = 'jks');
