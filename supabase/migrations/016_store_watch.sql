-- ============================================================================
-- 016 — Store Watch: is each app live on its store, and which version?
--
-- A Supabase Edge Function (supabase/functions/store-watch) looks every app up
-- on its store's public pages — no store logins:
--
--   Google Play  play.google.com/store/apps/details?id=<package>
--                live = the page exists; version and "Updated on" from it
--   App Store    itunes.apple.com/lookup?bundleId=<bundle id>
--                live = a result; version, release date and link from it
--
-- and saves what it found on the app. The tracker then shows "Live on store"
-- when the store has the release's version and the app isn't in Production
-- yet — the developer moves it; nothing changes status on its own. The store
-- link is filled in the first time an app is seen live.
--
-- Schedule (pg_cron → pg_net → the function):
--   hourly  apps waiting on the store (In Review, Closed Testing)
--   daily   every app, to catch updates and removals made elsewhere
--
-- Only the scheduler (with the key below, kept in Vault) and signed-in team
-- members can run a check.
--
-- Run this in the SQL editor, after deploying the store-watch function.
-- ============================================================================

alter table products add column if not exists store_live       boolean;      -- null = never checked
alter table products add column if not exists store_version    text;         -- the version the store shows
alter table products add column if not exists store_updated_at timestamptz;  -- when the store says it last changed
alter table products add column if not exists store_checked_at timestamptz;
alter table products add column if not exists store_error      text;         -- why the last check couldn't tell

-- The key the scheduler sends to the function. Generated once, kept in Vault.
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'store_watch_key') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(24), 'hex'), 'store_watch_key');
  end if;
end $$;

-- The function compares the key it receives with this; only the service role may read it.
create or replace function public.store_watch_key()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'store_watch_key';
$$;
revoke all on function public.store_watch_key() from public, anon, authenticated;
grant execute on function public.store_watch_key() to service_role;

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

-- Calls the function with the key from Vault; `scope` is "waiting" or "all".
create or replace function public.store_watch_run(scope text)
returns bigint
language sql
security definer
set search_path = public, extensions
as $$
  select net.http_post(
    url := 'https://jwpsarpfscjdvaiwfnpw.supabase.co/functions/v1/store-watch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-store-watch-key', (select decrypted_secret from vault.decrypted_secrets where name = 'store_watch_key')
    ),
    body := jsonb_build_object('scope', scope),
    timeout_milliseconds := 140000
  );
$$;
revoke all on function public.store_watch_run(text) from public, anon, authenticated;

select cron.unschedule(jobid) from cron.job where jobname in ('store-watch-hourly', 'store-watch-daily');
select cron.schedule('store-watch-hourly', '7 * * * *', $$ select public.store_watch_run('waiting') $$);
select cron.schedule('store-watch-daily', '17 3 * * *', $$ select public.store_watch_run('all') $$);
