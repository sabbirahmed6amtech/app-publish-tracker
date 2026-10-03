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
  -- Play Console details shared by every app of this client (see 009).
  play_privacy_url        text,
  play_delete_account_url text,
  play_contact_email      text,
  play_listing_email      text,
  play_contact_phone      text,
  play_website            text,
  play_default_language   text,
  -- App Store Connect details shared by its apps (see 010).
  store_support_url          text,
  store_marketing_url        text,
  review_contact_first_name  text,
  review_contact_last_name   text,
  review_contact_phone       text,
  review_contact_email       text,
  -- The client intake form (see 011): a private link's token; null = no link.
  intake_token               text unique,
  intake_submitted_at        timestamptz,
  -- What the client tells us through the intake form (see 012).
  business_name              text,
  tagline                    text,
  primary_market             text,
  service_area               text,
  business_model             text,
  future_modules             text,
  play_account_type          text,
  play_access_email          text,
  play_access_status         text not null default 'pending'
    check (play_access_status in ('pending', 'requested', 'granted')),
  apple_account_type         text,
  apple_access_email         text,
  apple_access_status        text not null default 'pending'
    check (apple_access_status in ('pending', 'requested', 'granted')),
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
  -- How the team gets in, from the client intake form (see 013):
  -- invite = the client added the team; login = they share the login.
  access_method  text check (access_method in ('invite', 'login')),
  access_email   text,
  login_password text,                      -- team-only, like keystore passwords
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
  -- What Play Console needs for this app (see 009). The demo login is for
  -- App Review and, like keystore passwords, is team-only.
  package_name      text,                      -- applicationId; never changes once published
  play_category     text,
  short_description text,                      -- Play limit: 80 characters
  long_description  text,                      -- Play limit: 4000 characters
  demo_instructions text,
  demo_login        text,
  demo_password     text,
  demo_details      text,
  -- App Store Connect (see 010). package_name holds the bundle ID.
  ios_sku                text,
  ios_subtitle           text,                 -- limit: 30 characters
  ios_keywords           text,                 -- limit: 100 characters
  ios_promo_text         text,                 -- limit: 170 characters
  ios_primary_category   text,
  ios_secondary_category text,
  ios_copyright          text,
  -- From the client intake form (see 012).
  publishing_countries   text,
  feature_graphic_url    text,
  screenshots_url        text,
  icon_url               text,                 -- link to the app icon (014)
  client_note            text,                 -- the client's note from the form (015)
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

