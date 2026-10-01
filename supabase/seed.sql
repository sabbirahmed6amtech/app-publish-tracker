-- ============================================================================
-- OPTIONAL — the old follow-up sheet, restated as releases.
--
-- You chose to start fresh, so you do NOT need to run this. It is kept only
-- so the sheet's contents are recoverable: each client becomes one release,
-- versioned from whatever the sheet's Note column said ("App version 3.9"),
-- defaulting to 1.0.0 where it said nothing.
--
-- Run AFTER schema.sql if you want it. Re-running is a no-op.
-- ============================================================================

insert into clients (ticket, name) values
  ('52999', 'Shakeel'),
  ('49285', 'Stan'),
  ('50811', 'Brian'),
  ('53325', 'Rahal'),
  ('53263', 'Anelissa'),
  ('48519', 'Sagnik'),
  ('52242', 'Manuel Estevez camilo'),
  ('52888', 'Social Media Palace'),
  ('53372', 'Yusuf destek'),
  ('53371', 'Fulgence'),
  ('53459', 'Timeterest (Super app)')
on conflict (ticket) do nothing;

insert into publisher_accounts (client_id, platform, account_name, account_type)
select c.id, v.platform::platform, v.account_name, v.account_type::account_type
from (values
  ('52999', 'play_store', 'TOOLS EMPIRE LIMITED',                                   'organization'),
  ('49285', 'app_store',  'Gogo Technologies Limited',                              'organization'),
  ('50811', 'app_store',  'Nailer Business L.L.C.',                                 'organization'),
  ('53325', 'app_store',  'Abass rahal',                                            'personal'),
  ('53263', 'app_store',  'Translantic (Pty) Ltd',                                  'organization'),
  ('48519', 'app_store',  'Bengal Crafts Online Private Limited',                   'organization'),
  ('52242', 'play_store', 'HOLAAPP TECHNOLOGIES',                                   'organization'),
  ('52888', 'app_store',  'Social Media Palace',                                    'organization'),
  ('53372', 'app_store',  'MUHAMMED MUSTAFA TARIK CENAN',                           'personal'),
  ('53372', 'play_store', 'YEMEKBAK',                                               'personal'),
  ('53371', 'play_store', 'VERBES',                                                 'organization'),
  ('53371', 'app_store',  'SOCIETE IVOIRIENNE DE NEGOCE TRAVAUX ET MULTI-SERVICES', 'organization'),
  ('53459', 'app_store',  'Timeterest Limited',                                     'organization')
) as v(ticket, platform, account_name, account_type)
join clients c on c.ticket = v.ticket
on conflict (client_id, platform) do nothing;

insert into releases (client_id, version, title)
select c.id, v.version, nullif(v.title, '')
from (values
  ('52999', '3.9',   ''),
  ('49285', '1.0.0', ''),
  ('50811', '8.4',   ''),
  ('53325', '1.0.0', ''),
  ('53263', '1.0.0', ''),
  ('48519', '1.0.0', ''),
  ('52242', '3.0',   ''),
  ('52888', '1.0.0', ''),
  ('53372', '1.0.0', ''),
  ('53371', '4.0',   'With rental'),
  ('53459', '4.1',   '')
) as v(ticket, version, title)
join clients c on c.ticket = v.ticket
on conflict (client_id, version) do nothing;

