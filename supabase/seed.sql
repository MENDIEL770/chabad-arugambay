-- seed.sql — the Arugam Bay tenant, its settings, hours, and a starting menu.
-- Run ONCE, after the migrations. Safe to re-run: everything upserts.

-- Keep this in step with TENANT_ID in src/lib/config.ts.
insert into tenants (id, slug, name, timezone, country_code, is_israel,
                     latitude, longitude, elevation_m)
values ('00000000-0000-0000-0000-000000000001', 'arugam-bay',
        '{"he":"בית חב״ד ארוגם ביי","en":"Chabad of Arugam Bay"}'::jsonb,
        'Asia/Colombo', 'LK', false, 6.8427703, 81.8311002, 0)
on conflict (id) do update
  set name = excluded.name, latitude = excluded.latitude, longitude = excluded.longitude;

insert into tenant_settings (tenant_id, whatsapp_phone, lkr_per_ils, lkr_per_usd,
                             candle_offset_min, tzeis_extra_min)
values ('00000000-0000-0000-0000-000000000001', '+94771234567', 100, 300, 18, 4)
on conflict (tenant_id) do nothing;

-- 11:00–21:30 daily. Shabbat and yom tov closing is computed from the
-- calendar, not stored here, so it can never drift out of date.
insert into opening_hours (tenant_id, weekday, opens, closes)
select '00000000-0000-0000-0000-000000000001', d, '11:00', '21:30'
from generate_series(0, 6) d
on conflict (tenant_id, weekday) do nothing;

-- ---------------------------------------------------------------- menu

with t as (select '00000000-0000-0000-0000-000000000001'::uuid as id),
cats as (
  insert into menu_categories (tenant_id, name, sort)
  select t.id, c.name::jsonb, c.sort from t, (values
    ('{"he":"ארוחת בוקר","en":"Breakfast"}', 1),
    ('{"he":"עיקריות","en":"Mains"}', 2),
    ('{"he":"שתייה","en":"Drinks"}', 3)
  ) as c(name, sort)
  returning id, name, sort
)
insert into menu_items (tenant_id, category_id, name, description, price_lkr,
                        kosher, prep_minutes, station, stock, stock_qty,
                        daily_limit, sort)
select t.id, c.id, i.name::jsonb, i.descr::jsonb, i.price, i.kosher::kosher_type,
       i.prep, i.station::station_kind, i.stock::stock_mode, i.qty, i.lim, i.sort
from t, cats c, (values
  (1, '{"he":"שקשוקה","en":"Shakshuka"}', '{"he":"עם חלה טרייה וסלט","en":"With challah and salad"}', 2400, 'dairy', 15, 'grill', 'none', null::int, null::int, 1),
  (1, '{"he":"ארוחת בוקר ישראלית","en":"Israeli breakfast"}', '{"he":"ביצים, סלטים, גבינות, לחם","en":"Eggs, salads, cheeses, bread"}', 3100, 'dairy', 20, 'cold', 'daily_limit', null, 20, 2),
  (2, '{"he":"שווארמה בלאפה","en":"Shawarma in laffa"}', '{"he":"עוף, צ׳יפס בפנים, סלטים וטחינה","en":"Chicken, chips inside, salads, tahini"}', 3900, 'meat', 12, 'grill', 'none', null, null, 1),
  (2, '{"he":"פלאפל בפיתה","en":"Falafel in pita"}', '{"he":"חומוס, סלטים, עמבה","en":"Hummus, salads, amba"}', 1800, 'pareve', 10, 'grill', 'none', null, null, 2),
  (2, '{"he":"קארי דג סרי-לנקי","en":"Sri Lankan fish curry"}', '{"he":"דג היום, אורז וסמבול","en":"Catch of the day, rice, sambol"}', 3200, 'pareve', 25, 'grill', 'count', 6, null, 3),
  (2, '{"he":"חומוס עם פול","en":"Hummus with ful"}', '{"he":"עם ביצה, פיתה חמה","en":"With egg and warm pita"}', 1600, 'pareve', 8, 'cold', 'none', null, null, 4),
  (3, '{"he":"לימונדה נענע","en":"Mint lemonade"}', '{"he":"סחוט טרי","en":"Freshly squeezed"}', 900, 'pareve', 5, 'bar', 'none', null, null, 1),
  (3, '{"he":"קוקוס מלכותי","en":"King coconut"}', '{"he":"ישר מהעץ, קר","en":"Straight off the tree"}', 500, 'pareve', 2, 'bar', 'none', null, null, 2)
) as i(cat_sort, name, descr, price, kosher, prep, station, stock, qty, lim, sort)
where c.sort = i.cat_sort
on conflict do nothing;

