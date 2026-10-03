-- ============================================================================
-- Publish Tracker — sample data
--
-- Made-up clients, apps and releases so a fresh setup has something to show.
-- No real client data. Import it after database/schema.sql:
--   phpMyAdmin → the database → Import → choose this file → Import
--   or: mysql -u root publish_tracker < database/seed.sql
--
-- It empties the tables first, so it can be imported again at any time.
--
-- Sign in with either login — password: password123
--   sabbir@example.com   (Sabbir Ahmed)
--   rafi@example.com     (Rafi Hasan)
-- ============================================================================

SET NAMES utf8mb4;
SET time_zone = '+00:00';

-- ---------------------------------------------------------------- start clean
SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE app_events;
TRUNCATE TABLE apps;
TRUNCATE TABLE products;
TRUNCATE TABLE keystores;
TRUNCATE TABLE releases;
TRUNCATE TABLE publisher_accounts;
TRUNCATE TABLE clients;
TRUNCATE TABLE product_line_projects;
TRUNCATE TABLE product_lines;
TRUNCATE TABLE team_members;
TRUNCATE TABLE users;
SET FOREIGN_KEY_CHECKS = 1;

-- --------------------------------------------------------------- the team ----
-- Logins create their team member through a trigger; Nadia has no login.
INSERT INTO users (id, email, password_hash, name) VALUES
  ('00000000-0000-4000-8000-000000000001', 'sabbir@example.com',
   '$2b$10$kH5NwbLbZWv6h3OdxCFLaOyFHzJB1OGu8R2ClyvMhoOU5Tn/PJQiG', 'Sabbir Ahmed'),
  ('00000000-0000-4000-8000-000000000002', 'rafi@example.com',
   '$2b$10$kH5NwbLbZWv6h3OdxCFLaOyFHzJB1OGu8R2ClyvMhoOU5Tn/PJQiG', 'Rafi Hasan');

INSERT INTO team_members (name, email) VALUES ('Nadia Islam', 'nadia@example.com');

SET @sabbir = (SELECT id FROM team_members WHERE email = 'sabbir@example.com');
SET @rafi   = (SELECT id FROM team_members WHERE email = 'rafi@example.com');
SET @nadia  = (SELECT id FROM team_members WHERE email = 'nadia@example.com');

-- ---------------------------------------------------------- product lines ----
SET @line_mart = UUID();
SET @line_food = UUID();
INSERT INTO product_lines (id, name, sort_order) VALUES
  (@line_mart, '6amMart', 1),
  (@line_food, 'StackFood', 2);

INSERT INTO product_line_projects (line_id, project_name, sort_order) VALUES
  (@line_mart, '6amMart-User-App', 1),
  (@line_mart, '6amMart-Store-App', 2),
  (@line_mart, '6amMart-Delivery-App', 3),
  (@line_food, 'StackFood-User-App', 1),
  (@line_food, 'StackFood-Restaurant-App', 2);

-- --------------------------------------------------------------- clients ----

-- Acme Retail: both stores, store details filled, a client-form link.
SET @acme = UUID();
INSERT INTO clients (id, ticket, name, note,
  play_privacy_url, play_delete_account_url, play_contact_email, play_contact_phone,
  play_website, play_default_language, store_support_url,
  review_contact_first_name, review_contact_last_name, review_contact_phone, review_contact_email,
  intake_token, intake_submitted_at)
VALUES (@acme, '10234', 'Acme Retail', 'Grocery and delivery marketplace',
  'https://acme.example.com/privacy', 'https://acme.example.com/delete-account',
  'support@acme.example.com', '+1 555 010 0199', 'https://acme.example.com',
  'English (United States) – en-US', 'https://acme.example.com/support',
  'John', 'Doe', '+1 555 010 0199', 'support@acme.example.com',
  'sampleIntakeLinkAcme0123456789abcdef', '2026-09-28 10:15:00.000');

-- FoodZone: Play only, details still missing.
SET @food = UUID();
INSERT INTO clients (id, ticket, name) VALUES (@food, '10587', 'FoodZone');

-- QuickRide: App Store only.
SET @ride = UUID();
INSERT INTO clients (id, ticket, name, play_privacy_url, store_support_url,
  review_contact_first_name, review_contact_last_name, review_contact_phone, review_contact_email)
VALUES (@ride, '10911', 'QuickRide', 'https://quickride.example.com/privacy',
  'https://quickride.example.com/help', 'Maria', 'Lopez', '+44 20 7946 0958', 'apps@quickride.example.com');

