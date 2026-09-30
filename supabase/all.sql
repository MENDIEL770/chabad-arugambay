-- all.sql — every migration plus the seed, in order.


-- ============ supabase/migrations/0001_core.sql ============

-- 0001_core.sql — tenants, identity, roles, settings, audit.
-- Single-tenant in practice (Arugam Bay), multi-tenant-ready in schema:
-- every table carries tenant_id from day one.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- enums

create type app_role as enum ('owner','admin','staff','kitchen','courier','viewer');
create type lang_code as enum ('he','en');
create type currency_code as enum ('ILS','USD','LKR');
create type i18n_source as enum ('computed','imported','manual');

-- ---------------------------------------------------------------- tenants

create table tenants (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  name          jsonb not null,                  -- {he, en}
  timezone      text not null default 'Asia/Colombo',
  country_code  text not null default 'LK',
  is_israel     boolean not null default false,  -- Hebcal diaspora rules
  latitude      double precision not null,
  longitude     double precision not null,
  elevation_m   double precision not null default 0,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);

comment on column tenants.is_israel is
  'false for Sri Lanka: second day of yom tov, diaspora parsha schedule.';

-- ---------------------------------------------------------------- identity

-- Maps a Supabase auth user to a tenant + role. The spine of every RLS policy.
create table memberships (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references tenants(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       app_role not null default 'viewer',
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  unique (tenant_id, user_id)
);

create index on memberships (user_id) where is_active;

-- Short-PIN access for shared shop-floor screens (/kitchen, /dispatch).
-- No auth.users row: the PIN mints a scoped, expiring device session.
create table device_sessions (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id) on delete cascade,
  label        text not null,                    -- 'Kitchen tablet', 'Tuk 1'
  role         app_role not null check (role in ('kitchen','courier','staff')),
  pin_hash     text not null,                    -- bcrypt; never the PIN itself
  token        text not null unique,             -- opaque cookie value
  last_seen_at timestamptz,
  expires_at   timestamptz not null,
  revoked_at   timestamptz,
  created_at   timestamptz not null default now()
);

create index on device_sessions (tenant_id) where revoked_at is null;

-- ---------------------------------------------------------------- RLS helpers
-- SECURITY DEFINER + stable so policies stay cheap and recursion-free.

create or replace function app_tenant_ids()
returns setof uuid
language sql stable security definer set search_path = public as $$
  select tenant_id from memberships
  where user_id = auth.uid() and is_active
$$;

create or replace function app_role_in(p_tenant uuid)
returns app_role
language sql stable security definer set search_path = public as $$
  select role from memberships
  where user_id = auth.uid() and tenant_id = p_tenant and is_active
  limit 1
$$;

-- Ranked so policies can say "admin or above" without enumerating roles.
create or replace function app_role_rank(r app_role)
returns int language sql immutable as $$
  select case r
    when 'owner'   then 100
    when 'admin'   then 80
    when 'staff'   then 60
    when 'courier' then 40
    when 'kitchen' then 40
    when 'viewer'  then 20
    else 0 end
$$;

create or replace function app_can(p_tenant uuid, p_min app_role)
returns boolean
language sql stable security definer set search_path = public as $$
  select app_role_rank(app_role_in(p_tenant)) >= app_role_rank(p_min)
$$;

-- ---------------------------------------------------------------- settings