-- ------------------------------------------------- modifiers for the pita/laffa dishes
--
-- Everything the dish arrives with is a removable default, because "no
-- onion" and "tahini on the side" are the two most common requests and they
-- need somewhere to live other than a free-text note the kitchen misreads.

do $$
declare
  t_id uuid := '00000000-0000-0000-0000-000000000001';
  itm  record;
  g_bread uuid;
  g_inside uuid;
begin
  for itm in
    select id from menu_items
     where tenant_id = t_id
       and name->>'he' in ('שווארמה בלאפה', 'פלאפל בפיתה')
  loop
    -- skip if this item already has groups (re-run safety)
    if exists (select 1 from item_modifier_groups where item_id = itm.id) then
      continue;
    end if;

    insert into item_modifier_groups (tenant_id, item_id, name, kind, min_select, max_select, sort)
    values (t_id, itm.id, '{"he":"לחם","en":"Bread"}'::jsonb, 'single', 1, 1, 1)
    returning id into g_bread;

    insert into item_modifier_options (tenant_id, group_id, name, price_delta_lkr, is_default, allow_side, sort)
    values
      (t_id, g_bread, '{"he":"פיתה","en":"Pita"}'::jsonb, 0, false, false, 1),
      (t_id, g_bread, '{"he":"לאפה","en":"Laffa"}'::jsonb, 300, false, false, 2),
      (t_id, g_bread, '{"he":"במנה (בלי לחם)","en":"On a plate"}'::jsonb, 0, false, false, 3);

    insert into item_modifier_groups (tenant_id, item_id, name, kind, min_select, max_select, sort)
    values (t_id, itm.id, '{"he":"מה בפנים","en":"What is inside"}'::jsonb, 'includes', 0, 99, 2)
    returning id into g_inside;

    insert into item_modifier_options (tenant_id, group_id, name, price_delta_lkr, is_default, allow_side, sort)
    values
      (t_id, g_inside, '{"he":"צ׳יפס","en":"Chips"}'::jsonb,     0, true,  true, 1),
      (t_id, g_inside, '{"he":"חומוס","en":"Hummus"}'::jsonb,    0, true,  true, 2),
      (t_id, g_inside, '{"he":"טחינה","en":"Tahini"}'::jsonb,    0, true,  true, 3),
      (t_id, g_inside, '{"he":"חריף","en":"Spicy"}'::jsonb,      0, true,  true, 4),
      (t_id, g_inside, '{"he":"עגבניה","en":"Tomato"}'::jsonb,   0, true,  true, 5),
      (t_id, g_inside, '{"he":"מלפפון","en":"Cucumber"}'::jsonb, 0, true,  true, 6),
      (t_id, g_inside, '{"he":"בצל","en":"Onion"}'::jsonb,       0, true,  true, 7),
      (t_id, g_inside, '{"he":"חמוצים","en":"Pickles"}'::jsonb,  0, true,  true, 8),
      (t_id, g_inside, '{"he":"ביצה קשה","en":"Hard-boiled egg"}'::jsonb, 400, false, false, 9),
      (t_id, g_inside, '{"he":"עמבה","en":"Amba"}'::jsonb,       0, false, true, 10);
  end loop;
end $$;

-- ---------------------------------------------------------------- your account
--
-- Sign up through the app first (or Authentication → Users in the dashboard),
-- then run this ONE line with your own address to become owner. Until a
-- membership row exists, RLS denies every write — including yours.
--
-- insert into memberships (tenant_id, user_id, role)
-- select '00000000-0000-0000-0000-000000000001', id, 'owner'
--   from auth.users where email = 'mendielharar@gmail.com'
-- on conflict (tenant_id, user_id) do update set role = 'owner';
