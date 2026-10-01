-- ============================================================================
-- App Publish Tracker — schema v2 (releases)
--
-- A client is published in versions. Each one is a RELEASE with its own
-- version, its own dates, and the person who did the work:
--
--   client  ->  publisher_account   (stable: the store accounts they own)
--           ->  keystore            (signing keys the apps share)
--           ->  product             (stable: the client's apps, one per store)
--           ->  release             (one versioned publication)
--                 -> app            (one product's submission in that release)
--
-- Run this in the Supabase SQL editor. It DROPS the v1 tables first, so
-- anything currently stored is discarded.
-- ============================================================================

create extension if not exists "pgcrypto";

drop table if exists app_events         cascade;
drop table if exists team_members       cascade;
drop table if exists apps               cascade;
drop table if exists product_line_projects cascade;
drop table if exists product_lines      cascade;
drop table if exists products           cascade;
drop table if exists keystores          cascade;
drop table if exists releases           cascade;
drop table if exists publisher_accounts cascade;
drop table if exists clients            cascade;

drop type if exists app_status   cascade;
drop type if exists account_type cascade;
drop type if exists platform     cascade;

-- ---------------------------------------------------------------- enums ----
create type platform     as enum ('play_store', 'app_store');
create type account_type as enum ('organization', 'personal');

create type app_status as enum (
  'ongoing',        -- being prepared / built
  'in_review',      -- submitted, waiting on the store
  'closed_testing', -- Play Console closed testing track
  'rejected',       -- store sent it back
  'production',     -- live
  'on_hold'         -- blocked (client access, dependency, ...)
);

-- --------------------------------------------------------------- tables ----

create table clients (
  id          uuid primary key default gen_random_uuid(),
  ticket      text not null unique,
  name        text not null,
  note        text,
  archived    boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- The people work is assigned to. Kept in sync with Supabase Auth, but a
-- member can also exist without a login.
create table team_members (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid unique references auth.users (id) on delete set null,
  name       text not null,
  email      text,
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The developer accounts a client owns. These outlive any single release.
create table publisher_accounts (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references clients (id) on delete cascade,
  platform      platform not null,
  account_name  text not null default '',
  account_type  account_type not null default 'organization',
  note          text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (client_id, platform)
);

-- One versioned release for one client.
create table releases (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references clients (id) on delete cascade,
  version      text not null,            -- 1.1.0, 4.1, 8.4 …
  title        text,                     -- optional label: "Rental module"
  assigned_to  uuid references team_members (id) on delete set null,
  note         text,
  started_on   date not null default current_date,
  released_on  date,                     -- set when everything is live
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (client_id, version)
);

create index releases_client_idx   on releases (client_id, started_on desc);
create index releases_assigned_idx on releases (assigned_to);

-- The signing keystore. One usually signs every app a client ships (user,
-- vendor, delivery …), so it lives on the client and apps point at it.
create table keystores (
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

create index keystores_client_idx on keystores (client_id);

-- A client's permanent apps: set up once, submitted every release. Each store
-- listing is its own product (the User app on Play and on iOS are two).
create table products (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references clients (id) on delete cascade,
  account_id   uuid not null references publisher_accounts (id) on delete cascade,
  project_name text not null,                -- 6amMart-User-App, StackFood Store …
  app_name     text not null default '',     -- the store listing name
  keystore_id  uuid references keystores (id) on delete set null,
  store_url    text,
  note         text,
  sort_order   integer not null default 0,
  archived     boolean not null default false, -- left out of new releases
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (account_id, project_name)
);

create index products_client_idx on products (client_id);

-- One product's submission in a release. The identity columns (account,
-- project, app name, keystore, store link) mirror the product via trigger.
create table apps (
  id                uuid primary key default gen_random_uuid(),
  release_id        uuid not null references releases (id) on delete cascade,
  product_id        uuid not null references products (id) on delete cascade,
  account_id        uuid not null references publisher_accounts (id) on delete cascade,
  project_name      text not null,              -- 6amMart-User-App, StackFood Store …
  app_name          text not null default '',   -- BOOKVEY, ZippyGo Store …
  status            app_status not null default 'ongoing',
  assigned_to       uuid references team_members (id) on delete set null,
  build_version     text,                       -- 1.0.0+4
  flutter_version   text,
  keystore_id       uuid references keystores (id) on delete set null,
  jks               text,                       -- legacy, superseded by keystore_id
  jks_file_path     text,                       -- legacy
  jks_file_name     text,                       -- legacy
  store_url         text,
  note              text,
  sort_order        integer not null default 0,
  status_changed_at timestamptz not null default now(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index apps_release_idx on apps (release_id);
create index apps_account_idx on apps (account_id);
create index apps_status_idx   on apps (status);
create index apps_assigned_idx on apps (assigned_to);
create index apps_keystore_idx on apps (keystore_id);
create index apps_product_idx on apps (product_id);

create table app_events (
  id          uuid primary key default gen_random_uuid(),
  app_id      uuid not null references apps (id) on delete cascade,
  kind        text not null,          -- 'created' | 'status' | 'note'
  from_status app_status,
  to_status   app_status,
  message     text,
  actor       text,
  created_at  timestamptz not null default now()
);

create index app_events_app_idx on app_events (app_id, created_at desc);

-- ------------------------------------------------------------- triggers ----

create or replace function touch_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end $$ language plpgsql;

create trigger clients_touch            before update on clients
  for each row execute function touch_updated_at();
create trigger team_members_touch       before update on team_members
  for each row execute function touch_updated_at();
create trigger publisher_accounts_touch before update on publisher_accounts
  for each row execute function touch_updated_at();
create trigger releases_touch           before update on releases
  for each row execute function touch_updated_at();
create trigger apps_touch               before update on apps
  for each row execute function touch_updated_at();
create trigger keystores_touch          before update on keystores
  for each row execute function touch_updated_at();
create trigger products_touch           before update on products
  for each row execute function touch_updated_at();

-- A submission always mirrors its product's identity …
create or replace function apps_from_product() returns trigger as $$
declare p products%rowtype;
begin
  select * into p from products where id = new.product_id;
  if not found then
    raise exception 'App % does not exist', new.product_id;
  end if;
  new.account_id   := p.account_id;
  new.project_name := p.project_name;
  new.app_name     := p.app_name;
  new.keystore_id  := p.keystore_id;
  new.store_url    := p.store_url;
  return new;
end $$ language plpgsql;

create trigger apps_from_product before insert or update on apps
  for each row execute function apps_from_product();

-- … so editing a product updates every submission of it.
create or replace function products_sync_apps() returns trigger as $$
begin
  update apps set product_id = new.id
   where product_id = new.id
     and (account_id, project_name, app_name, keystore_id, store_url)
         is distinct from
         (new.account_id, new.project_name, new.app_name, new.keystore_id, new.store_url);
  return null;
end $$ language plpgsql;

create trigger products_sync_apps after update on products
  for each row execute function products_sync_apps();

-- Record status transitions so we can show how long something has sat.
create or replace function log_app_status() returns trigger as $$
declare who text;
begin
  select name into who from team_members where id = new.assigned_to;

  if tg_op = 'INSERT' then
    insert into app_events (app_id, kind, to_status, message, actor)
    values (new.id, 'created', new.status, 'App added', who);
    return new;
  end if;

  if new.status is distinct from old.status then
    new.status_changed_at = now();
    insert into app_events (app_id, kind, from_status, to_status, actor)
    values (new.id, 'status', old.status, new.status, who);
  end if;
  return new;
end $$ language plpgsql;

create trigger apps_log_status_upd before update on apps
  for each row execute function log_app_status();
create trigger apps_log_status_ins after insert on apps
  for each row execute function log_app_status();

-- Stamp released_on the moment a release's last app goes live, and clear it
-- again if anything reopens.
create or replace function sync_release_released_on() returns trigger as $$
declare
  target uuid := coalesce(new.release_id, old.release_id);
  pending integer;
  total   integer;
begin
  select count(*) filter (where status <> 'production'), count(*)
    into pending, total
    from apps where release_id = target;

  -- Keep the date it first went fully live; later edits must not move it.
  update releases
     set released_on = case when total > 0 and pending = 0
                            then coalesce(released_on, current_date) else null end
   where id = target;

  return null;
end $$ language plpgsql;

create trigger apps_sync_release after insert or update or delete on apps
  for each row execute function sync_release_released_on();

-- Everyone added under Authentication -> Users becomes a team member.
create or replace function sync_team_member() returns trigger as $$
begin
  insert into team_members (user_id, name, email)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
      split_part(new.email, '@', 1)
    ),
    new.email
  )
  on conflict (user_id) do nothing;
  return new;
end $$ language plpgsql security definer set search_path = public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function sync_team_member();

insert into team_members (user_id, name, email)
select u.id,
       coalesce(
         nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''),
         nullif(trim(u.raw_user_meta_data ->> 'name'), ''),
         split_part(u.email, '@', 1)
       ),
       u.email
from auth.users u
on conflict (user_id) do nothing;

-- ------------------------------------------------------------------ rls ----
alter table clients            enable row level security;
alter table team_members       enable row level security;
alter table publisher_accounts enable row level security;
alter table releases           enable row level security;
alter table apps               enable row level security;
alter table app_events         enable row level security;
alter table keystores          enable row level security;
alter table products           enable row level security;

do $$
declare t text;
begin
  foreach t in array array['clients','team_members','publisher_accounts','releases','apps','app_events','keystores','products'] loop
    execute format(
      'create policy team_all on %I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;

-- ---------------------------------------------------------- keystores ----
insert into storage.buckets (id, name, public)
values ('jks', 'jks', false)
on conflict (id) do nothing;

create policy jks_team_all on storage.objects
  for all to authenticated
  using (bucket_id = 'jks')
  with check (bucket_id = 'jks');

-- ---------------------------------------------------- product lines ----
-- What the team sells (6amMart, StackFood …), each with its projects and a
-- logo. Edited under Settings → Product lines; the rows below are only the
-- starting set.
create table if not exists product_lines (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  logo_path  text,                      -- object in the public 'logos' bucket
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists product_line_projects (
  id           uuid primary key default gen_random_uuid(),
  line_id      uuid not null references product_lines (id) on delete cascade,
  project_name text not null unique,     -- matches products.project_name
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now()
);

create index if not exists product_line_projects_line_idx on product_line_projects (line_id);

drop trigger if exists product_lines_touch on product_lines;
create trigger product_lines_touch before update on product_lines
  for each row execute function touch_updated_at();

alter table product_lines         enable row level security;
alter table product_line_projects enable row level security;
drop policy if exists team_all on product_lines;
create policy team_all on product_lines for all to authenticated using (true) with check (true);
drop policy if exists team_all on product_line_projects;
create policy team_all on product_line_projects for all to authenticated using (true) with check (true);

-- ------------------------------------------------------------------ logos ---
insert into storage.buckets (id, name, public)
values ('logos', 'logos', true)
on conflict (id) do nothing;

drop policy if exists logos_team_write on storage.objects;
create policy logos_team_write on storage.objects
  for all to authenticated
  using (bucket_id = 'logos')
  with check (bucket_id = 'logos');

-- --------------------------------------------------------- starting data ---
insert into product_lines (name, sort_order) values
  ('6amMart', 0),
  ('StackFood', 1),
  ('DriveMond', 2),
  ('Demandium', 3)
on conflict (name) do nothing;

insert into product_line_projects (line_id, project_name, sort_order)
select l.id, v.project_name, v.sort_order
from (values
  ('6amMart',   '6amMart-User-App',       0),
  ('6amMart',   '6amMart-Store-App',      1),
  ('6amMart',   '6amMart-Delivery-App',   2),
  ('6amMart',   '6amMart-Serviceman-App', 3),
  ('StackFood', 'StackFood User',         0),
  ('StackFood', 'StackFood Store',        1),
  ('StackFood', 'StackFood Delivery',     2),
  ('DriveMond', 'DriveMond User',         0),
  ('DriveMond', 'DriveMond Driver',       1),
  ('Demandium', 'Demandium User',         0),
  ('Demandium', 'Demandium Provider',     1),
  ('Demandium', 'Demandium Serviceman',   2)
) as v(line, project_name, sort_order)
join product_lines l on l.name = v.line
on conflict (project_name) do nothing;
