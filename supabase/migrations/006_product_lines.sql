-- ============================================================================
-- 006 — product lines live in the database
--
-- The product lines the team sells (6amMart, StackFood …) and the projects in
-- each were constants in the code. Now they're rows, edited under Settings →
-- Product lines, each with a logo shown wherever its apps appear.
--
-- A project belongs to at most one line; an app finds its line (and logo) by
-- its project name. Projects not in any line simply have no logo.
--
-- Logos sit in a public 'logos' bucket — they're brand marks, not secrets —
-- so pages can show them without signed links. Only signed-in users can
-- upload or change them.
--
-- The four lines that were in the code are added as starting data; edit or
-- remove them like any other.
--
-- Run this in the SQL editor.
-- ============================================================================

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
