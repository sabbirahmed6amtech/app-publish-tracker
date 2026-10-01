-- ============================================================================
-- 009 — what Play Console needs to publish an app
--
-- The tracker can hand an app to the "Play Console Publisher" Chrome
-- extension, which fills the Play Console forms. These are the details it
-- fills in. Everything is optional here; the publish panel says what's missing.
--
--   per client  (the same for every app of theirs): policy and contact details
--   per app     (differs between user / vendor / driver apps): package name,
--               category, descriptions, and the App Review demo login
--
-- Like keystore passwords, the demo login is readable only by signed-in team
-- members (the existing policies) and is never part of the public tracker.
--
-- Run this in the SQL editor.
-- ============================================================================

alter table clients add column if not exists play_privacy_url        text;
alter table clients add column if not exists play_delete_account_url text;
alter table clients add column if not exists play_contact_email      text;
alter table clients add column if not exists play_listing_email      text;
alter table clients add column if not exists play_contact_phone      text;
alter table clients add column if not exists play_website            text;
alter table clients add column if not exists play_default_language   text;

alter table products add column if not exists package_name      text;  -- applicationId; can never change once published
alter table products add column if not exists play_category     text;
alter table products add column if not exists short_description text;  -- Play limit: 80 characters
alter table products add column if not exists long_description  text;  -- Play limit: 4000 characters
alter table products add column if not exists demo_instructions text;  -- the name shown on the App Review instruction
alter table products add column if not exists demo_login        text;
alter table products add column if not exists demo_password     text;
alter table products add column if not exists demo_details      text;