-- One row per tenant. Wide on purpose: these are operator knobs, read on
-- nearly every request, and cheaper as columns than as a k/v table.
create table tenant_settings (
  tenant_id uuid primary key references tenants(id) on delete cascade,

  -- branding
  logo_color_url   text,
  logo_white_url   text,
  logo_share_url   text,
  brand_colors     jsonb not null default '{}'::jsonb,
  public_domain    text,

  -- contact / about
  about            jsonb not null default '{}'::jsonb,   -- {he, en}
  address          jsonb not null default '{}'::jsonb,
  whatsapp_phone   text,                                  -- E.164
  contact_email    text,

  -- calendar & zmanim (Baal HaTanya / Alter Rebbe)
  candle_offset_min      int  not null default 18,
  tzeis_extra_min        int  not null default 4,
  havdalah_offset_min    int  not null default 0,
  zmanim_method          text not null default 'baal_hatanya',

  -- money
  default_currency       currency_code not null default 'ILS',
  lkr_per_ils            numeric(12,4) not null default 100.0,
  lkr_per_usd            numeric(12,4) not null default 300.0,
  fx_updated_at          timestamptz,

  -- payments (keys live in vault, not here; see 0007)
  payment_provider       text not null default 'kesher',
  payment_links          jsonb not null default '{}'::jsonb,
  cover_fees_percent     numeric(5,2) not null default 5.00,
  intent_ttl_minutes     int not null default 10,

  -- restaurant
  auto_close_on_shabbat  boolean not null default true,
  shabbat_reopen_buffer_min int not null default 30,
  manual_closed          boolean not null default false,
  manual_closed_message  jsonb not null default '{}'::jsonb,

  -- delivery
  delivery_provider      text not null default 'internal'
                         check (delivery_provider in ('internal','assisted','pickme')),
  delivery_fee_mode      text not null default 'driver_direct'
                         check (delivery_fee_mode in ('driver_direct','collected_by_us')),
  service_fee_enabled    boolean not null default false,
  service_fee_percent    numeric(5,2) not null default 0,
  service_fee_flat_lkr   int not null default 0,
  cod_allowed            boolean not null default true,
  cod_max_lkr            int not null default 50000,
  online_required_above_lkr int,
  dispatch_lead_min      int not null default 5,
  pickme_assign_timeout_min int not null default 8,

  -- shabbat generator
  shabbat_autogen_enabled boolean not null default true,
  shabbat_autogen_count   int not null default 24,

  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- audit

create table audit_log (
  id         bigserial primary key,
  tenant_id  uuid not null references tenants(id) on delete cascade,
  actor_id   uuid references auth.users(id) on delete set null,
  actor_label text,                                -- device session / system / cron
  action     text not null,                        -- 'order.status', 'item.86'
  entity     text not null,
  entity_id  text,
  before     jsonb,
  after      jsonb,
  at         timestamptz not null default now()
);

create index on audit_log (tenant_id, at desc);
create index on audit_log (tenant_id, entity, entity_id);

-- ---------------------------------------------------------------- updated_at

create or replace function touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

create trigger t_tenant_settings_touch before update on tenant_settings
  for each row execute function touch_updated_at();

-- ============ supabase/migrations/0002_calendar.sql ============

-- 0002_calendar.sql — Hebrew calendar + halachic times, precomputed per tenant.
-- Precomputed (not computed per request) so the shabbat generator, relative
-- event times, dynamic values, the public site and the restaurant's automatic
-- shabbat closing all read the same numbers, and so a mistake is correctable
-- by hand instead of by deploy.

create table tenant_zmanim (
  tenant_id       uuid not null references tenants(id) on delete cascade,
  date            date not null,                 -- civil date, tenant timezone

  hebrew_date     text not null,                 -- 'ל׳ אלול תשפ״ו'
  hebrew_date_en  text not null,                 -- '30 Elul 5786'
  parsha          jsonb,                         -- {he, en}; null midweek
  holiday         jsonb,                         -- {he, en}; null ordinary day

  -- day classification. Drives restaurant closing and form generation.
  is_shabbat      boolean not null default false,
  is_yomtov       boolean not null default false,
  is_chol_hamoed  boolean not null default false,
  is_fast         boolean not null default false,
  is_rosh_chodesh boolean not null default false,
  -- second night of yom tov / motzaei shabbat into yom tov: candles are lit
  -- from an existing flame, and not before nightfall.
  from_existing_flame boolean not null default false,

  -- times, stored as timestamptz (absolute instants, rendered in tenant tz)
  alos            timestamptz,   -- 16.9deg  (Baal HaTanya)
  sunrise         timestamptz,   -- visible / mishor
  sunrise_baal    timestamptz,   -- 1.583deg below horizon
  sof_zman_shma   timestamptz,
  sof_zman_tfila  timestamptz,
  chatzos         timestamptz,
  mincha_gedola   timestamptz,
  mincha_ketana   timestamptz,
  plag_hamincha   timestamptz,
  sunset          timestamptz,   -- visible
  sunset_baal     timestamptz,   -- 1.583deg
  tzeis           timestamptz,   -- 6deg + tzeis_extra_min
  candle_lighting timestamptz,   -- visible sunset - candle_offset_min
  havdalah        timestamptz,   -- end of shabbat / yom tov

  source          i18n_source not null default 'computed',
  note            text,
  updated_at      timestamptz not null default now(),

  primary key (tenant_id, date)
);

create index on tenant_zmanim (tenant_id, date) where is_shabbat or is_yomtov;

create trigger t_tenant_zmanim_touch before update on tenant_zmanim
  for each row execute function touch_updated_at();

comment on table tenant_zmanim is
  'Precedence when writing: manual > imported > computed. A recompute must
   never overwrite a row whose source is manual.';

-- Guard the precedence rule in the database, not only in application code.
create or replace function zmanim_respect_precedence()
returns trigger language plpgsql as $$
begin
  if old.source = 'manual' and new.source = 'computed' then
    return old;  -- silently keep the hand-entered row
  end if;
  if old.source = 'imported' and new.source = 'computed' then
    return old;
  end if;
  return new;
end $$;

create trigger t_zmanim_precedence before update on tenant_zmanim
  for each row execute function zmanim_respect_precedence();

-- ============ supabase/migrations/0003_restaurant.sql ============

-- 0003_restaurant.sql — menu, stock, hours, orders.

create type kosher_type   as enum ('meat','dairy','pareve');
create type station_kind  as enum ('grill','cold','bar','bakery');
create type stock_mode    as enum ('none','count','daily_limit');
create type order_channel as enum ('web','pos','whatsapp','phone');
create type fulfillment   as enum ('delivery','pickup','dine_in');
create type order_status  as enum ('received','accepted','preparing','ready',
                                   'dispatched','delivered','completed',
                                   'cancelled','rejected');
create type payment_method as enum ('online_ils','online_usd','cash_lkr_to_driver',
                                    'cash_lkr_at_counter','pos');
create type payment_status as enum ('unpaid','paid','cod_pending','cod_collected','refunded');

-- ---------------------------------------------------------------- menu

create table menu_categories (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references tenants(id) on delete cascade,
  name       jsonb not null,                         -- {he, en}
  sort       int not null default 0,
  is_active  boolean not null default true,
  -- e.g. breakfast until 11:00 → [{"from":"07:00","to":"11:00"}]
  available_hours jsonb not null default '[]'::jsonb,
  image_path text,                                   -- storage key, not a URL
  created_at timestamptz not null default now()
);

create index on menu_categories (tenant_id, sort) where is_active;

create table menu_items (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  category_id uuid not null references menu_categories(id) on delete cascade,
  name        jsonb not null,                        -- {he, en}
  description jsonb not null default '{}'::jsonb,
  price_lkr   int not null check (price_lkr >= 0),   -- minor unit is not used; LKR has no practical subunit
  image_path  text,
  kosher      kosher_type not null default 'pareve',
  tags        text[] not null default '{}',          -- spicy, vegan, gf, kids
  prep_minutes int not null default 15,
  station     station_kind not null default 'grill',

  -- availability. `is_available` is the manual 86 switch; the stock columns
  -- below drive it automatically.
  is_available boolean not null default true,
  stock        stock_mode not null default 'none',
  stock_qty    int,                                  -- for stock = 'count'
  daily_limit  int,                                  -- for stock = 'daily_limit'
  sold_today   int not null default 0,

  sort        int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint stock_qty_present    check (stock <> 'count'       or stock_qty  is not null),
  constraint daily_limit_present  check (stock <> 'daily_limit' or daily_limit is not null)
);

create index on menu_items (tenant_id, category_id, sort);

create trigger t_menu_items_touch before update on menu_items
  for each row execute function touch_updated_at();

/**
 * Sellability in one place.
 *
 * Every surface that can add an item to a cart must consult this and nothing
 * else. Duplicating the rule in the web checkout, the POS and the WhatsApp
 * bot is how a sold-out dish gets ordered anyway.
 */
create or replace function item_is_sellable(i menu_items)
returns boolean language sql stable as $$
  select i.is_available and case i.stock
    when 'none'        then true
    when 'count'       then coalesce(i.stock_qty, 0) > 0
    when 'daily_limit' then i.sold_today < coalesce(i.daily_limit, 0)
  end
$$;

/**
 * Three kinds of group, because they behave differently for the customer
 * AND for the kitchen:
 *
 *   'includes' — what the dish already comes with. Every option starts
 *                selected; the customer REMOVES things or moves them to the
 *                side. A laffa comes with chips, tahini, salad; "no onion"
 *                and "tahini on the side" are both this.
 *   'single'   — pick exactly one (spice level, size, bread).
 *   'multi'    — optional paid extras.
 *
 * The distinction matters most on the kitchen ticket: for 'includes' the
 * cook must be told the DIFFERENCE from the standard build, never the full
 * list, or the exceptions disappear into a wall of text.
 */
create type modifier_kind as enum ('includes','single','multi');

create table item_modifier_groups (
  id        uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  item_id   uuid not null references menu_items(id) on delete cascade,
  name      jsonb not null,
  kind      modifier_kind not null default 'multi',
  min_select int not null default 0,
  max_select int not null default 1,
  sort      int not null default 0,
  check (min_select >= 0 and max_select >= min_select)
);

create table item_modifier_options (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references tenants(id) on delete cascade,
  group_id       uuid not null references item_modifier_groups(id) on delete cascade,
  name           jsonb not null,
  price_delta_lkr int not null default 0,
  /** Part of the standard build. Only meaningful for kind = 'includes'. */
  is_default     boolean not null default false,
  /** May be requested on the side rather than only in or out. */
  allow_side     boolean not null default true,
  is_available   boolean not null default true,
  sort           int not null default 0
);

create index on item_modifier_groups (item_id, sort);
create index on item_modifier_options (group_id, sort);

-- ---------------------------------------------------------------- hours

create table opening_hours (
  tenant_id uuid not null references tenants(id) on delete cascade,
  weekday   int  not null check (weekday between 0 and 6),   -- 0 = Sunday
  opens     time not null,
  closes    time not null,
  is_closed boolean not null default false,
  primary key (tenant_id, weekday)
);

-- One-off overrides: a wedding, a staff day off, a storm.
create table opening_exceptions (
  id        uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  date      date not null,
  is_closed boolean not null default true,
  opens     time,
  closes    time,
  reason    jsonb not null default '{}'::jsonb,
  unique (tenant_id, date)
);

-- ---------------------------------------------------------------- orders

create table orders (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id) on delete cascade,
  -- Short human code, unique per tenant per day: #A-042. Staff read it aloud.
  code         text not null,
  order_date   date not null default (now() at time zone 'Asia/Colombo')::date,

  channel      order_channel not null default 'web',
  fulfillment  fulfillment not null,
  table_no     text,

  customer_name  text not null,
  customer_phone text not null,                      -- E.164
  customer_lang  lang_code not null default 'he',

  address_text  text,
  address_lat   double precision,
  address_lng   double precision,
  address_notes text,

  /**
   * Line items are a SNAPSHOT, not references. A price change or a renamed
   * dish must never alter what an order said when it was placed — receipts
   * are printed from this and money is settled against it.
   */
  items jsonb not null,

  subtotal_lkr     int not null default 0,
  delivery_fee_lkr int not null default 0,
  service_fee_lkr  int not null default 0,
  discount_lkr     int not null default 0,
  tip_lkr          int not null default 0,
  total_lkr        int not null default 0,

  pay_method payment_method not null,
  pay_status payment_status not null default 'unpaid',
  -- Amount charged online, in the currency actually charged, alongside the
  -- LKR equivalent and the rate used. Keeping all three makes a refund
  -- reconcilable months later when the rate has moved.
  charged_amount   numeric(12,2),
  charged_currency currency_code,
  fx_lkr_per_unit  numeric(12,4),

  status       order_status not null default 'received',
  eta_minutes  int,
  scheduled_for timestamptz,

  timeline   jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (tenant_id, order_date, code),
  constraint delivery_needs_address
    check (fulfillment <> 'delivery' or address_text is not null),
  constraint dine_in_needs_table
    check (fulfillment <> 'dine_in' or table_no is not null)
);

