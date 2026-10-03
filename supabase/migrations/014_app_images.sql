-- ============================================================================
-- 014 — app images from the intake form
--
-- The intake form has an Images tab: per app, links (usually Google Drive) to
-- the app icon, the screenshots and, for Play, the feature graphic. The
-- screenshot and feature graphic columns came with 012; this adds the icon
-- and lets intake_get / intake_submit read and save it.
--
-- Run this in the SQL editor.
-- ============================================================================

alter table products add column if not exists icon_url text;

create or replace function public.intake_get(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'name',   c.name,
    'ticket', c.ticket,
    'submitted_at', c.intake_submitted_at,
    'client', jsonb_build_object(
      'play_privacy_url',          c.play_privacy_url,
      'play_delete_account_url',   c.play_delete_account_url,
      'play_contact_email',        c.play_contact_email,
      'play_listing_email',        c.play_listing_email,
      'play_contact_phone',        c.play_contact_phone,
      'play_website',              c.play_website,
      'play_default_language',     c.play_default_language,
      'store_support_url',         c.store_support_url,
      'store_marketing_url',       c.store_marketing_url,
      'review_contact_first_name', c.review_contact_first_name,
      'review_contact_last_name',  c.review_contact_last_name,
      'review_contact_phone',      c.review_contact_phone,
      'review_contact_email',      c.review_contact_email,
      'business_name',             c.business_name,
      'tagline',                   c.tagline,
      'primary_market',            c.primary_market,
      'service_area',              c.service_area,
      'business_model',            c.business_model,
      'future_modules',            c.future_modules,
      'play_account_type',         c.play_account_type,
      'play_access_email',         c.play_access_email,
      'play_access_status',        c.play_access_status,
      'apple_account_type',        c.apple_account_type,
      'apple_access_email',        c.apple_access_email,
      'apple_access_status',       c.apple_access_status
    ),
    'accounts', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id',                 a.id,
               'platform',           a.platform,
               'account_name',       a.account_name,
               'account_type',       a.account_type,
               'access_method',      a.access_method,
               'access_email',       a.access_email,
               -- Never the password itself — only whether one is saved.
               'has_login_password', coalesce(a.login_password, '') <> ''
             ) order by a.platform desc), '[]'::jsonb)
      from publisher_accounts a
      where a.client_id = c.id
    ),
    'apps', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id',                     p.id,
               'project_name',           p.project_name,
               'platform',               pa.platform,
               'app_name',               p.app_name,
               'package_name',           p.package_name,
               'play_category',          p.play_category,
               'short_description',      p.short_description,
               'long_description',       p.long_description,
               'demo_instructions',      p.demo_instructions,
               'demo_login',             p.demo_login,
               'has_demo_password',      coalesce(p.demo_password, '') <> '',
               'demo_details',           p.demo_details,
               'ios_subtitle',           p.ios_subtitle,
               'ios_keywords',           p.ios_keywords,
               'ios_promo_text',         p.ios_promo_text,
               'ios_primary_category',   p.ios_primary_category,
               'ios_secondary_category', p.ios_secondary_category,
               'ios_copyright',          p.ios_copyright,
               'publishing_countries',   p.publishing_countries,
               'feature_graphic_url',    p.feature_graphic_url,
               'screenshots_url',        p.screenshots_url,
               'icon_url',               p.icon_url,
               'line',                   pl.name,
               'logo_path',              pl.logo_path
             ) order by pa.platform desc, p.sort_order, p.project_name), '[]'::jsonb)
      from products p
      join publisher_accounts pa on pa.id = p.account_id
      left join product_line_projects plp on plp.project_name = p.project_name
      left join product_lines pl on pl.id = plp.line_id
      where p.client_id = c.id and not p.archived
    )
  )
  from clients c
  where length(coalesce(p_token, '')) >= 24
    and c.intake_token = p_token
    and not c.archived;
$$;

create or replace function public.intake_submit(p_token text, p_client jsonb, p_apps jsonb, p_accounts jsonb default '[]'::jsonb)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_client uuid;
  v_app    jsonb;
  v_acc    jsonb;
  -- A sent field's new value (blank means cleared); an unsent field keeps its own.
  -- Inlined below as: case when x ? 'f' then nullif(btrim(x->>'f'), '') else col end
