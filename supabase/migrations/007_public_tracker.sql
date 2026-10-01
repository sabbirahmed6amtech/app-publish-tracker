-- ============================================================================
-- 007 — the public status tracker
--
-- /track lets anyone, without logging in, look a client up and see where its
-- apps stand. Anonymous visitors still cannot read any table (every policy is
-- for signed-in users only); instead they get exactly these two read-only
-- functions, which run with the owner's rights and return a fixed set of
-- safe fields:
--
--   shown:  client name and ticket, release versions and dates, each app's
--           name, project, store, status, build number, how long it has been
--           in that status, the store link once live, and status changes.
--   never:  keystores, passwords, store account names, notes, team members,
--           emails, or internal ids.
--
-- Search needs at least two characters and returns at most ten clients.
--
-- Run this in the SQL editor.
-- ============================================================================

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
          'apps', (
            select coalesce(jsonb_agg(jsonb_build_object(
                     'app_name',          a.app_name,
                     'project',           a.project_name,
                     'platform',          pa.platform,
                     'status',            a.status,
                     'build',             a.build_version,
                     'status_changed_at', a.status_changed_at,
                     'store_url',         case when a.status = 'production' then a.store_url end,
                     'line',              pl.name,
                     'logo_path',         pl.logo_path
                   ) order by pa.platform, a.sort_order), '[]'::jsonb)
            from apps a
            join publisher_accounts pa on pa.id = a.account_id
            left join product_line_projects plp on plp.project_name = a.project_name
            left join product_lines pl on pl.id = plp.line_id
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