-- ------------------------------------------------------- store accounts ----
SET @acme_play = UUID(); SET @acme_ios = UUID(); SET @food_play = UUID(); SET @ride_ios = UUID();
INSERT INTO publisher_accounts (id, client_id, platform, account_name, account_type, access_method, access_email, login_password) VALUES
  (@acme_play, @acme, 'play_store', 'Acme Retail Ltd',    'organization', 'invite', 'frontend.6amtech@gmail.com', NULL),
  (@acme_ios,  @acme, 'app_store',  'Acme Retail Ltd',    'organization', 'invite', 'frontend.6amtech@gmail.com', NULL),
  (@food_play, @food, 'play_store', 'FoodZone Foods',     'organization', NULL,     NULL, NULL),
  (@ride_ios,  @ride, 'app_store',  'Maria Lopez',        'personal',     'login',  'maria@quickride.example.com', 'sample-not-a-real-password');

-- ------------------------------------------------------------- keystores ----
SET @acme_key = UUID();
INSERT INTO keystores (id, client_id, name, details) VALUES
  (@acme_key, @acme, 'Acme release key',
   'storePassword=sample-store-pass\nkeyPassword=sample-key-pass\nkeyAlias=acme\nstoreFile=acme-release.jks');

-- -------------------------------------------------------------- the apps ----
-- Acme: the 6amMart set on both stores.
SET @a_user_play = UUID(); SET @a_store_play = UUID(); SET @a_del_play = UUID();
SET @a_user_ios  = UUID(); SET @a_store_ios  = UUID(); SET @a_del_ios  = UUID();
INSERT INTO products (id, client_id, account_id, project_name, app_name, keystore_id, sort_order,
  package_name, play_category, short_description, long_description, demo_login, demo_password,
  ios_primary_category, ios_keywords, store_url, store_live, store_version, store_updated_at, store_checked_at)