begin
  if length(coalesce(p_token, '')) < 24 then
    raise exception 'This link is not valid.';
  end if;

  select id into v_client
    from clients
   where intake_token = p_token and not archived;
  if v_client is null then
    raise exception 'This link is no longer active. Ask the team for a new one.';
  end if;

  -- No single field needs more than Play's 4000-character description.
  if exists (select 1 from jsonb_each_text(coalesce(p_client, '{}'::jsonb)) where length(value) > 2000)
     or exists (select 1
                  from jsonb_array_elements(coalesce(p_apps, '[]'::jsonb)) a,
                       jsonb_each_text(a) f
                 where length(f.value) > 4000)
     or exists (select 1
                  from jsonb_array_elements(coalesce(p_accounts, '[]'::jsonb)) a,
                       jsonb_each_text(a) f
                 where length(f.value) > 500) then
    raise exception 'Some text is too long.';
  end if;

  p_client := coalesce(p_client, '{}'::jsonb);
  update clients set
    play_privacy_url          = case when p_client ? 'play_privacy_url'          then nullif(btrim(p_client->>'play_privacy_url'), '')          else play_privacy_url end,
    play_delete_account_url   = case when p_client ? 'play_delete_account_url'   then nullif(btrim(p_client->>'play_delete_account_url'), '')   else play_delete_account_url end,
    play_contact_email        = case when p_client ? 'play_contact_email'        then nullif(btrim(p_client->>'play_contact_email'), '')        else play_contact_email end,
    play_listing_email        = case when p_client ? 'play_listing_email'        then nullif(btrim(p_client->>'play_listing_email'), '')        else play_listing_email end,
    play_contact_phone        = case when p_client ? 'play_contact_phone'        then nullif(btrim(p_client->>'play_contact_phone'), '')        else play_contact_phone end,
    play_website              = case when p_client ? 'play_website'              then nullif(btrim(p_client->>'play_website'), '')              else play_website end,
    play_default_language     = case when p_client ? 'play_default_language'     then nullif(btrim(p_client->>'play_default_language'), '')     else play_default_language end,
    store_support_url         = case when p_client ? 'store_support_url'         then nullif(btrim(p_client->>'store_support_url'), '')         else store_support_url end,
    store_marketing_url       = case when p_client ? 'store_marketing_url'       then nullif(btrim(p_client->>'store_marketing_url'), '')       else store_marketing_url end,
    review_contact_first_name = case when p_client ? 'review_contact_first_name' then nullif(btrim(p_client->>'review_contact_first_name'), '') else review_contact_first_name end,
    review_contact_last_name  = case when p_client ? 'review_contact_last_name'  then nullif(btrim(p_client->>'review_contact_last_name'), '')  else review_contact_last_name end,
    review_contact_phone      = case when p_client ? 'review_contact_phone'      then nullif(btrim(p_client->>'review_contact_phone'), '')      else review_contact_phone end,
    review_contact_email      = case when p_client ? 'review_contact_email'      then nullif(btrim(p_client->>'review_contact_email'), '')      else review_contact_email end,
    business_name             = case when p_client ? 'business_name' then nullif(btrim(p_client->>'business_name'), '') else business_name end,
    tagline                   = case when p_client ? 'tagline' then nullif(btrim(p_client->>'tagline'), '') else tagline end,
    primary_market            = case when p_client ? 'primary_market' then nullif(btrim(p_client->>'primary_market'), '') else primary_market end,
    service_area              = case when p_client ? 'service_area' then nullif(btrim(p_client->>'service_area'), '') else service_area end,
    business_model            = case when p_client ? 'business_model' then nullif(btrim(p_client->>'business_model'), '') else business_model end,
    future_modules            = case when p_client ? 'future_modules' then nullif(btrim(p_client->>'future_modules'), '') else future_modules end,
    play_account_type         = case when p_client ? 'play_account_type' then nullif(btrim(p_client->>'play_account_type'), '') else play_account_type end,
    play_access_email         = case when p_client ? 'play_access_email' then nullif(btrim(p_client->>'play_access_email'), '') else play_access_email end,
    apple_account_type        = case when p_client ? 'apple_account_type' then nullif(btrim(p_client->>'apple_account_type'), '') else apple_account_type end,
    apple_access_email        = case when p_client ? 'apple_access_email' then nullif(btrim(p_client->>'apple_access_email'), '') else apple_access_email end,
    play_access_status        = case when p_client->>'play_access_status' in ('pending', 'requested', 'granted') then p_client->>'play_access_status' else play_access_status end,
    apple_access_status       = case when p_client->>'apple_access_status' in ('pending', 'requested', 'granted') then p_client->>'apple_access_status' else apple_access_status end,
    intake_submitted_at       = now()
  where id = v_client;

  for v_app in select * from jsonb_array_elements(coalesce(p_apps, '[]'::jsonb)) loop
    -- Only this client's own active apps.
    update products p set
      app_name               = case when v_app ? 'app_name'               then coalesce(btrim(v_app->>'app_name'), '')                    else app_name end,
      package_name           = case when v_app ? 'package_name'           then nullif(btrim(v_app->>'package_name'), '')           else package_name end,
      play_category          = case when v_app ? 'play_category'          then nullif(btrim(v_app->>'play_category'), '')          else play_category end,
      short_description      = case when v_app ? 'short_description'      then nullif(btrim(v_app->>'short_description'), '')      else short_description end,
      long_description       = case when v_app ? 'long_description'       then nullif(btrim(v_app->>'long_description'), '')       else long_description end,
      demo_instructions      = case when v_app ? 'demo_instructions'      then nullif(btrim(v_app->>'demo_instructions'), '')      else demo_instructions end,
      demo_login             = case when v_app ? 'demo_login'             then nullif(btrim(v_app->>'demo_login'), '')             else demo_login end,
      -- A blank password keeps the saved one; the form never shows it.
      demo_password          = case when coalesce(v_app->>'demo_password', '') <> '' then v_app->>'demo_password' else demo_password end,
      demo_details           = case when v_app ? 'demo_details'           then nullif(btrim(v_app->>'demo_details'), '')           else demo_details end,
      ios_subtitle           = case when v_app ? 'ios_subtitle'           then nullif(btrim(v_app->>'ios_subtitle'), '')           else ios_subtitle end,
      ios_keywords           = case when v_app ? 'ios_keywords'           then nullif(btrim(v_app->>'ios_keywords'), '')           else ios_keywords end,
      ios_promo_text         = case when v_app ? 'ios_promo_text'         then nullif(btrim(v_app->>'ios_promo_text'), '')         else ios_promo_text end,
      ios_primary_category   = case when v_app ? 'ios_primary_category'   then nullif(btrim(v_app->>'ios_primary_category'), '')   else ios_primary_category end,
      ios_secondary_category = case when v_app ? 'ios_secondary_category' then nullif(btrim(v_app->>'ios_secondary_category'), '') else ios_secondary_category end,
      publishing_countries   = case when v_app ? 'publishing_countries' then nullif(btrim(v_app->>'publishing_countries'), '') else publishing_countries end,
      feature_graphic_url    = case when v_app ? 'feature_graphic_url' then nullif(btrim(v_app->>'feature_graphic_url'), '') else feature_graphic_url end,
      screenshots_url        = case when v_app ? 'screenshots_url' then nullif(btrim(v_app->>'screenshots_url'), '') else screenshots_url end,
      icon_url               = case when v_app ? 'icon_url' then nullif(btrim(v_app->>'icon_url'), '') else icon_url end,
      ios_copyright          = case when v_app ? 'ios_copyright'          then nullif(btrim(v_app->>'ios_copyright'), '')          else ios_copyright end
    where p.id = (v_app->>'id')::uuid
      and p.client_id = v_client
      and not p.archived;
  end loop;

  -- The client's store accounts: name, type and how we get in.
  for v_acc in select * from jsonb_array_elements(coalesce(p_accounts, '[]'::jsonb)) loop
    update publisher_accounts a set
      account_name   = case when v_acc ? 'account_name' then coalesce(btrim(v_acc->>'account_name'), '') else account_name end,
      account_type   = case when v_acc->>'account_type' in ('organization', 'personal')
                            then (v_acc->>'account_type')::account_type else account_type end,
      access_method  = case when v_acc ? 'access_method'
                            then case when v_acc->>'access_method' in ('invite', 'login') then v_acc->>'access_method' end
                            else access_method end,
      access_email   = case when v_acc ? 'access_email' then nullif(btrim(v_acc->>'access_email'), '') else access_email end,
      -- A blank password keeps the saved one; the form never shows it.
      login_password = case when coalesce(v_acc->>'login_password', '') <> '' then v_acc->>'login_password' else login_password end
    where a.id = (v_acc->>'id')::uuid
      and a.client_id = v_client;
  end loop;
end;
$$;

