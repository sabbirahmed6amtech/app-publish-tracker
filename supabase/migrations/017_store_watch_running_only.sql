-- ============================================================================
-- 017 — Store Watch checks running apps only
--
-- Only apps whose latest submission isn't in Production are checked: once an
-- app is live and moved to Production, Store Watch is done with it. So the
-- daily pass over every app goes; one hourly check of the running apps stays.
-- (The function decides which apps are running; "Check now" in the app's
-- drawer still checks any one app on demand.)
--
-- Run this in the SQL editor.
-- ============================================================================

select cron.unschedule(jobid) from cron.job where jobname in ('store-watch-hourly', 'store-watch-daily');
select cron.schedule('store-watch-hourly', '7 * * * *', $$ select public.store_watch_run('running') $$);
