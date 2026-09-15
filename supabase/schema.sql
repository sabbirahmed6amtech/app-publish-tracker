-- ============================================================================
-- App Publish Tracker — schema v2 (releases)
--
-- A client is published in rounds. Each round is a RELEASE with its own
-- version, its own dates, and the person who did the work:
--
--   client  ->  publisher_account   (stable: the store accounts they own)
--           ->  release             (one publication round, versioned)
--                 -> app            (what was submitted, to which account)
--
-- Run this in the Supabase SQL editor. It DROPS the v1 tables first, so
-- anything currently stored is discarded.
-- ============================================================================

create extension if not exists "pgcrypto";

drop table if exists app_events         cascade;
drop table if exists team_members       cascade;
drop table if exists apps               cascade;
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

-- One publication round for one client.
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

-- What was actually submitted in a release, and to which store account.
create table apps (
  id                uuid primary key default gen_random_uuid(),
  release_id        uuid not null references releases (id) on delete cascade,
  account_id        uuid not null references publisher_accounts (id) on delete cascade,
  project_name      text not null,              -- 6amMart-User-App, StackFood Store …
  app_name          text not null default '',   -- BOOKVEY, ZippyGo Store …
  status            app_status not null default 'ongoing',
  assigned_to       uuid references team_members (id) on delete set null,
  build_version     text,                       -- 1.0.0+4
  flutter_version   text,
  jks               text,
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

  update releases
     set released_on = case when total > 0 and pending = 0 then current_date else null end
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

do $$
declare t text;
begin
  foreach t in array array['clients','team_members','publisher_accounts','releases','apps','app_events'] loop
    execute format(
      'create policy team_all on %I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;
