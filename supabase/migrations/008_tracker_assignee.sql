-- ============================================================================
-- 008 — the public tracker shows who is working on a release
--
-- Adds the release owner's name and each app's assignee name to
-- tracker_client. Only the display name is shared — never email or login.
-- Everything else about 007 is unchanged.
--
-- Run this in the SQL editor.
-- ============================================================================

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