create index on orders (tenant_id, status, created_at desc);
create index on orders (tenant_id, order_date desc);

create trigger t_orders_touch before update on orders
  for each row execute function touch_updated_at();

-- Append-only audit of everything that happened to an order.
create table order_events (
  id       bigserial primary key,
  tenant_id uuid not null references tenants(id) on delete cascade,
  order_id uuid not null references orders(id) on delete cascade,
  type     text not null,
  payload  jsonb not null default '{}'::jsonb,
  actor    text,
  at       timestamptz not null default now()
);

create index on order_events (order_id, at);

/** Allocate the next daily code per tenant: A-001, A-002, ... */
create or replace function next_order_code(p_tenant uuid)
returns text language plpgsql as $$
declare n int;
begin
  select count(*) + 1 into n from orders
   where tenant_id = p_tenant
     and order_date = (now() at time zone 'Asia/Colombo')::date;
  return 'A-' || lpad(n::text, 3, '0');
end $$;

/**
 * Keep sold_today in step with accepted orders, and 86 an item the moment it
 * runs out. Done in the database so the POS, the web checkout and the
 * WhatsApp bot cannot each forget it.
 */
create or replace function apply_stock_for_order()
returns trigger language plpgsql as $$
declare line jsonb; iid uuid; q int;
begin
  if new.status = 'accepted' and (old.status is distinct from 'accepted') then
    for line in select * from jsonb_array_elements(new.items) loop
      iid := (line->>'item_id')::uuid;
      q   := coalesce((line->>'qty')::int, 0);
      if iid is null or q <= 0 then continue; end if;

      update menu_items
         set sold_today = sold_today + q,
             stock_qty  = case when stock = 'count'
                               then greatest(coalesce(stock_qty,0) - q, 0)
                               else stock_qty end
       where id = iid and tenant_id = new.tenant_id;

      update menu_items
         set is_available = false
       where id = iid and tenant_id = new.tenant_id
         and not item_is_sellable(menu_items.*);
    end loop;
  end if;
  return new;
end $$;

create trigger t_orders_stock after update on orders
  for each row execute function apply_stock_for_order();

-- ============ supabase/migrations/0004_rls.sql ============

-- 0004_rls.sql — row-level security and the menu-image storage bucket.
--
-- Shape of every policy:
--   public read   → only rows a guest is allowed to see (active menu, zmanim)
--   staff write   → app_can(tenant_id, 'staff') or stricter
-- Anything not matched by a policy is denied, because RLS is forced on.

alter table tenants               enable row level security;
alter table memberships           enable row level security;
alter table device_sessions       enable row level security;
alter table tenant_settings       enable row level security;
alter table audit_log             enable row level security;
alter table tenant_zmanim         enable row level security;
alter table menu_categories       enable row level security;
alter table menu_items            enable row level security;
alter table item_modifier_groups  enable row level security;
alter table item_modifier_options enable row level security;
alter table opening_hours         enable row level security;
alter table opening_exceptions    enable row level security;
alter table orders                enable row level security;
alter table order_events          enable row level security;

-- ---------------------------------------------------------------- tenants

create policy tenants_read_public on tenants
  for select using (is_active);

create policy tenants_write_owner on tenants
  for update using (app_can(id, 'owner')) with check (app_can(id, 'owner'));

-- ---------------------------------------------------------------- memberships
-- A member sees their own tenant's roster; only an admin may change it.
-- Self-elevation is blocked by requiring admin on the TARGET tenant.

create policy memberships_read on memberships
  for select using (tenant_id in (select app_tenant_ids()));

create policy memberships_write on memberships
  for all using (app_can(tenant_id, 'admin'))
  with check (app_can(tenant_id, 'admin'));

-- ---------------------------------------------------------------- settings

create policy settings_read_public on tenant_settings
  for select using (true);

create policy settings_write_admin on tenant_settings
  for all using (app_can(tenant_id, 'admin'))
  with check (app_can(tenant_id, 'admin'));

-- ---------------------------------------------------------------- devices

