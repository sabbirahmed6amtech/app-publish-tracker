-- ============================================================================
-- 010 — what App Store Connect needs to publish an app
--
-- The publisher extension can now fill App Store Connect as well as Play
-- Console. Everything is optional; the publish popup says what's missing.
--
--   per client (shared by its apps): support and marketing URLs, and the
--               person App Review contacts
--   per App Store app: SKU, subtitle, keywords, promotional text, categories
--               and copyright. The bundle ID reuses package_name, and the
--               description and demo login reuse the existing columns.
--
-- Registering the bundle ID on developer.apple.com stays a manual step.
--
-- Run this in the SQL editor.
-- ============================================================================

alter table clients add column if not exists store_support_url          text;
alter table clients add column if not exists store_marketing_url        text;
alter table clients add column if not exists review_contact_first_name  text;
alter table clients add column if not exists review_contact_last_name   text;
alter table clients add column if not exists review_contact_phone       text;
alter table clients add column if not exists review_contact_email       text;

alter table products add column if not exists ios_sku                text;
alter table products add column if not exists ios_subtitle           text;  -- limit: 30 characters
alter table products add column if not exists ios_keywords           text;  -- limit: 100 characters, comma-separated
alter table products add column if not exists ios_promo_text         text;  -- limit: 170 characters
alter table products add column if not exists ios_primary_category   text;
alter table products add column if not exists ios_secondary_category text;
alter table products add column if not exists ios_copyright          text;
