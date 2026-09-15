-- ============================================================================
-- 002 — assignment to real people
--
-- Replaces the free-text "worked by" / "assignee" fields with a foreign key
-- to team_members, which is kept in sync with Supabase Auth: everyone added
-- under Authentication -> Users shows up automatically. You can also add
-- members who have no login (someone who does the work but never signs in).
--
-- Run this in the SQL editor. It preserves existing assignments by creating
-- a member row for each name already in use.
-- ============================================================================

create table if not exists team_members (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid unique references auth.users (id) on delete set null,
  name       text not null,
  email      text,
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists team_members_touch on team_members;
create trigger team_members_touch before update on team_members
  for each row execute function touch_updated_at();

-- --------------------------------------------------- sync with auth.users --
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

-- everyone who already has a login
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

-- ------------------------------------------------------ carry assignments --
do $$
begin
  -- Preserve whatever names are already recorded, as login-less members.
  if exists (select 1 from information_schema.columns
             where table_name = 'releases' and column_name = 'worked_by') then
    insert into team_members (name)
    select distinct trim(worked_by) from releases
    where worked_by is not null and trim(worked_by) <> ''
      and not exists (select 1 from team_members m where lower(m.name) = lower(trim(releases.worked_by)));
  end if;

  if exists (select 1 from information_schema.columns
             where table_name = 'apps' and column_name = 'assignee') then
    insert into team_members (name)
    select distinct trim(assignee) from apps
    where assignee is not null and trim(assignee) <> ''
      and not exists (select 1 from team_members m where lower(m.name) = lower(trim(apps.assignee)));
  end if;
end $$;

alter table releases add column if not exists assigned_to uuid
  references team_members (id) on delete set null;
alter table apps     add column if not exists assigned_to uuid
  references team_members (id) on delete set null;

do $$
begin
  if exists (select 1 from information_schema.columns
             where table_name = 'releases' and column_name = 'worked_by') then
    update releases r set assigned_to = m.id
      from team_members m
     where lower(m.name) = lower(trim(r.worked_by)) and r.assigned_to is null;
    alter table releases drop column worked_by;
  end if;

  if exists (select 1 from information_schema.columns
             where table_name = 'apps' and column_name = 'assignee') then
    update apps a set assigned_to = m.id
      from team_members m
     where lower(m.name) = lower(trim(a.assignee)) and a.assigned_to is null;
    alter table apps drop column assignee;
  end if;
end $$;

create index if not exists releases_assigned_idx on releases (assigned_to);
create index if not exists apps_assigned_idx     on apps (assigned_to);

-- The status trigger recorded the old text column; point it at the new one.
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

-- ------------------------------------------------------------------- rls ---
alter table team_members enable row level security;
drop policy if exists team_all on team_members;
create policy team_all on team_members for all to authenticated using (true) with check (true);
