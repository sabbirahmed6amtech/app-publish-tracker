-- ============================================================================
-- 005 — a client's apps are permanent; submissions are per release
--
-- Until now an app (ZippyGo User on the App Store, say) was a new row in every
-- release, so its name, store account, keystore and store link were re-entered
-- or re-copied each release. Now:
--
--   client -> products   the client's permanent apps: name, store account,
--                        keystore, store link. Set up once.
--   release -> apps      one SUBMISSION of a product in that release: status,
--                        build, assignee, note.
--
-- apps keeps its project_name / app_name / account_id / keystore_id /
-- store_url columns, but they are now copied from the product by a trigger
-- and kept in sync when the product changes — edit them on the product.
--
-- Existing rows are grouped by (store account, project) into products; where
-- releases disagree, the most recent non-empty value wins.
--
-- A copy of apps is kept in backup.apps_20261001 (not exposed by the API).
--
-- Run this in the SQL editor.
-- ============================================================================

create schema if not exists backup;
create table if not exists backup.apps_20261001 as table public.apps;

create table if not exists products (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references clients (id) on delete cascade,
  account_id   uuid not null references publisher_accounts (id) on delete cascade,
  project_name text not null,                -- 6amMart-User-App, StackFood Store …
  app_name     text not null default '',     -- the store listing name
  keystore_id  uuid references keystores (id) on delete set null,
  store_url    text,
  note         text,
  sort_order   integer not null default 0,
  archived     boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (account_id, project_name)
);

create index if not exists products_client_idx on products (client_id);

drop trigger if exists products_touch on products;
create trigger products_touch before update on products
  for each row execute function touch_updated_at();

alter table products enable row level security;
drop policy if exists team_all on products;
create policy team_all on products for all to authenticated using (true) with check (true);

-- A release keeps the date it first went fully live; touching its apps later
-- (e.g. renaming a product) must not move it to today.
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
     set released_on = case when total > 0 and pending = 0
                            then coalesce(released_on, current_date) else null end
   where id = target;

  return null;
end $$ language plpgsql;

-- ------------------------------------------------------ carry existing apps --
insert into products (client_id, account_id, project_name, app_name, keystore_id, store_url, sort_order)
select pa.client_id,
       a.account_id,
       a.project_name,
       coalesce((array_agg(nullif(trim(a.app_name), '') order by r.started_on desc, r.version desc, a.updated_at desc)
                  filter (where nullif(trim(a.app_name), '') is not null))[1], ''),
       (array_agg(a.keystore_id order by r.started_on desc, r.version desc, a.updated_at desc)
          filter (where a.keystore_id is not null))[1],
       (array_agg(a.store_url order by r.started_on desc, r.version desc, a.updated_at desc)
          filter (where nullif(trim(a.store_url), '') is not null))[1],
       min(a.sort_order)
from apps a
join releases r on r.id = a.release_id
join publisher_accounts pa on pa.id = a.account_id
group by pa.client_id, a.account_id, a.project_name
on conflict (account_id, project_name) do nothing;

alter table apps add column if not exists product_id uuid references products (id) on delete cascade;

-- Linking must not mark every submission as updated today.
alter table apps disable trigger apps_touch;
update apps a
set product_id = p.id
from products p
where a.product_id is null
  and p.account_id = a.account_id
  and p.project_name = a.project_name;
alter table apps enable trigger apps_touch;

alter table apps alter column product_id set not null;
create index if not exists apps_product_idx on apps (product_id);

-- ------------------------------------------------------------- triggers ----
-- A submission always mirrors its product's identity.
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

drop trigger if exists apps_from_product on apps;
create trigger apps_from_product before insert or update on apps
  for each row execute function apps_from_product();

-- Editing a product updates every submission of it.
create or replace function products_sync_apps() returns trigger as $$
begin
  update apps set product_id = new.id
   where product_id = new.id
     and (account_id, project_name, app_name, keystore_id, store_url)
         is distinct from
         (new.account_id, new.project_name, new.app_name, new.keystore_id, new.store_url);
  return null;
end $$ language plpgsql;

drop trigger if exists products_sync_apps on products;
create trigger products_sync_apps after update on products
  for each row execute function products_sync_apps();

-- Bring every existing submission in line with its product, without marking
-- them all as updated today.
alter table apps disable trigger apps_touch;
update apps set product_id = product_id;
alter table apps enable trigger apps_touch;