drop table if exists seed_apps;
create temp table seed_apps as
select * from (values
  ('52999','play_store','6amMart-User-App',      'BOOKVEY',                    'in_review',      '1.0.0+4','','','','',0),
  ('52999','play_store','6amMart-Store-App',     'BOOKVEY DELIVERY PARTNERS',  'in_review',      '1.0.0+4','','','','',1),
  ('52999','play_store','6amMart-Delivery-App',  'BOOKVEY STORES',             'in_review',      '1.0.0+4','','','','',2),
  ('49285','app_store', 'DriveMond User',        'Gogo Member',                'production',     '','','','','',0),
  ('49285','app_store', 'DriveMond Driver',      'Gogo Captain',               'production',     '','','','','',1),
  ('50811','app_store', 'StackFood User',        'ErrandBooker',               'rejected',       '','','','','',0),
  ('50811','app_store', 'StackFood Delivery',    'ErrandBooker Driver',        'production',     '','','','','',1),
  ('50811','app_store', 'StackFood Store',       'ErrandBooker Partner',       'production',     '','','','','',2),
  ('53325','app_store', '6amMart-User-App',      'Cousins Group',              'production',     '','','','','',0),
  ('53325','app_store', '6amMart-Store-App',     'Cousins Driver',             'production',     '','','','','',1),
  ('53325','app_store', '6amMart-Delivery-App',  'Cousins Partner',            'production',     '','','','','',2),
  ('53325','app_store', 'Playground booking app','KickZone',                   'rejected',       '','','','','Client removed access',3),
  ('53263','app_store', '6amMart-User-App',      'ZippyGo',                    'production',     '','','N/A','https://apps.apple.com/us/app/zippygo/id6795507923','',0),
  ('53263','app_store', '6amMart-Store-App',     'ZippyGo Store',              'production',     '','','N/A','https://apps.apple.com/us/app/zippygo-store/id6795487499','',1),
  ('53263','app_store', '6amMart-Delivery-App',  'ZippyGo Delivery',           'production',     '','','N/A','https://apps.apple.com/us/app/zippygo-delivery/id6795487136','',2),
  ('48519','app_store', 'Demandium User',        'Fixya',                      'production',     '1.0.0','','N/A','https://apps.apple.com/us/app/fixya/id6795039143','',0),
  ('48519','app_store', 'Demandium Serviceman',  'Fixya Crew',                 'production',     '1.0.0','','N/A','https://apps.apple.com/us/app/fixya-crew/id6795077126','',1),
  ('48519','app_store', 'Demandium Provider',    'Fixya Provider',             'production',     '1.0.0','','N/A','https://apps.apple.com/us/app/fixya-provider/id6795039454','',2),
  ('52242','play_store','6amMart-User-App',      'HolaApp Delivery y Compras', 'production',     '','','','','',0),
  ('52242','play_store','6amMart-Store-App',     'HolaApp Delivery y Compras', 'in_review',      '','','','','',1),
  ('52242','play_store','6amMart-Delivery-App',  'HolaApp Repartidores/Riders','production',     '','','','','',2),
  ('52888','app_store', 'DriveMond User',        '',                           'production',     '','','','','',0),
  ('52888','app_store', 'DriveMond Driver',      '',                           'in_review',      '','','','','Delivery app dependency',1),
  ('53372','app_store', 'StackFood User',        'Yemekbak',                   'production',     '','3.44.2','','','',0),
  ('53372','app_store', 'StackFood Delivery',    'Yemekbak Kurye',             'production',     '','','','','',1),
  ('53372','app_store', 'StackFood Store',       'Yemekbak Restoran',          'production',     '','','','','',2),
  ('53372','play_store','StackFood User',        'Yemekbak',                   'closed_testing', '','','','','',3),
  ('53372','play_store','StackFood Delivery',    'Yemekbak Kurye',             'closed_testing', '','','','','',4),
  ('53372','play_store','StackFood Store',       'Yemekbak Restoran',          'closed_testing', '','','','','',5),
  ('53371','play_store','6amMart-User-App',      'AfriMart',                   'production',     '','','','','',0),
  ('53371','play_store','6amMart-Store-App',     'AfriShop',                   'production',     '','','','','',1),
  ('53371','play_store','6amMart-Delivery-App',  'AfriDel',                    'production',     '','','','','',2),
  ('53371','app_store', '6amMart-User-App',      'AfriMart',                   'rejected',       '','','','','Login issue',3),
  ('53371','app_store', '6amMart-Store-App',     'AfriShop',                   'production',     '','','','','',4),
  ('53371','app_store', '6amMart-Delivery-App',  'AfriDel',                    'production',     '','','','','',5),
  ('53459','app_store', '6amMart-User-App',      'Martconnection',             'ongoing',        '','','','','',0),
  ('53459','app_store', '6amMart-Delivery-App',  'Martconnection Delivery',    'ongoing',        '','','','','',1),
  ('53459','app_store', '6amMart-Serviceman-App','Martconnection ServiceMan',  'ongoing',        '','','','','',2),
  ('53459','app_store', '6amMart-Store-App',     'Martconnection Store',       'ongoing',        '','','','','',3)
) as v(ticket, platform, project_name, app_name, status, build_version,
       flutter_version, jks, store_url, note, sort_order);

-- The client's permanent apps …
insert into products (client_id, account_id, project_name, app_name, store_url, sort_order)
select c.id, pa.id, v.project_name, v.app_name, nullif(v.store_url, ''), v.sort_order
from seed_apps v
join clients c             on c.ticket = v.ticket
join publisher_accounts pa on pa.client_id = c.id and pa.platform = v.platform::platform
on conflict (account_id, project_name) do nothing;

-- … and their submissions in the sheet's release.
insert into apps (release_id, product_id, status, build_version, flutter_version, jks, note,
                  sort_order)
select rel.id, p.id, v.status::app_status,
       nullif(v.build_version, ''), nullif(v.flutter_version, ''), nullif(v.jks, ''),
       nullif(v.note, ''), v.sort_order
from seed_apps v
join clients c             on c.ticket = v.ticket
join publisher_accounts pa on pa.client_id = c.id and pa.platform = v.platform::platform
join products p            on p.account_id = pa.id and p.project_name = v.project_name
join releases rel          on rel.client_id = c.id
where not exists (
  select 1 from apps a where a.release_id = rel.id and a.product_id = p.id
);