VALUES
  (@a_user_play,  @acme, @acme_play, '6amMart-User-App',     'Acme Shop',     @acme_key, 1,
   'com.acme.shop', 'Shopping', 'Groceries and daily essentials, delivered fast.',
   'Shop groceries, food and essentials from local stores and get them delivered.', 'demo@acme.example.com', 'demo1234',
   NULL, NULL, 'https://play.google.com/store/apps/details?id=com.acme.shop', TRUE, '1.1.0', '2026-10-02 08:30:00.000', '2026-10-03 09:07:00.000'),
  (@a_store_play, @acme, @acme_play, '6amMart-Store-App',    'Acme Seller',   @acme_key, 2,
   'com.acme.seller', 'Business', 'Manage your store and orders on the go.', NULL, NULL, NULL,
   NULL, NULL, 'https://play.google.com/store/apps/details?id=com.acme.seller', TRUE, '1.0.0', '2026-08-20 11:00:00.000', '2026-10-03 09:07:00.000'),
  (@a_del_play,   @acme, @acme_play, '6amMart-Delivery-App', 'Acme Rider',    @acme_key, 3,
   'com.acme.rider', 'Business', 'Deliver orders and track your earnings.', NULL, NULL, NULL,
   NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (@a_user_ios,   @acme, @acme_ios,  '6amMart-User-App',     'Acme Shop',     NULL, 1,
   'com.acme.shop.ios', NULL, NULL, 'Shop groceries, food and essentials from local stores.', 'demo@acme.example.com', 'demo1234',
   'Shopping', 'grocery,delivery,shop', NULL, NULL, NULL, NULL, NULL),
  (@a_store_ios,  @acme, @acme_ios,  '6amMart-Store-App',    'Acme Seller',   NULL, 2,
   'com.acme.seller.ios', NULL, NULL, NULL, NULL, NULL, 'Business', NULL, NULL, NULL, NULL, NULL, NULL),
  (@a_del_ios,    @acme, @acme_ios,  '6amMart-Delivery-App', 'Acme Rider',    NULL, 3,
   'com.acme.rider.ios', NULL, NULL, NULL, NULL, NULL, 'Business', NULL, NULL, NULL, NULL, NULL, NULL);

-- FoodZone: two StackFood apps on Play.
SET @f_user = UUID(); SET @f_rest = UUID();
INSERT INTO products (id, client_id, account_id, project_name, app_name, sort_order, package_name) VALUES
  (@f_user, @food, @food_play, 'StackFood-User-App',       'FoodZone',          1, 'com.foodzone.app'),
  (@f_rest, @food, @food_play, 'StackFood-Restaurant-App', 'FoodZone Partner',  2, NULL);

-- QuickRide: two apps on the App Store.
SET @r_rider = UUID(); SET @r_driver = UUID();
INSERT INTO products (id, client_id, account_id, project_name, app_name, sort_order, package_name) VALUES
  (@r_rider,  @ride, @ride_ios, 'QuickRide-User-App',   'QuickRide',        1, 'com.quickride.user'),
  (@r_driver, @ride, @ride_ios, 'QuickRide-Driver-App', 'QuickRide Driver', 2, NULL);

-- -------------------------------------------------------------- releases ----
SET @acme_100 = UUID(); SET @acme_110 = UUID(); SET @food_200 = UUID(); SET @ride_100 = UUID();
INSERT INTO releases (id, client_id, version, title, assigned_to, started_on) VALUES
  (@acme_100, @acme, '1.0.0', 'First launch',   @sabbir, '2026-08-01'),
  (@acme_110, @acme, '1.1.0', 'Rental module',  @sabbir, '2026-09-15'),
  (@food_200, @food, '2.0.0', NULL,             @rafi,   '2026-09-20'),
  (@ride_100, @ride, '1.0.0', 'First launch',   @nadia,  '2026-09-25');

-- ------------------------------------------------------- the submissions ----
-- Added as Ongoing, then moved on below — the triggers fill in each app's
-- details, write its history and set a release's live date.
INSERT INTO apps (release_id, product_id, account_id, project_name, assigned_to, build_version, flutter_version) VALUES
  -- Acme 1.0.0: everything live
  (@acme_100, @a_user_play,  '', '', @sabbir, '1.0.0+1', '3.22.2'),
  (@acme_100, @a_store_play, '', '', @sabbir, '1.0.0+1', '3.22.2'),
  (@acme_100, @a_user_ios,   '', '', @rafi,   '1.0.0+1', '3.22.2'),
  -- Acme 1.1.0: in progress, a mix of statuses
  (@acme_110, @a_user_play,  '', '', @sabbir, '1.1.0+2', '3.24.0'),
  (@acme_110, @a_store_play, '', '', @sabbir, '1.1.0+2', '3.24.0'),
  (@acme_110, @a_del_play,   '', '', @rafi,   '1.1.0+2', '3.24.0'),
  (@acme_110, @a_user_ios,   '', '', @rafi,   '1.1.0+2', '3.24.0'),
  (@acme_110, @a_store_ios,  '', '', NULL,    '1.1.0+2', '3.24.0'),
  (@acme_110, @a_del_ios,    '', '', NULL,    NULL,      NULL),
  -- FoodZone 2.0.0
  (@food_200, @f_user,       '', '', @rafi,   '2.0.0+5', '3.24.0'),
  (@food_200, @f_rest,       '', '', @rafi,   '2.0.0+5', '3.24.0'),
  -- QuickRide 1.0.0
  (@ride_100, @r_rider,      '', '', @nadia,  '1.0.0+1', '3.24.0'),
  (@ride_100, @r_driver,     '', '', @nadia,  NULL,      NULL);

-- Acme 1.0.0 went through review and is live.
UPDATE apps SET status = 'in_review'  WHERE release_id = @acme_100;
UPDATE apps SET status = 'production' WHERE release_id = @acme_100;

-- Acme 1.1.0: the shop update is live on Play (Store Watch saw 1.1.0),
-- the rest are spread across the board.
UPDATE apps SET status = 'in_review'      WHERE release_id = @acme_110 AND product_id IN (@a_user_play, @a_store_play, @a_user_ios);
UPDATE apps SET status = 'production'     WHERE release_id = @acme_110 AND product_id = @a_store_play;
UPDATE apps SET status = 'closed_testing' WHERE release_id = @acme_110 AND product_id = @a_del_play;
UPDATE apps SET status = 'on_hold', note = 'Waiting for the client to accept the App Store invite'
                                          WHERE release_id = @acme_110 AND product_id = @a_store_ios;

-- FoodZone: one rejected, one waiting on review.
UPDATE apps SET status = 'in_review' WHERE release_id = @food_200;
UPDATE apps SET status = 'rejected', note = 'Rejected: missing account-deletion link'
                                     WHERE release_id = @food_200 AND product_id = @f_user;

-- QuickRide: first build sent for review.
UPDATE apps SET status = 'in_review' WHERE release_id = @ride_100 AND product_id = @r_rider;

-- A note in the history, like the team leaves.
INSERT INTO app_events (app_id, kind, message, actor)
SELECT id, 'note', 'Client asked to keep the old icon for this release.', 'Sabbir Ahmed'
  FROM apps WHERE release_id = @acme_110 AND product_id = @a_user_play;