-- --------------------------------------------------- public tracker ----
-- /track is open to anyone without logging in. Anonymous visitors can't read
-- any table; they get only these two read-only functions, which return a
-- fixed set of safe fields (no keystores, passwords, store account names,
-- notes or emails — people appear by display name only).
-- Clients matching a name, ticket or store listing name.
create or replace function public.tracker_search(q text)
returns table (ticket text, name text, apps text)
language sql
stable
security definer
set search_path = public
as $$
  with needle as (
    select trim(coalesce(q, '')) as raw,
           '%' || replace(replace(replace(trim(coalesce(q, '')), '\', '\\'), '%', '\%'), '_', '\_')
               || '%' as pat
  )
  select c.ticket,
         c.name,
         (select string_agg(distinct nullif(p.app_name, ''), ', ')
            from products p
           where p.client_id = c.id and not p.archived) as apps
  from clients c, needle n
  where length(n.raw) >= 2
    and not c.archived
    and (c.name ilike n.pat
         or c.ticket ilike n.pat
         or exists (select 1 from products p
                     where p.client_id = c.id and p.app_name ilike n.pat))
  order by (c.ticket = n.raw) desc, (c.name ilike n.raw || '%') desc, c.name
  limit 10;
$$;

-- Everything the tracker page shows for one client, as one JSON document.
-- Returns null when there is no such (active) client.
create or replace function public.tracker_client(p_ticket text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'ticket', c.ticket,
    'name',   c.name,
    'releases', (
      select coalesce(jsonb_agg(rel order by rel->>'started_on' desc, rel->>'version' desc), '[]'::jsonb)
      from (
        select jsonb_build_object(
          'version',     r.version,
          'title',       r.title,
          'started_on',  r.started_on,
          'released_on', r.released_on,
          'assignee',    (select m.name from team_members m where m.id = r.assigned_to),
          'apps', (
            select coalesce(jsonb_agg(jsonb_build_object(
                     'app_name',          a.app_name,
                     'project',           a.project_name,
                     'platform',          pa.platform,
                     'status',            a.status,
                     'build',             a.build_version,
                     'status_changed_at', a.status_changed_at,
                     'assignee',          m.name,
                     'store_url',         case when a.status = 'production' then a.store_url end,
                     'line',              pl.name,
                     'logo_path',         pl.logo_path
                   ) order by pa.platform, a.sort_order), '[]'::jsonb)
            from apps a
            join publisher_accounts pa on pa.id = a.account_id
            left join product_line_projects plp on plp.project_name = a.project_name
            left join product_lines pl on pl.id = plp.line_id
            left join team_members m on m.id = a.assigned_to
            where a.release_id = r.id
          )
        ) as rel
        from releases r
        where r.client_id = c.id
        order by r.started_on desc, r.version desc
        limit 12
      ) recent
    ),
    'activity', (
      select coalesce(jsonb_agg(ev order by ev->>'at' desc), '[]'::jsonb)
      from (
        select jsonb_build_object(
          'app',      coalesce(nullif(a.app_name, ''), a.project_name),
          'platform', pa.platform,
          'version',  r.version,
          'from',     e.from_status,
          'to',       e.to_status,
          'at',       e.created_at
        ) as ev
        from app_events e
        join apps a on a.id = e.app_id
        join releases r on r.id = a.release_id
        join publisher_accounts pa on pa.id = a.account_id
        where r.client_id = c.id and e.kind = 'status'
        order by e.created_at desc
        limit 15
      ) recent
    )
  )
  from clients c
  where c.ticket = trim(p_ticket) and not c.archived;
$$;

revoke all on function public.tracker_search(text) from public;
revoke all on function public.tracker_client(text) from public;
grant execute on function public.tracker_search(text) to anon, authenticated;
grant execute on function public.tracker_client(text) to anon, authenticated;

-- The client intake form (011): read and save through these only.
create or replace function public.intake_get(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'name',   c.name,
    'ticket', c.ticket,
    'submitted_at', c.intake_submitted_at,
    'client', jsonb_build_object(
      'play_privacy_url',          c.play_privacy_url,
      'play_delete_account_url',   c.play_delete_account_url,
      'play_contact_email',        c.play_contact_email,
      'play_listing_email',        c.play_listing_email,
      'play_contact_phone',        c.play_contact_phone,
      'play_website',              c.play_website,
      'play_default_language',     c.play_default_language,
      'store_support_url',         c.store_support_url,
      'store_marketing_url',       c.store_marketing_url,
      'review_contact_first_name', c.review_contact_first_name,
      'review_contact_last_name',  c.review_contact_last_name,
      'review_contact_phone',      c.review_contact_phone,
      'review_contact_email',      c.review_contact_email,
      'business_name',             c.business_name,
      'tagline',                   c.tagline,
      'primary_market',            c.primary_market,
      'service_area',              c.service_area,
      'business_model',            c.business_model,
      'future_modules',            c.future_modules,
      'play_account_type',         c.play_account_type,
      'play_access_email',         c.play_access_email,
      'play_access_status',        c.play_access_status,
      'apple_account_type',        c.apple_account_type,
      'apple_access_email',        c.apple_access_email,
      'apple_access_status',       c.apple_access_status
    ),
    'accounts', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id',                 a.id,
               'platform',           a.platform,
               'account_name',       a.account_name,
               'account_type',       a.account_type,
               'access_method',      a.access_method,
               'access_email',       a.access_email,
               -- Never the password itself — only whether one is saved.
               'has_login_password', coalesce(a.login_password, '') <> ''
             ) order by a.platform desc), '[]'::jsonb)
      from publisher_accounts a
      where a.client_id = c.id
    ),
    'apps', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id',                     p.id,
               'project_name',           p.project_name,
               'platform',               pa.platform,
               'app_name',               p.app_name,
               'package_name',           p.package_name,
               'play_category',          p.play_category,
               'short_description',      p.short_description,
               'long_description',       p.long_description,
               'demo_instructions',      p.demo_instructions,
               'demo_login',             p.demo_login,
               'has_demo_password',      coalesce(p.demo_password, '') <> '',
               'demo_details',           p.demo_details,
               'ios_subtitle',           p.ios_subtitle,
               'ios_keywords',           p.ios_keywords,
               'ios_promo_text',         p.ios_promo_text,
               'ios_primary_category',   p.ios_primary_category,
               'ios_secondary_category', p.ios_secondary_category,
               'ios_copyright',          p.ios_copyright,
               'publishing_countries',   p.publishing_countries,
               'feature_graphic_url',    p.feature_graphic_url,
               'screenshots_url',        p.screenshots_url,
               'icon_url',               p.icon_url,
               'client_note',            p.client_note,
               'line',                   pl.name,
               'logo_path',              pl.logo_path
             ) order by pa.platform desc, p.sort_order, p.project_name), '[]'::jsonb)
      from products p
      join publisher_accounts pa on pa.id = p.account_id
      left join product_line_projects plp on plp.project_name = p.project_name
      left join product_lines pl on pl.id = plp.line_id
      where p.client_id = c.id and not p.archived
    )
  )
  from clients c
  where length(coalesce(p_token, '')) >= 24
    and c.intake_token = p_token
    and not c.archived;