create policy devices_admin on device_sessions
  for all using (app_can(tenant_id, 'admin'))
  with check (app_can(tenant_id, 'admin'));

-- ---------------------------------------------------------------- audit
-- Readable by admins, never updated or deleted by anyone through the API.

create policy audit_read on audit_log
  for select using (app_can(tenant_id, 'admin'));

create policy audit_insert on audit_log
  for insert with check (tenant_id in (select app_tenant_ids()));

-- ---------------------------------------------------------------- zmanim

create policy zmanim_read_public on tenant_zmanim
  for select using (true);

create policy zmanim_write_admin on tenant_zmanim
  for all using (app_can(tenant_id, 'admin'))
  with check (app_can(tenant_id, 'admin'));

-- ---------------------------------------------------------------- menu
-- Guests see active categories and the items inside them. They may see a
-- sold-out item (greyed out in the UI) but the checkout re-checks
-- item_is_sellable server-side before accepting money.

create policy menu_cat_read_public on menu_categories
  for select using (is_active);

create policy menu_cat_write on menu_categories
  for all using (app_can(tenant_id, 'staff'))
  with check (app_can(tenant_id, 'staff'));

create policy menu_item_read_public on menu_items
  for select using (
    exists (select 1 from menu_categories c
             where c.id = menu_items.category_id and c.is_active)
  );

create policy menu_item_write on menu_items
  for all using (app_can(tenant_id, 'kitchen'))
  with check (app_can(tenant_id, 'kitchen'));

create policy modgroup_read_public on item_modifier_groups for select using (true);
create policy modgroup_write on item_modifier_groups
  for all using (app_can(tenant_id, 'staff')) with check (app_can(tenant_id, 'staff'));

create policy modopt_read_public on item_modifier_options for select using (true);
create policy modopt_write on item_modifier_options
  for all using (app_can(tenant_id, 'staff')) with check (app_can(tenant_id, 'staff'));

-- ---------------------------------------------------------------- hours

create policy hours_read_public on opening_hours for select using (true);
create policy hours_write on opening_hours
  for all using (app_can(tenant_id, 'staff')) with check (app_can(tenant_id, 'staff'));

create policy hours_exc_read_public on opening_exceptions for select using (true);
create policy hours_exc_write on opening_exceptions
  for all using (app_can(tenant_id, 'staff')) with check (app_can(tenant_id, 'staff'));

-- ---------------------------------------------------------------- orders
--
-- Deliberately NO anonymous select policy. A guest tracking an order at
-- /order/{id} goes through a server route that looks the row up with the
-- service key and returns only the tracking fields. Letting the browser read
-- the table directly would expose every customer's name, phone and address to
-- anyone who can guess a uuid.

create policy orders_read_staff on orders
  for select using (app_can(tenant_id, 'kitchen'));

create policy orders_write_staff on orders
  for all using (app_can(tenant_id, 'kitchen'))
  with check (app_can(tenant_id, 'kitchen'));

create policy order_events_read on order_events
  for select using (app_can(tenant_id, 'kitchen'));

create policy order_events_insert on order_events
  for insert with check (app_can(tenant_id, 'kitchen'));

-- ---------------------------------------------------------------- storage
-- Dish photos. Public read (they appear on the menu), staff-only write.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('menu', 'menu', true, 8388608,
        array['image/jpeg','image/png','image/webp','image/avif'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Policies on storage.objects execute with search_path = storage, so calls
-- into public must be schema-qualified or they fail at upload time.
create policy menu_images_read on storage.objects
  for select using (bucket_id = 'menu');

-- Object keys are '<tenant_id>/<item_id>/<file>', so the first path segment
-- decides who may write. Without this check any staff member of any tenant
-- could overwrite another tenant's photos once the system is replicated.
create policy menu_images_write on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'menu'
    and public.app_can(((storage.foldername(name))[1])::uuid, 'staff')
  );

create policy menu_images_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'menu'
    and public.app_can(((storage.foldername(name))[1])::uuid, 'staff')
  );

create policy menu_images_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'menu'
    and public.app_can(((storage.foldername(name))[1])::uuid, 'staff')
  );

-- ============ supabase/migrations/0005_hero.sql ============

-- 0005_hero.sql — rotating hero images for the public home page.

create table hero_slides (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references tenants(id) on delete cascade,

  image_path text not null,                       -- storage key in bucket 'hero'

  /**
   * Where the subject sits, as percentages. A 2:1 hero cropped to a phone
   * loses most of its width, and without this the crop takes the centre —
   * which is how you end up with a photo of the sea and no building.
   */
  focal_x    int not null default 50 check (focal_x between 0 and 100),
  focal_y    int not null default 50 check (focal_y between 0 and 100),

  /**
   * Optional text bound to THIS image. When headline is present it replaces
   * the default hero copy for as long as the slide is showing; otherwise the
   * page keeps showing the upcoming occasion.
   */
  headline   jsonb,                               -- {he, en} or null
  subhead    jsonb,
  cta_label  jsonb,
  cta_href   text,

  /** How dark to make the scrim over this particular image, 0–80. A bright
   *  midday beach needs more than a dusk shot for the text to stay legible. */
  overlay    int not null default 35 check (overlay between 0 and 80),

  sort       int not null default 0,
  is_active  boolean not null default true,

  -- Kept for the admin so it can warn about an image that is too small.
  width_px   int,
  height_px  int,
  bytes      int,

  created_at timestamptz not null default now(),

  constraint cta_needs_both
    check ((cta_label is null) = (cta_href is null))
);

create index on hero_slides (tenant_id, sort) where is_active;

alter table hero_slides enable row level security;

create policy hero_read_public on hero_slides
  for select using (is_active);

create policy hero_write on hero_slides
  for all using (app_can(tenant_id, 'admin'))
  with check (app_can(tenant_id, 'admin'));

-- Hero images are large; a higher ceiling than dish photos.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('hero', 'hero', true, 6291456,
        array['image/jpeg','image/png','image/webp','image/avif'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy hero_images_read on storage.objects
  for select using (bucket_id = 'hero');

-- Schema-qualified: storage policies run with search_path = storage.
create policy hero_images_write on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'hero'
    and public.app_can(((storage.foldername(name))[1])::uuid, 'admin')
  );

create policy hero_images_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'hero'
    and public.app_can(((storage.foldername(name))[1])::uuid, 'admin')
  );

create policy hero_images_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'hero'
    and public.app_can(((storage.foldername(name))[1])::uuid, 'admin')
  );

-- ============ supabase/migrations/0006_order_tracking.sql ============

-- 0006_order_tracking.sql — let a customer follow their own order, safely.

/**
 * A separate, unguessable token for the tracking link.
 *
 * The order id is a uuid, but it travels in emails, WhatsApp messages and
 * kitchen tickets. Using it as the access key would mean anyone who ever saw
 * one — or who guesses — can read a customer's name, phone and address. The
 * token is generated per order, never printed on a ticket, and is the only
 * thing /order/<token> accepts.
 */
