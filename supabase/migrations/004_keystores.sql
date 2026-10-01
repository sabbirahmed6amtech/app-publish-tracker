-- ============================================================================
-- 004 — keystores belong to the client
--
-- One keystore (file + alias + passwords) usually signs every app a client
-- ships — user, vendor, delivery — and it doesn't change between releases.
-- So it lives on the client and apps point at it, instead of each app row in
-- each release carrying its own copy.
--
-- Existing JKS data on apps is moved into client keystores and the apps are
-- linked to them. Placeholder text like "N/A" is skipped. The old apps.jks
-- text column is left in place as a fallback; the file columns are cleared
-- once the keystore owns the file.
--
-- Run this in the SQL editor.
-- ============================================================================

create table if not exists keystores (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references clients (id) on delete cascade,
  name       text not null default 'Keystore',
  details    text,                      -- key.properties / alias / passwords
  file_path  text,                      -- object in the private 'jks' bucket
  file_name  text,
  note       text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists keystores_client_idx on keystores (client_id);

drop trigger if exists keystores_touch on keystores;
create trigger keystores_touch before update on keystores
  for each row execute function touch_updated_at();

alter table keystores enable row level security;
drop policy if exists team_all on keystores;
create policy team_all on keystores for all to authenticated using (true) with check (true);

alter table apps add column if not exists keystore_id uuid references keystores (id) on delete set null;
create index if not exists apps_keystore_idx on apps (keystore_id);

-- ------------------------------------------------------ carry existing JKS --
-- One keystore per client per distinct file (or, with no file, per distinct
-- details text). legacy_key is only used to link the apps back afterwards.
alter table keystores add column legacy_key text;

with src as (
  select r.client_id,
         a.jks_file_path,
         a.jks_file_name,
         case when upper(trim(coalesce(a.jks, ''))) in ('', 'N/A', 'NA', '-') then null
              else a.jks end as details,
         a.updated_at
  from apps a
  join releases r on r.id = a.release_id
  where a.keystore_id is null
),
keyed as (
  select *, coalesce(jks_file_path, details) as legacy_key
  from src
  where jks_file_path is not null or details is not null
)
insert into keystores (client_id, name, details, file_path, file_name, legacy_key)
select distinct on (client_id, legacy_key)
       client_id,
       coalesce(regexp_replace(jks_file_name, '\.(jks|keystore|p12)$', '', 'i'), 'Keystore'),
       details,
       jks_file_path,
       jks_file_name,
       legacy_key
from keyed
order by client_id, legacy_key, (details is null), updated_at desc;

update apps a
set keystore_id = k.id
from releases r, keystores k
where r.id = a.release_id
  and k.client_id = r.client_id
  and a.keystore_id is null
  and k.legacy_key = coalesce(
        a.jks_file_path,
        case when upper(trim(coalesce(a.jks, ''))) in ('', 'N/A', 'NA', '-') then null
             else a.jks end);

-- The keystore owns the file now.
update apps set jks_file_path = null, jks_file_name = null where keystore_id is not null;

alter table keystores drop column legacy_key;