$$;

create or replace function public.intake_submit(p_token text, p_client jsonb, p_apps jsonb, p_accounts jsonb default '[]'::jsonb)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_client uuid;
  v_app    jsonb;
  v_acc    jsonb;
  -- A sent field's new value (blank means cleared); an unsent field keeps its own.
  -- Inlined below as: case when x ? 'f' then nullif(btrim(x->>'f'), '') else col end
begin
  if length(coalesce(p_token, '')) < 24 then
    raise exception 'This link is not valid.';
  end if;

  select id into v_client
    from clients
   where intake_token = p_token and not archived;
  if v_client is null then
    raise exception 'This link is no longer active. Ask the team for a new one.';
  end if;

  -- No single field needs more than Play's 4000-character description.
  if exists (select 1 from jsonb_each_text(coalesce(p_client, '{}'::jsonb)) where length(value) > 2000)
     or exists (select 1
                  from jsonb_array_elements(coalesce(p_apps, '[]'::jsonb)) a,
                       jsonb_each_text(a) f
                 where length(f.value) > 4000)
     or exists (select 1
                  from jsonb_array_elements(coalesce(p_accounts, '[]'::jsonb)) a,
                       jsonb_each_text(a) f
                 where length(f.value) > 500) then
    raise exception 'Some text is too long.';
  end if;

  p_client := coalesce(p_client, '{}'::jsonb);
  update clients set
    play_privacy_url          = case when p_client ? 'play_privacy_url'          then nullif(btrim(p_client->>'play_privacy_url'), '')          else play_privacy_url end,
    play_delete_account_url   = case when p_client ? 'play_delete_account_url'   then nullif(btrim(p_client->>'play_delete_account_url'), '')   else play_delete_account_url end,
    play_contact_email        = case when p_client ? 'play_contact_email'        then nullif(btrim(p_client->>'play_contact_email'), '')        else play_contact_email end,
    play_listing_email        = case when p_client ? 'play_listing_email'        then nullif(btrim(p_client->>'play_listing_email'), '')        else play_listing_email end,
    play_contact_phone        = case when p_client ? 'play_contact_phone'        then nullif(btrim(p_client->>'play_contact_phone'), '')        else play_contact_phone end,
    play_website              = case when p_client ? 'play_website'              then nullif(btrim(p_client->>'play_website'), '')              else play_website end,
    play_default_language     = case when p_client ? 'play_default_language'     then nullif(btrim(p_client->>'play_default_language'), '')     else play_default_language end,
    store_support_url         = case when p_client ? 'store_support_url'         then nullif(btrim(p_client->>'store_support_url'), '')         else store_support_url end,
    store_marketing_url       = case when p_client ? 'store_marketing_url'       then nullif(btrim(p_client->>'store_marketing_url'), '')       else store_marketing_url end,
    review_contact_first_name = case when p_client ? 'review_contact_first_name' then nullif(btrim(p_client->>'review_contact_first_name'), '') else review_contact_first_name end,
    review_contact_last_name  = case when p_client ? 'review_contact_last_name'  then nullif(btrim(p_client->>'review_contact_last_name'), '')  else review_contact_last_name end,
    review_contact_phone      = case when p_client ? 'review_contact_phone'      then nullif(btrim(p_client->>'review_contact_phone'), '')      else review_contact_phone end,
    review_contact_email      = case when p_client ? 'review_contact_email'      then nullif(btrim(p_client->>'review_contact_email'), '')      else review_contact_email end,
    business_name             = case when p_client ? 'business_name' then nullif(btrim(p_client->>'business_name'), '') else business_name end,
    tagline                   = case when p_client ? 'tagline' then nullif(btrim(p_client->>'tagline'), '') else tagline end,
    primary_market            = case when p_client ? 'primary_market' then nullif(btrim(p_client->>'primary_market'), '') else primary_market end,
    service_area              = case when p_client ? 'service_area' then nullif(btrim(p_client->>'service_area'), '') else service_area end,
    business_model            = case when p_client ? 'business_model' then nullif(btrim(p_client->>'business_model'), '') else business_model end,
    future_modules            = case when p_client ? 'future_modules' then nullif(btrim(p_client->>'future_modules'), '') else future_modules end,
    play_account_type         = case when p_client ? 'play_account_type' then nullif(btrim(p_client->>'play_account_type'), '') else play_account_type end,
    play_access_email         = case when p_client ? 'play_access_email' then nullif(btrim(p_client->>'play_access_email'), '') else play_access_email end,
    apple_account_type        = case when p_client ? 'apple_account_type' then nullif(btrim(p_client->>'apple_account_type'), '') else apple_account_type end,
    apple_access_email        = case when p_client ? 'apple_access_email' then nullif(btrim(p_client->>'apple_access_email'), '') else apple_access_email end,
    play_access_status        = case when p_client->>'play_access_status' in ('pending', 'requested', 'granted') then p_client->>'play_access_status' else play_access_status end,
    apple_access_status       = case when p_client->>'apple_access_status' in ('pending', 'requested', 'granted') then p_client->>'apple_access_status' else apple_access_status end,
    intake_submitted_at       = now()
  where id = v_client;

  for v_app in select * from jsonb_array_elements(coalesce(p_apps, '[]'::jsonb)) loop
    -- Only this client's own active apps.
    update products p set
      app_name               = case when v_app ? 'app_name'               then coalesce(btrim(v_app->>'app_name'), '')                    else app_name end,
      package_name           = case when v_app ? 'package_name'           then nullif(btrim(v_app->>'package_name'), '')           else package_name end,
      play_category          = case when v_app ? 'play_category'          then nullif(btrim(v_app->>'play_category'), '')          else play_category end,
      short_description      = case when v_app ? 'short_description'      then nullif(btrim(v_app->>'short_description'), '')      else short_description end,
      long_description       = case when v_app ? 'long_description'       then nullif(btrim(v_app->>'long_description'), '')       else long_description end,
      demo_instructions      = case when v_app ? 'demo_instructions'      then nullif(btrim(v_app->>'demo_instructions'), '')      else demo_instructions end,
      demo_login             = case when v_app ? 'demo_login'             then nullif(btrim(v_app->>'demo_login'), '')             else demo_login end,
      -- A blank password keeps the saved one; the form never shows it.
      demo_password          = case when coalesce(v_app->>'demo_password', '') <> '' then v_app->>'demo_password' else demo_password end,
      demo_details           = case when v_app ? 'demo_details'           then nullif(btrim(v_app->>'demo_details'), '')           else demo_details end,
      ios_subtitle           = case when v_app ? 'ios_subtitle'           then nullif(btrim(v_app->>'ios_subtitle'), '')           else ios_subtitle end,
      ios_keywords           = case when v_app ? 'ios_keywords'           then nullif(btrim(v_app->>'ios_keywords'), '')           else ios_keywords end,
      ios_promo_text         = case when v_app ? 'ios_promo_text'         then nullif(btrim(v_app->>'ios_promo_text'), '')         else ios_promo_text end,
      ios_primary_category   = case when v_app ? 'ios_primary_category'   then nullif(btrim(v_app->>'ios_primary_category'), '')   else ios_primary_category end,
      ios_secondary_category = case when v_app ? 'ios_secondary_category' then nullif(btrim(v_app->>'ios_secondary_category'), '') else ios_secondary_category end,
      publishing_countries   = case when v_app ? 'publishing_countries' then nullif(btrim(v_app->>'publishing_countries'), '') else publishing_countries end,
      feature_graphic_url    = case when v_app ? 'feature_graphic_url' then nullif(btrim(v_app->>'feature_graphic_url'), '') else feature_graphic_url end,
      screenshots_url        = case when v_app ? 'screenshots_url' then nullif(btrim(v_app->>'screenshots_url'), '') else screenshots_url end,
      icon_url               = case when v_app ? 'icon_url' then nullif(btrim(v_app->>'icon_url'), '') else icon_url end,
      client_note            = case when v_app ? 'client_note' then nullif(btrim(v_app->>'client_note'), '') else client_note end,
      ios_copyright          = case when v_app ? 'ios_copyright'          then nullif(btrim(v_app->>'ios_copyright'), '')          else ios_copyright end
    where p.id = (v_app->>'id')::uuid
      and p.client_id = v_client
      and not p.archived;
  end loop;

  -- The client's store accounts: name, type and how we get in.
  for v_acc in select * from jsonb_array_elements(coalesce(p_accounts, '[]'::jsonb)) loop
    update publisher_accounts a set
      account_name   = case when v_acc ? 'account_name' then coalesce(btrim(v_acc->>'account_name'), '') else account_name end,
      account_type   = case when v_acc->>'account_type' in ('organization', 'personal')
                            then (v_acc->>'account_type')::account_type else account_type end,
      access_method  = case when v_acc ? 'access_method'
                            then case when v_acc->>'access_method' in ('invite', 'login') then v_acc->>'access_method' end
                            else access_method end,
      access_email   = case when v_acc ? 'access_email' then nullif(btrim(v_acc->>'access_email'), '') else access_email end,
      -- A blank password keeps the saved one; the form never shows it.
      login_password = case when coalesce(v_acc->>'login_password', '') <> '' then v_acc->>'login_password' else login_password end
    where a.id = (v_acc->>'id')::uuid
      and a.client_id = v_client;
  end loop;
end;
$$;

revoke all on function public.intake_get(text) from public;
revoke all on function public.intake_submit(text, jsonb, jsonb, jsonb) from public;
grant execute on function public.intake_get(text) to anon, authenticated;
grant execute on function public.intake_submit(text, jsonb, jsonb, jsonb) to anon, authenticated;