alter table orders
  add column if not exists track_token text not null
    default encode(gen_random_bytes(16), 'hex');

create unique index if not exists orders_track_token_key on orders (track_token);

/**
 * Exactly the fields a customer may see about their own order.
 *
 * Deliberately excludes address, notes and the phone number: the person
 * following the link already knows them, and a leaked link should not hand
 * them to anyone else. No policy on `orders` is added — the tracking route
 * reads through this function with the service key and returns nothing else.
 */
create or replace function order_tracking(p_token text)
returns table (
  code          text,
  status        order_status,
  fulfillment   fulfillment,
  eta_minutes   int,
  items         jsonb,
  total_lkr     int,
  pay_method    payment_method,
  pay_status    payment_status,
  created_at    timestamptz,
  timeline      jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  select o.code, o.status, o.fulfillment, o.eta_minutes, o.items,
         o.total_lkr, o.pay_method, o.pay_status, o.created_at, o.timeline
    from orders o
   where o.track_token = p_token
$$;

revoke all on function order_tracking(text) from public;
grant execute on function order_tracking(text) to anon, authenticated;

/**
 * Placing an order is done by a guest, so it cannot go through RLS as the
 * caller. It runs as definer and rebuilds every price from the menu table —
 * the client sends item ids and quantities only. A browser that posts its
 * own totals must not be able to set them.
 */
create or replace function place_order(
  p_tenant       uuid,
  p_channel      order_channel,
  p_fulfillment  fulfillment,
  p_name         text,
  p_phone        text,
  p_lang         lang_code,
  p_address      text,
  p_address_notes text,
  p_table_no     text,
  p_pay_method   payment_method,
  p_lines        jsonb,          -- [{item_id, qty, modifiers:[{id,state}], note}]
  p_lat          double precision,
  p_lng          double precision,
  p_delivery_fee int
)
returns table (order_id uuid, order_code text, track_token text, total int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_line     jsonb;
  v_item     menu_items%rowtype;
  v_qty      int;
  v_unit     int;
  v_delta    int;
  v_subtotal int := 0;
  v_snapshot jsonb := '[]'::jsonb;
  v_mods     jsonb;
  v_mod      jsonb;
  v_opt      item_modifier_options%rowtype;
  v_names    jsonb;
  v_total    int;
  v_id       uuid;
  v_code     text;
  v_token    text;
begin
  if jsonb_array_length(coalesce(p_lines, '[]'::jsonb)) = 0 then
    raise exception 'EMPTY_CART';
  end if;

  for v_line in select * from jsonb_array_elements(p_lines) loop
    v_qty := greatest(coalesce((v_line->>'qty')::int, 0), 0);
    if v_qty = 0 then continue; end if;
    if v_qty > 50 then raise exception 'QTY_TOO_LARGE'; end if;

    select * into v_item from menu_items
     where id = (v_line->>'item_id')::uuid and tenant_id = p_tenant;

    if not found then raise exception 'UNKNOWN_ITEM'; end if;
    -- The same rule the UI used, re-evaluated at the moment money is agreed.
    if not item_is_sellable(v_item) then
      raise exception 'SOLD_OUT:%', v_item.name->>'he';
    end if;

    v_unit  := v_item.price_lkr;
    v_delta := 0;
    v_names := '[]'::jsonb;
    v_mods  := coalesce(v_line->'modifiers', '[]'::jsonb);

    for v_mod in select * from jsonb_array_elements(v_mods) loop
      select o.* into v_opt
        from item_modifier_options o
        join item_modifier_groups g on g.id = o.group_id
       where o.id = (v_mod->>'id')::uuid
         and o.tenant_id = p_tenant
         and g.item_id = v_item.id;         -- an option from another dish is rejected

      if not found then raise exception 'UNKNOWN_MODIFIER'; end if;
      if not v_opt.is_available then raise exception 'MODIFIER_UNAVAILABLE'; end if;

      -- Removing or setting aside a default never changes the price.
      if (v_mod->>'state') in ('in', 'side') and not v_opt.is_default then
        v_delta := v_delta + v_opt.price_delta_lkr;
      end if;

      v_names := v_names || jsonb_build_object(
        'name', v_opt.name->>'he',
        'state', v_mod->>'state',
        'is_default', v_opt.is_default
      );
    end loop;

    v_subtotal := v_subtotal + (v_unit + v_delta) * v_qty;

    v_snapshot := v_snapshot || jsonb_build_object(
      'item_id',   v_item.id,
      'name',      v_item.name->>'he',
      'name_en',   v_item.name->>'en',
      'station',   v_item.station,
      'qty',       v_qty,
      'unit',      v_unit + v_delta,
      'line_total',(v_unit + v_delta) * v_qty,
      'modifiers', v_names,
      'note',      nullif(trim(coalesce(v_line->>'note', '')), '')
    );
  end loop;

  if v_subtotal = 0 then raise exception 'EMPTY_CART'; end if;

  v_total := v_subtotal + case when p_fulfillment = 'delivery'
                               then greatest(coalesce(p_delivery_fee, 0), 0)
                               else 0 end;
  v_code  := next_order_code(p_tenant);
  v_token := encode(gen_random_bytes(16), 'hex');

  insert into orders (
    tenant_id, code, channel, fulfillment, table_no,
    customer_name, customer_phone, customer_lang,
    address_text, address_notes, address_lat, address_lng,
    items, subtotal_lkr, delivery_fee_lkr, total_lkr,
    pay_method, pay_status, status, track_token, timeline
  ) values (
    p_tenant, v_code, p_channel, p_fulfillment, p_table_no,
    p_name, p_phone, p_lang,
    p_address, p_address_notes, p_lat, p_lng,
    v_snapshot, v_subtotal,
    case when p_fulfillment = 'delivery' then greatest(coalesce(p_delivery_fee,0),0) else 0 end,
    v_total,
    p_pay_method,
    case when p_pay_method in ('cash_lkr_to_driver','cash_lkr_at_counter')
         then 'cod_pending'::payment_status else 'unpaid'::payment_status end,
    'received', v_token,
    jsonb_build_array(jsonb_build_object('status','received','at', now()))
  )
  returning id into v_id;

  insert into order_events (tenant_id, order_id, type, payload, actor)
  values (p_tenant, v_id, 'placed', jsonb_build_object('channel', p_channel), 'customer');

  return query select v_id, v_code, v_token, v_total;
end $$;

revoke all on function place_order(uuid, order_channel, fulfillment, text, text,
  lang_code, text, text, text, payment_method, jsonb,
  double precision, double precision, int) from public;

-- ============ supabase/migrations/0007_events.sql ============

-- 0007_events.sql — shabbat, chag and event registration. Replaces Flowiz.

create type event_kind        as enum ('shabbat','yomtov','event','payment_page');
create type registrant_kind   as enum ('adult','child','infant','donation','sale');
create type registration_state as enum ('pending','confirmed','cancelled','refunded');

create table events (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  slug        text not null,
  kind        event_kind not null default 'shabbat',

  title       jsonb not null,                    -- {he, en}
  intro       jsonb not null default '{}'::jsonb,

  /** The occasion this was generated from, so the nightly job can find it
   *  again and never create a duplicate for the same shabbat. */
  occasion_key text,

  starts_on   date not null,                     -- first rest day
  ends_on     date not null,
  erev_on     date not null,

  is_open     boolean not null default true,
  is_listed   boolean not null default true,
  /** Registration closes this many hours before candle lighting, so there is
   *  time to shop and cook. */
  closes_hours_before int not null default 24,

  /** Set when a human edits a generated event, so the generator leaves it
   *  alone from then on. Losing a shliach's hand-written text to a cron job
   *  is the fastest way to make them stop trusting the system. */
  hand_edited boolean not null default false,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  unique (tenant_id, slug),
  unique (tenant_id, occasion_key),
  check (ends_on >= starts_on and erev_on <= starts_on)
);

create index on events (tenant_id, starts_on) where is_open;

create trigger t_events_touch before update on events
  for each row execute function touch_updated_at();

create table event_meals (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references tenants(id) on delete cascade,
  event_id   uuid not null references events(id) on delete cascade,
  name       jsonb not null,
  /** When the meal is served. Null start means "see the times board". */
  serves_at  timestamptz,
  location   jsonb not null default '{}'::jsonb,
  capacity   int,                                -- null = unlimited
  is_open    boolean not null default true,
  sort       int not null default 0
);

create index on event_meals (event_id, sort);

create table registrant_types (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  meal_id     uuid not null references event_meals(id) on delete cascade,
  name        jsonb not null,
  kind        registrant_kind not null default 'adult',
  price_ils   numeric(10,2) not null default 0,
  /** Seats consumed per unit. A baby in arms takes none. */
  seats       int not null default 1,
  max_per_registration int not null default 20,
  sort        int not null default 0,
  check (price_ils >= 0 and seats >= 0)
);

create index on registrant_types (meal_id, sort);

create table registrations (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  event_id    uuid not null references events(id) on delete cascade,
  code        text not null,

  full_name   text not null,
  email       text,
  phone       text not null,
  nationality text,
  notes       text,

  state       registration_state not null default 'pending',

  total_ils   numeric(10,2) not null default 0,
  donation_ils numeric(10,2) not null default 0,
  /** Set once a payment provider confirms. Null means nothing was charged. */
  paid_at     timestamptz,
  payment_ref text,

  track_token text not null default encode(gen_random_bytes(16), 'hex'),

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  unique (tenant_id, code)
);

create unique index on registrations (track_token);
create index on registrations (tenant_id, event_id, created_at desc);

create trigger t_registrations_touch before update on registrations
  for each row execute function touch_updated_at();

/** One line per registrant type chosen, with the price frozen at the time. */
create table registration_items (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenants(id) on delete cascade,
  registration_id uuid not null references registrations(id) on delete cascade,
  meal_id         uuid not null references event_meals(id) on delete cascade,
  type_id         uuid not null references registrant_types(id) on delete cascade,
  qty             int not null check (qty > 0),
  unit_price_ils  numeric(10,2) not null,
  line_total_ils  numeric(10,2) not null
);

create index on registration_items (registration_id);

/**
 * Names of everyone attending.
 *
 * Kept separate from the registration because the house needs a head count
 * per meal by name — for seating, and because Sri Lanka asks for passport
 * names when guests sleep here.
 */
create table registration_participants (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenants(id) on delete cascade,
  registration_id uuid not null references registrations(id) on delete cascade,
  meal_id         uuid references event_meals(id) on delete cascade,
  full_name       text not null,
  is_child        boolean not null default false,
  meal_choice     text,
  sort            int not null default 0
);

create index on registration_participants (registration_id, sort);

-- ---------------------------------------------------------------- counting

/**
 * Seats already taken for a meal. Counts only registrations that still
 * stand — a cancelled one must release its seats immediately, or a full
 * shabbat stays full after someone drops out.
 */
create or replace function meal_seats_taken(p_meal uuid)
returns int language sql stable as $$
  select coalesce(sum(i.qty * t.seats), 0)::int
    from registration_items i
    join registrant_types t on t.id = i.type_id
    join registrations r    on r.id = i.registration_id
   where i.meal_id = p_meal
     and r.state in ('pending', 'confirmed')
$$;

create or replace function meal_seats_left(p_meal uuid)
returns int language sql stable as $$
  select case
    when m.capacity is null then 2147483647       -- unlimited
    else greatest(m.capacity - meal_seats_taken(m.id), 0)
  end
  from event_meals m where m.id = p_meal
$$;

create or replace function next_registration_code(p_tenant uuid, p_event uuid)
returns text language plpgsql as $$
declare n int;
begin
  select count(*) + 1 into n from registrations
   where tenant_id = p_tenant and event_id = p_event;
  return 'R-' || lpad(n::text, 4, '0');
end $$;

-- ---------------------------------------------------------------- rls

alter table events                    enable row level security;
alter table event_meals               enable row level security;
alter table registrant_types          enable row level security;
alter table registrations             enable row level security;
alter table registration_items        enable row level security;
alter table registration_participants enable row level security;

-- The public may see an event and what it costs, but never who registered.
create policy events_read_public on events
  for select using (is_open);
create policy events_write on events
  for all using (app_can(tenant_id, 'staff')) with check (app_can(tenant_id, 'staff'));

create policy meals_read_public on event_meals for select using (true);
create policy meals_write on event_meals
  for all using (app_can(tenant_id, 'staff')) with check (app_can(tenant_id, 'staff'));

create policy types_read_public on registrant_types for select using (true);
create policy types_write on registrant_types
  for all using (app_can(tenant_id, 'staff')) with check (app_can(tenant_id, 'staff'));

-- No anonymous read on any registration table. A guest follows their own
-- registration through a token-scoped function, exactly like orders.
create policy regs_read_staff on registrations
  for select using (app_can(tenant_id, 'staff'));
create policy regs_write_staff on registrations
  for all using (app_can(tenant_id, 'staff')) with check (app_can(tenant_id, 'staff'));

create policy reg_items_staff on registration_items
  for all using (app_can(tenant_id, 'staff')) with check (app_can(tenant_id, 'staff'));
create policy reg_parts_staff on registration_participants
  for all using (app_can(tenant_id, 'staff')) with check (app_can(tenant_id, 'staff'));

-- ---------------------------------------------------------------- register

/**
 * Register for an event, as a guest.
 *
 * Same shape as place_order and for the same reason: the caller is not
 * signed in, so prices are rebuilt from registrant_types and capacity is
 * re-checked inside the writing transaction. Two people taking the last two
 * seats at the same moment cannot both succeed — the seat check and the
 * insert share one transaction, and the row lock on the meal serialises them.
 */
create or replace function place_registration(
  p_tenant      uuid,
  p_event       uuid,
  p_name        text,
  p_email       text,
  p_phone       text,
  p_nationality text,
  p_notes       text,
  p_lines       jsonb,   -- [{type_id, qty}]
  p_participants jsonb,  -- [{meal_id, full_name, is_child, meal_choice}]
  p_donation    numeric
)
returns table (registration_id uuid, registration_code text, track_token text, total numeric)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event   events%rowtype;
  v_line    jsonb;
  v_type    registrant_types%rowtype;
  v_meal    event_meals%rowtype;
  v_qty     int;
  v_total   numeric(10,2) := 0;
  v_seats   jsonb := '{}'::jsonb;   -- meal_id -> seats requested
  v_key     text;
  v_id      uuid;
  v_code    text;
  v_token   text;
  v_part    jsonb;
begin
  select * into v_event from events
   where id = p_event and tenant_id = p_tenant;
  if not found then raise exception 'UNKNOWN_EVENT'; end if;
  if not v_event.is_open then raise exception 'CLOSED'; end if;

  if jsonb_array_length(coalesce(p_lines, '[]'::jsonb)) = 0 then
    raise exception 'NOTHING_SELECTED';
  end if;

  -- Lock the meals involved so concurrent registrations queue behind us.
  perform 1 from event_meals
   where event_id = p_event and tenant_id = p_tenant
   for update;

  for v_line in select * from jsonb_array_elements(p_lines) loop
    v_qty := greatest(coalesce((v_line->>'qty')::int, 0), 0);
    if v_qty = 0 then continue; end if;

    select * into v_type from registrant_types
     where id = (v_line->>'type_id')::uuid and tenant_id = p_tenant;
    if not found then raise exception 'UNKNOWN_TYPE'; end if;
    if v_qty > v_type.max_per_registration then raise exception 'TOO_MANY'; end if;

    select * into v_meal from event_meals
     where id = v_type.meal_id and event_id = p_event;
    if not found then raise exception 'TYPE_NOT_IN_EVENT'; end if;
    if not v_meal.is_open then raise exception 'MEAL_CLOSED:%', v_meal.name->>'he'; end if;

    v_key := v_meal.id::text;
    v_seats := jsonb_set(
      v_seats, array[v_key],
      to_jsonb(coalesce((v_seats->>v_key)::int, 0) + v_qty * v_type.seats),
      true
    );

    v_total := v_total + v_type.price_ils * v_qty;
  end loop;

  -- Capacity, checked after totalling so one request cannot overshoot by
  -- spreading the same meal across several lines.
  for v_key in select jsonb_object_keys(v_seats) loop
    if meal_seats_left(v_key::uuid) < (v_seats->>v_key)::int then
      select * into v_meal from event_meals where id = v_key::uuid;
      raise exception 'FULL:%', v_meal.name->>'he';
    end if;
  end loop;

  v_total := v_total + greatest(coalesce(p_donation, 0), 0);
  v_code  := next_registration_code(p_tenant, p_event);
  v_token := encode(gen_random_bytes(16), 'hex');

  insert into registrations (
    tenant_id, event_id, code, full_name, email, phone,
    nationality, notes, total_ils, donation_ils, track_token
  ) values (
    p_tenant, p_event, v_code, p_name, nullif(trim(coalesce(p_email,'')),''), p_phone,
    nullif(trim(coalesce(p_nationality,'')),''), nullif(trim(coalesce(p_notes,'')),''),
    v_total, greatest(coalesce(p_donation,0),0), v_token
  )
  returning id into v_id;

  for v_line in select * from jsonb_array_elements(p_lines) loop
    v_qty := greatest(coalesce((v_line->>'qty')::int, 0), 0);
    if v_qty = 0 then continue; end if;
    select * into v_type from registrant_types where id = (v_line->>'type_id')::uuid;

    insert into registration_items (
      tenant_id, registration_id, meal_id, type_id, qty, unit_price_ils, line_total_ils
    ) values (
      p_tenant, v_id, v_type.meal_id, v_type.id, v_qty,
      v_type.price_ils, v_type.price_ils * v_qty
    );
  end loop;

  for v_part in select * from jsonb_array_elements(coalesce(p_participants, '[]'::jsonb)) loop
    if coalesce(trim(v_part->>'full_name'), '') = '' then continue; end if;
    insert into registration_participants (
      tenant_id, registration_id, meal_id, full_name, is_child, meal_choice
    ) values (
      p_tenant, v_id,
      nullif(v_part->>'meal_id','')::uuid,
      trim(v_part->>'full_name'),
      coalesce((v_part->>'is_child')::boolean, false),
      nullif(trim(coalesce(v_part->>'meal_choice','')), '')
    );
  end loop;

  return query select v_id, v_code, v_token, v_total;
end $$;

revoke all on function place_registration(uuid, uuid, text, text, text, text, text,
  jsonb, jsonb, numeric) from public;

/** What a registrant may see about their own registration. */
create or replace function registration_tracking(p_token text)
returns table (
  code text, state registration_state, event_title jsonb,
  starts_on date, ends_on date, total_ils numeric, paid_at timestamptz,
  lines jsonb
)
language sql stable security definer set search_path = public as $$
  select r.code, r.state, e.title, e.starts_on, e.ends_on, r.total_ils, r.paid_at,
         (select jsonb_agg(jsonb_build_object(
                   'meal', m.name->>'he',
                   'type', t.name->>'he',
                   'qty',  i.qty,
                   'line', i.line_total_ils))
            from registration_items i
            join registrant_types t on t.id = i.type_id
            join event_meals m      on m.id = i.meal_id
           where i.registration_id = r.id)
    from registrations r
    join events e on e.id = r.event_id
   where r.track_token = p_token
$$;

revoke all on function registration_tracking(text) from public;
grant execute on function registration_tracking(text) to anon, authenticated;

-- ============ supabase/migrations/0008_content.sql ============

-- 0008_content.sql — gallery, the about section, articles and their comments.

create type media_kind    as enum ('photo','video');
create type comment_state as enum ('pending','approved','rejected');

-- ---------------------------------------------------------------- gallery

create table media_items (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references tenants(id) on delete cascade,
  kind       media_kind not null default 'photo',

  /** A photo lives in storage. A video is a link to YouTube or Vimeo —
   *  hosting video on Supabase would be expensive and slow to serve into
   *  Sri Lanka, and every phone already plays an embed. */
  storage_path text,
  external_url text,
  /** Still frame for a video, so the grid is not a row of grey boxes. */
  poster_path  text,

  caption    jsonb not null default '{}'::jsonb,
  album      text  not null default 'general',
  taken_on   date,

  sort       int not null default 0,
  is_active  boolean not null default true,
  /** Shown in the strip on the home page, not only in the full gallery. */
  is_featured boolean not null default false,

  width_px   int,
  height_px  int,
  bytes      int,
  created_at timestamptz not null default now(),

  constraint photo_needs_file  check (kind <> 'photo' or storage_path is not null),
  constraint video_needs_link  check (kind <> 'video' or external_url is not null)
);

create index on media_items (tenant_id, album, sort) where is_active;
create index on media_items (tenant_id, sort) where is_active and is_featured;

-- ---------------------------------------------------------------- about

/**
 * One row per tenant. A table rather than a settings blob so the two
 * portraits get real columns — they are uploaded and deleted like any other
 * file and should not be buried in JSON.
 */
create table site_about (
  tenant_id  uuid primary key references tenants(id) on delete cascade,
  heading    jsonb not null default '{}'::jsonb,
  body       jsonb not null default '{}'::jsonb,   -- {he, en}, plain paragraphs

  shluchim_path    text,
  shluchim_caption jsonb not null default '{}'::jsonb,
  rebbe_path       text,
  rebbe_caption    jsonb not null default '{}'::jsonb,

  updated_at timestamptz not null default now()
);

create trigger t_about_touch before update on site_about
  for each row execute function touch_updated_at();

-- ---------------------------------------------------------------- articles

create table articles (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references tenants(id) on delete cascade,
  slug       text not null,

  title      jsonb not null,
  excerpt    jsonb not null default '{}'::jsonb,
  /** Markdown. Rendered to a restricted subset — see the renderer. */
  body       jsonb not null default '{}'::jsonb,

  cover_path text,
  read_minutes int not null default 4,

  is_published boolean not null default false,
  published_at timestamptz,
  sort       int not null default 0,

  /** Comments can be switched off per article. */
  comments_open boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (tenant_id, slug)
);

create index on articles (tenant_id, published_at desc) where is_published;

create trigger t_articles_touch before update on articles
  for each row execute function touch_updated_at();

create table article_comments (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references tenants(id) on delete cascade,
  article_id uuid not null references articles(id) on delete cascade,

  author_name  text not null,
  author_email text,
  body         text not null,

  /**
   * Nothing appears on the site until a human approves it. An open comment
   * box on a Chabad house site is a spam magnet, and the shliach should
   * never have to discover that from a visitor.
   */
  state      comment_state not null default 'pending',
  /** Staff may correct a typo or trim abuse; the original is kept so an
   *  edit can be shown to be an edit rather than a silent rewrite. */
  edited_body text,
  edited_at   timestamptz,

  created_at timestamptz not null default now(),

  constraint body_not_empty check (length(trim(body)) > 0)
);

create index on article_comments (article_id, created_at desc);
create index on article_comments (tenant_id, state) where state = 'pending';

/** What the public sees: the edited text when staff changed it. */
create or replace function comment_display_body(c article_comments)
returns text language sql immutable as $$
  select coalesce(c.edited_body, c.body)
$$;

-- ---------------------------------------------------------------- rls

alter table media_items      enable row level security;
alter table site_about       enable row level security;
alter table articles         enable row level security;
alter table article_comments enable row level security;

create policy media_read_public on media_items for select using (is_active);
create policy media_write on media_items
  for all using (app_can(tenant_id, 'staff')) with check (app_can(tenant_id, 'staff'));

create policy about_read_public on site_about for select using (true);
create policy about_write on site_about
  for all using (app_can(tenant_id, 'admin')) with check (app_can(tenant_id, 'admin'));

create policy articles_read_public on articles for select using (is_published);
create policy articles_write on articles
  for all using (app_can(tenant_id, 'staff')) with check (app_can(tenant_id, 'staff'));

-- Only approved comments are readable by anyone; pending ones are staff-only.
create policy comments_read_public on article_comments
  for select using (state = 'approved');
create policy comments_manage on article_comments
  for all using (app_can(tenant_id, 'staff')) with check (app_can(tenant_id, 'staff'));

-- ---------------------------------------------------------------- storage

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('content', 'content', true, 10485760,
        array['image/jpeg','image/png','image/webp','image/avif'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy content_images_read on storage.objects
  for select using (bucket_id = 'content');

create policy content_images_write on storage.objects
  for insert to authenticated
  with check (bucket_id = 'content'
    and public.app_can(((storage.foldername(name))[1])::uuid, 'staff'));

create policy content_images_update on storage.objects
  for update to authenticated
  using (bucket_id = 'content'
    and public.app_can(((storage.foldername(name))[1])::uuid, 'staff'));

create policy content_images_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'content'
    and public.app_can(((storage.foldername(name))[1])::uuid, 'staff'));

-- ---------------------------------------------------------------- comment submission

/**
 * Leave a comment, as a guest.
 *
 * Runs as definer because the caller is anonymous and RLS would block the
 * insert. It can only ever create a 'pending' row — the state is set here,
 * not taken from the caller — so a forged request cannot self-approve.
 */
create or replace function post_comment(
  p_tenant  uuid,
  p_article uuid,
  p_name    text,
  p_email   text,
  p_body    text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_article articles%rowtype;
  v_recent  int;
  v_id      uuid;
begin
  select * into v_article from articles
   where id = p_article and tenant_id = p_tenant and is_published;
  if not found then raise exception 'UNKNOWN_ARTICLE'; end if;
  if not v_article.comments_open then raise exception 'COMMENTS_CLOSED'; end if;

  if length(trim(coalesce(p_body, ''))) < 2 then raise exception 'EMPTY'; end if;
  if length(p_body) > 2000 then raise exception 'TOO_LONG'; end if;

  -- Crude flood guard: a handful per article per hour from one name.
  select count(*) into v_recent from article_comments
   where article_id = p_article
     and author_name = trim(p_name)
     and created_at > now() - interval '1 hour';
  if v_recent >= 3 then raise exception 'TOO_MANY'; end if;

  insert into article_comments (tenant_id, article_id, author_name, author_email, body)
  values (p_tenant, p_article, trim(p_name),
          nullif(trim(coalesce(p_email,'')),''), trim(p_body))
  returning id into v_id;

  return v_id;
end $$;

revoke all on function post_comment(uuid, uuid, text, text, text) from public;

-- ============ supabase/seed.sql ============

-- seed.sql — the Arugam Bay tenant, its settings, hours, and a starting menu.
-- Run ONCE, after the migrations. Safe to re-run: everything upserts.

-- Keep this in step with TENANT_ID in src/lib/config.ts.
insert into tenants (id, slug, name, timezone, country_code, is_israel,
                     latitude, longitude, elevation_m)
values ('00000000-0000-0000-0000-000000000001', 'arugam-bay',
        '{"he":"בית חב״ד ארוגם ביי","en":"Chabad of Arugam Bay"}'::jsonb,
        'Asia/Colombo', 'LK', false, 6.8404, 81.8353, 0)
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
