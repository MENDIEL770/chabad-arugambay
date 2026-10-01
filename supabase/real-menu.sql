-- real-menu.sql — the actual restaurant menu.
--
-- Replaces the placeholder seed. Safe to re-run: it clears the tenant's
-- menu first, and order history is unaffected because every order stores a
-- snapshot of its lines rather than pointing at these rows.
--
-- No Hebrew appears outside quoted string literals, and the file is ASCII
-- apart from those, so it survives a clipboard round-trip. Prices are LKR.

do $$
declare
  t_id uuid := '00000000-0000-0000-0000-000000000001';
  c_breakfast uuid; c_salads uuid; c_sandwiches uuid; c_mains uuid;
  c_veg uuid; c_dessert uuid; c_drinks uuid;
  i_id uuid; g_id uuid;
begin
  -- Out with the placeholder.
  delete from menu_items where tenant_id = t_id;
  delete from menu_categories where tenant_id = t_id;

  insert into menu_categories (tenant_id, name, sort) values
    (t_id, '{"he":"ארוחות בוקר","en":"Breakfast"}', 1) returning id into c_breakfast;
  insert into menu_categories (tenant_id, name, sort) values
    (t_id, '{"he":"סלטים","en":"Salads"}', 2) returning id into c_salads;
  insert into menu_categories (tenant_id, name, sort) values
    (t_id, '{"he":"סנדוויצים","en":"Sandwiches"}', 3) returning id into c_sandwiches;
  insert into menu_categories (tenant_id, name, sort) values
    (t_id, '{"he":"מנות עיקריות","en":"Main courses"}', 4) returning id into c_mains;
  insert into menu_categories (tenant_id, name, sort) values
    (t_id, '{"he":"צמחוני","en":"Vegetarian"}', 5) returning id into c_veg;
  insert into menu_categories (tenant_id, name, sort) values
    (t_id, '{"he":"קינוחים ושייקים","en":"Desserts and shakes"}', 6) returning id into c_dessert;
  insert into menu_categories (tenant_id, name, sort) values
    (t_id, '{"he":"שתייה","en":"Drinks"}', 7) returning id into c_drinks;

  -- ======================================================= breakfast

  insert into menu_items (tenant_id, category_id, name, description, price_lkr,
                          kosher, prep_minutes, station, sort)
  values (t_id, c_breakfast,
    '{"he":"לאפה חביתה","en":"Omelette laffa"}',
    '{"he":"חביתה, טחינה / מיונז, בצל, עגבניה, מלפפון","en":"Omelette, tahini or mayo, onion, tomato, cucumber"}',
    1800, 'pareve', 10, 'grill', 1)
  returning id into i_id;

  insert into item_modifier_groups (tenant_id, item_id, name, kind, min_select, max_select, sort)
  values (t_id, i_id, '{"he":"מה בפנים","en":"What is inside"}', 'includes', 0, 99, 1)
  returning id into g_id;
  insert into item_modifier_options (tenant_id, group_id, name, price_delta_lkr, is_default, allow_side, sort) values
    (t_id, g_id, '{"he":"טחינה","en":"Tahini"}',   0, true,  true, 1),
    (t_id, g_id, '{"he":"מיונז","en":"Mayo"}',     0, false, true, 2),
    (t_id, g_id, '{"he":"בצל","en":"Onion"}',      0, true,  true, 3),
    (t_id, g_id, '{"he":"עגבניה","en":"Tomato"}',  0, true,  true, 4),
    (t_id, g_id, '{"he":"מלפפון","en":"Cucumber"}',0, true,  true, 5),
    (t_id, g_id, '{"he":"תוספת ביצה","en":"Extra egg"}', 200, false, false, 6);

  insert into menu_items (tenant_id, category_id, name, description, price_lkr,
                          kosher, prep_minutes, station, sort)
  values (t_id, c_breakfast,
    '{"he":"חביתה בצלחת","en":"Omelette plate"}',
    '{"he":"חביתה, טחינה וסלט ישראלי, מוגש לצד לאפה טרייה","en":"Omelette, tahini and Israeli salad with fresh laffa"}',
    2200, 'pareve', 12, 'grill', 2)
  returning id into i_id;

  insert into item_modifier_groups (tenant_id, item_id, name, kind, min_select, max_select, sort)
  values (t_id, i_id, '{"he":"תוספות","en":"Extras"}', 'multi', 0, 3, 1)
  returning id into g_id;
  insert into item_modifier_options (tenant_id, group_id, name, price_delta_lkr, is_default, allow_side, sort) values
    (t_id, g_id, '{"he":"תוספת ביצה","en":"Extra egg"}', 200, false, false, 1);

  insert into menu_items (tenant_id, category_id, name, description, price_lkr,
                          kosher, prep_minutes, station, sort)
  values (t_id, c_breakfast,
    '{"he":"שקשוקה","en":"Shakshuka"}',
    '{"he":"שקשוקה, סלט ישראלי וטחינה, מוגש לצד לאפה טרייה","en":"Shakshuka, Israeli salad and tahini with fresh laffa"}',
    2200, 'pareve', 15, 'grill', 3);

  insert into menu_items (tenant_id, category_id, name, description, price_lkr,
                          kosher, prep_minutes, station, sort)
  values (t_id, c_breakfast,
    '{"he":"ארוחת בוקר פינוקים","en":"Big breakfast"}',
    '{"he":"3 ביצים לבחירה, מטבוחה, סלט ישראלי, טחינה, לאפה ושייק הבית","en":"Three eggs your way, matbucha, Israeli salad, tahini, laffa and a house shake"}',
    3000, 'pareve', 20, 'grill', 4)
  returning id into i_id;

  insert into item_modifier_groups (tenant_id, item_id, name, kind, min_select, max_select, sort)
  values (t_id, i_id, '{"he":"איך הביצים","en":"Eggs"}', 'single', 1, 1, 1)
  returning id into g_id;
  insert into item_modifier_options (tenant_id, group_id, name, price_delta_lkr, is_default, allow_side, sort) values
    (t_id, g_id, '{"he":"עין","en":"Fried"}',        0, false, false, 1),
    (t_id, g_id, '{"he":"מקושקשת","en":"Scrambled"}',0, false, false, 2),
    (t_id, g_id, '{"he":"אומלט","en":"Omelette"}',   0, false, false, 3),
    (t_id, g_id, '{"he":"ביצה קשה","en":"Hard boiled"}', 0, false, false, 4);

  -- ======================================================= salads

  insert into menu_items (tenant_id, category_id, name, description, price_lkr,
                          kosher, prep_minutes, station, sort)
  values (t_id, c_salads,
    '{"he":"סלט ישראלי גדול","en":"Large Israeli salad"}',
    '{"he":"מלפפון, עגבניה, בצל קצוץ, גזר מגורד וטחינה","en":"Cucumber, tomato, chopped onion, grated carrot and tahini"}',
    1800, 'pareve', 8, 'cold', 1);

  insert into menu_items (tenant_id, category_id, name, description, price_lkr,
                          kosher, prep_minutes, station, sort)
  values (t_id, c_salads,
    '{"he":"סלט קריספי צ׳יקן","en":"Crispy chicken salad"}',
    '{"he":"מלפפון, עגבניה, בצל קצוץ, שניצלונים קריספיים ברוטב צ׳ילי מתוק","en":"Cucumber, tomato, onion, crispy chicken strips in sweet chilli"}',
    2500, 'meat', 15, 'grill', 2);

  -- ======================================================= sandwiches
  -- All three laffas share the same removable build, which is exactly what
  -- the modifier model exists for.

  insert into menu_items (tenant_id, category_id, name, description, price_lkr,
                          kosher, prep_minutes, station, sort)
  values (t_id, c_sandwiches,
    '{"he":"לאפה שניצל","en":"Schnitzel laffa"}',
    '{"he":"שניצל הבית, צ׳יפס, מטבוחה, טחינה, עגבניה, מלפפון, בצל, חצילים","en":"House schnitzel, chips, matbucha, tahini, salad, aubergine"}',
    2800, 'meat', 15, 'grill', 1)
  returning id into i_id;

  insert into item_modifier_groups (tenant_id, item_id, name, kind, min_select, max_select, sort)
  values (t_id, i_id, '{"he":"מה בפנים","en":"What is inside"}', 'includes', 0, 99, 1)
  returning id into g_id;
  insert into item_modifier_options (tenant_id, group_id, name, price_delta_lkr, is_default, allow_side, sort) values
    (t_id, g_id, '{"he":"צ׳יפס","en":"Chips"}',      0, true, true, 1),
    (t_id, g_id, '{"he":"מטבוחה","en":"Matbucha"}',  0, true, true, 2),
    (t_id, g_id, '{"he":"טחינה","en":"Tahini"}',     0, true, true, 3),
    (t_id, g_id, '{"he":"עגבניה","en":"Tomato"}',    0, true, true, 4),
    (t_id, g_id, '{"he":"מלפפון","en":"Cucumber"}',  0, true, true, 5),
    (t_id, g_id, '{"he":"בצל","en":"Onion"}',        0, true, true, 6),
    (t_id, g_id, '{"he":"חצילים","en":"Aubergine"}', 0, true, true, 7);

  insert into menu_items (tenant_id, category_id, name, description, price_lkr,
                          kosher, prep_minutes, station, sort)
  values (t_id, c_sandwiches,
    '{"he":"לאפה חזה עוף ירושלמי","en":"Jerusalem chicken laffa"}',
    '{"he":"חזה עוף בתיבול ירושלמי, צ׳יפס, עגבניה, מלפפון, בצל, רוטב אלף האיים","en":"Jerusalem-spiced chicken breast, chips, salad, thousand island"}',
    2800, 'meat', 15, 'grill', 2)
  returning id into i_id;

  insert into item_modifier_groups (tenant_id, item_id, name, kind, min_select, max_select, sort)
  values (t_id, i_id, '{"he":"מה בפנים","en":"What is inside"}', 'includes', 0, 99, 1)
  returning id into g_id;
  insert into item_modifier_options (tenant_id, group_id, name, price_delta_lkr, is_default, allow_side, sort) values
    (t_id, g_id, '{"he":"צ׳יפס","en":"Chips"}',     0, true, true, 1),
    (t_id, g_id, '{"he":"עגבניה","en":"Tomato"}',   0, true, true, 2),
    (t_id, g_id, '{"he":"מלפפון","en":"Cucumber"}', 0, true, true, 3),
    (t_id, g_id, '{"he":"בצל","en":"Onion"}',       0, true, true, 4),
    (t_id, g_id, '{"he":"רוטב אלף האיים","en":"Thousand island"}', 0, true, true, 5);

  insert into menu_items (tenant_id, category_id, name, description, price_lkr,
                          kosher, prep_minutes, station, sort)
  values (t_id, c_sandwiches,
    '{"he":"לאפה שאוורמה","en":"Shawarma laffa"}',
    '{"he":"שאוורמה הבית, צ׳יפס, עגבניה, מלפפון, בצל, טחינה","en":"House shawarma, chips, tomato, cucumber, onion, tahini"}',
    2800, 'meat', 12, 'grill', 3)
  returning id into i_id;

  insert into item_modifier_groups (tenant_id, item_id, name, kind, min_select, max_select, sort)
  values (t_id, i_id, '{"he":"מה בפנים","en":"What is inside"}', 'includes', 0, 99, 1)
  returning id into g_id;
  insert into item_modifier_options (tenant_id, group_id, name, price_delta_lkr, is_default, allow_side, sort) values
    (t_id, g_id, '{"he":"צ׳יפס","en":"Chips"}',     0, true, true, 1),
    (t_id, g_id, '{"he":"עגבניה","en":"Tomato"}',   0, true, true, 2),
    (t_id, g_id, '{"he":"מלפפון","en":"Cucumber"}', 0, true, true, 3),
    (t_id, g_id, '{"he":"בצל","en":"Onion"}',       0, true, true, 4),
    (t_id, g_id, '{"he":"טחינה","en":"Tahini"}',    0, true, true, 5);

  -- ======================================================= mains
  -- Every plate takes a required side and an optional extra chicken.

  insert into menu_items (tenant_id, category_id, name, description, price_lkr,
                          kosher, prep_minutes, station, sort)
  values (t_id, c_mains,
    '{"he":"צלחת שניצל","en":"Schnitzel plate"}',
    '{"he":"שניצל הבית עם תוספת לבחירה","en":"House schnitzel with a side of your choice"}',
    3600, 'meat', 20, 'grill', 1)
  returning id into i_id;

  insert into item_modifier_groups (tenant_id, item_id, name, kind, min_select, max_select, sort)
  values (t_id, i_id, '{"he":"תוספת","en":"Side"}', 'single', 1, 1, 1)
  returning id into g_id;
  insert into item_modifier_options (tenant_id, group_id, name, price_delta_lkr, is_default, allow_side, sort) values
    (t_id, g_id, '{"he":"אורז","en":"Rice"}',            0, false, false, 1),
    (t_id, g_id, '{"he":"צ׳יפס גדול","en":"Large chips"}',0, false, false, 2),
    (t_id, g_id, '{"he":"פירה","en":"Mash"}',            0, false, false, 3),
    (t_id, g_id, '{"he":"פסטה","en":"Pasta"}',           0, false, false, 4);

  insert into item_modifier_groups (tenant_id, item_id, name, kind, min_select, max_select, sort)
  values (t_id, i_id, '{"he":"תוספת עוף","en":"Extra chicken"}', 'single', 0, 1, 2)
  returning id into g_id;
  insert into item_modifier_options (tenant_id, group_id, name, price_delta_lkr, is_default, allow_side, sort) values
    (t_id, g_id, '{"he":"חצי מנה","en":"Half portion"}', 1000, false, false, 1),
    (t_id, g_id, '{"he":"מנה שלמה","en":"Full portion"}',2000, false, false, 2);

  insert into menu_items (tenant_id, category_id, name, description, price_lkr,
                          kosher, prep_minutes, station, sort)
  values (t_id, c_mains,
    '{"he":"צלחת חזה עוף ירושלמי","en":"Jerusalem chicken plate"}',
    '{"he":"חזה עוף בתיבול ירושלמי מסורתי עם תוספת לבחירה","en":"Jerusalem-spiced chicken breast with a side of your choice"}',
    3600, 'meat', 20, 'grill', 2)
  returning id into i_id;

  insert into item_modifier_groups (tenant_id, item_id, name, kind, min_select, max_select, sort)
  values (t_id, i_id, '{"he":"תוספת","en":"Side"}', 'single', 1, 1, 1)
  returning id into g_id;
  insert into item_modifier_options (tenant_id, group_id, name, price_delta_lkr, is_default, allow_side, sort) values
    (t_id, g_id, '{"he":"אורז","en":"Rice"}',            0, false, false, 1),
    (t_id, g_id, '{"he":"צ׳יפס","en":"Chips"}',          0, false, false, 2),
    (t_id, g_id, '{"he":"פירה","en":"Mash"}',            0, false, false, 3),
    (t_id, g_id, '{"he":"פסטה","en":"Pasta"}',           0, false, false, 4);

  insert into item_modifier_groups (tenant_id, item_id, name, kind, min_select, max_select, sort)
  values (t_id, i_id, '{"he":"תוספת עוף","en":"Extra chicken"}', 'single', 0, 1, 2)
  returning id into g_id;
  insert into item_modifier_options (tenant_id, group_id, name, price_delta_lkr, is_default, allow_side, sort) values
    (t_id, g_id, '{"he":"חצי מנה","en":"Half portion"}', 1000, false, false, 1),
    (t_id, g_id, '{"he":"מנה שלמה","en":"Full portion"}',2000, false, false, 2);

  insert into menu_items (tenant_id, category_id, name, description, price_lkr,
                          kosher, prep_minutes, station, sort)
  values (t_id, c_mains,
    '{"he":"צלחת שאוורמה","en":"Shawarma plate"}',
    '{"he":"מנת שאוורמה מפנקת עם תוספת לבחירה","en":"Generous shawarma with a side of your choice"}',
    3600, 'meat', 18, 'grill', 3)
  returning id into i_id;

  insert into item_modifier_groups (tenant_id, item_id, name, kind, min_select, max_select, sort)
  values (t_id, i_id, '{"he":"תוספת","en":"Side"}', 'single', 1, 1, 1)
  returning id into g_id;
  insert into item_modifier_options (tenant_id, group_id, name, price_delta_lkr, is_default, allow_side, sort) values
    (t_id, g_id, '{"he":"אורז","en":"Rice"}',   0, false, false, 1),
    (t_id, g_id, '{"he":"צ׳יפס","en":"Chips"}', 0, false, false, 2),
    (t_id, g_id, '{"he":"פירה","en":"Mash"}',   0, false, false, 3),
    (t_id, g_id, '{"he":"פסטה","en":"Pasta"}',  0, false, false, 4);

  insert into menu_items (tenant_id, category_id, name, description, price_lkr,
                          kosher, prep_minutes, station, sort)
  values (t_id, c_mains,
    '{"he":"מוקפץ עוף אסייתי","en":"Asian chicken stir-fry"}',
    '{"he":"איטריות אורז מוקפצות עם עוף, כרוב, בצל, גזר, שום וג׳ינג׳ר ברוטב טריאקי וצ׳ילי מתוק","en":"Rice noodles with chicken, cabbage, onion, carrot, garlic and ginger in teriyaki and sweet chilli"}',
    2800, 'meat', 18, 'grill', 4);

  -- ======================================================= vegetarian

  insert into menu_items (tenant_id, category_id, name, description, price_lkr,
                          kosher, tags, prep_minutes, station, sort)
  values (t_id, c_veg,
    '{"he":"פסטה ברוטב עגבניות","en":"Pasta in tomato sauce"}',
    '{"he":"פסטה ברוטב עגבניות טריות, בצל ושום","en":"Pasta in fresh tomato sauce with onion and garlic"}',
    1400, 'pareve', array['vegetarian'], 15, 'grill', 1);

  insert into menu_items (tenant_id, category_id, name, description, price_lkr,
                          kosher, tags, prep_minutes, station, sort)
  values (t_id, c_veg,
    '{"he":"מוקפץ נודלס","en":"Noodle stir-fry"}',
    '{"he":"נודלס מוקפץ ברוטב אסייתי עם כרוב, בצל, גזר, שום וג׳ינג׳ר","en":"Stir-fried noodles with cabbage, onion, carrot, garlic and ginger"}',
    1500, 'pareve', array['vegetarian'], 15, 'grill', 2);

  -- ======================================================= desserts

  insert into menu_items (tenant_id, category_id, name, description, price_lkr,
                          kosher, prep_minutes, station, sort)
  values (t_id, c_dessert,
    '{"he":"שייק אלוקי","en":"House shake"}',
    '{"he":"פירות לבחירה","en":"Your choice of fruit"}',
    1000, 'pareve', 5, 'bar', 1)
  returning id into i_id;

  insert into item_modifier_groups (tenant_id, item_id, name, kind, min_select, max_select, sort)
  values (t_id, i_id, '{"he":"פרי","en":"Fruit"}', 'single', 1, 1, 1)
  returning id into g_id;
  insert into item_modifier_options (tenant_id, group_id, name, price_delta_lkr, is_default, allow_side, sort) values
    (t_id, g_id, '{"he":"מנגו","en":"Mango"}',          0, false, false, 1),
    (t_id, g_id, '{"he":"אננס","en":"Pineapple"}',      0, false, false, 2),
    (t_id, g_id, '{"he":"בננה","en":"Banana"}',         0, false, false, 3),
    (t_id, g_id, '{"he":"פסיפלורה","en":"Passionfruit"}',0, false, false, 4);

  insert into menu_items (tenant_id, category_id, name, description, price_lkr,
                          kosher, prep_minutes, station, sort)
  values (t_id, c_dessert,
    '{"he":"צלחת פירות","en":"Fruit plate"}',
    '{"he":"מנגו, אננס, אבטיח, בננה, פסיפלורה","en":"Mango, pineapple, watermelon, banana, passionfruit"}',
    1200, 'pareve', 8, 'cold', 2);

  -- ======================================================= drinks

  insert into menu_items (tenant_id, category_id, name, description, price_lkr,
                          kosher, prep_minutes, station, sort)
  values (t_id, c_drinks,
    '{"he":"שתייה קלה","en":"Soft drink"}',
    '{"he":"ספרייט / קולה / קולה זירו","en":"Sprite, Coke or Coke Zero"}',
    400, 'pareve', 2, 'bar', 1)
  returning id into i_id;

  insert into item_modifier_groups (tenant_id, item_id, name, kind, min_select, max_select, sort)
  values (t_id, i_id, '{"he":"איזו","en":"Which"}', 'single', 1, 1, 1)
  returning id into g_id;
  insert into item_modifier_options (tenant_id, group_id, name, price_delta_lkr, is_default, allow_side, sort) values
    (t_id, g_id, '{"he":"ספרייט","en":"Sprite"}',       0, false, false, 1),
    (t_id, g_id, '{"he":"קולה","en":"Coke"}',           0, false, false, 2),
    (t_id, g_id, '{"he":"קולה זירו","en":"Coke Zero"}', 0, false, false, 3);

  insert into menu_items (tenant_id, category_id, name, description, price_lkr,
                          kosher, prep_minutes, station, sort)
  values (t_id, c_drinks,
    '{"he":"מים / סודה","en":"Water or soda"}',
    '{"he":"","en":""}', 300, 'pareve', 1, 'bar', 2);

  -- ======================================================= sides
  -- Listed as their own items so they can be ordered alone, which the
  -- printed menu allows.

  insert into menu_items (tenant_id, category_id, name, description, price_lkr,
                          kosher, prep_minutes, station, sort) values
    (t_id, c_veg, '{"he":"צ׳יפס","en":"Chips"}',            '{"he":"","en":""}', 1000, 'pareve', 10, 'grill', 10),
    (t_id, c_veg, '{"he":"צ׳יפס גדול","en":"Large chips"}', '{"he":"","en":""}', 1500, 'pareve', 12, 'grill', 11),
    (t_id, c_veg, '{"he":"אורז","en":"Rice"}',              '{"he":"","en":""}', 1000, 'pareve',  5, 'grill', 12),
    (t_id, c_veg, '{"he":"פירה","en":"Mash"}',              '{"he":"","en":""}', 1000, 'pareve',  5, 'grill', 13),
    (t_id, c_veg, '{"he":"לחם","en":"Bread"}',              '{"he":"","en":""}',  350, 'pareve',  2, 'bakery', 14),
    (t_id, c_veg, '{"he":"לאפה","en":"Laffa"}',             '{"he":"","en":""}',  400, 'pareve',  3, 'bakery', 15);
end $$;
