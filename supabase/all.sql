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

-- ============ supabase/migrations/0009_dish_photos.sql ============

-- 0009_dish_photos.sql — several photos per dish, not one.

create table menu_item_images (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references tenants(id) on delete cascade,
  item_id    uuid not null references menu_items(id) on delete cascade,

  storage_path text not null,
  alt          jsonb not null default '{}'::jsonb,

  sort       int not null default 0,
  width_px   int,
  height_px  int,
  bytes      int,
  created_at timestamptz not null default now()
);

create index on menu_item_images (item_id, sort);

alter table menu_item_images enable row level security;

-- Visible wherever the dish is visible.
create policy dish_images_read_public on menu_item_images
  for select using (
    exists (
      select 1 from menu_items i
      join menu_categories c on c.id = i.category_id
      where i.id = menu_item_images.item_id and c.is_active
    )
  );

create policy dish_images_write on menu_item_images
  for all using (app_can(tenant_id, 'staff'))
  with check (app_can(tenant_id, 'staff'));

/**
 * Carry the existing single photo over as the first image, so nothing that
 * was already uploaded disappears when the menu starts reading from here.
 * menu_items.image_path stays as the thumbnail for lists.
 */
insert into menu_item_images (tenant_id, item_id, storage_path, sort)
select tenant_id, id, image_path, 0
  from menu_items
 where image_path is not null
on conflict do nothing;

-- ============ supabase/migrations/0010_happenings.sql ============

-- 0010_happenings.sql — the noticeboard: classes, farbrengens, announcements.

create type happening_kind  as enum ('class','farbrengen','notice','event');
create type happening_cycle as enum ('once','weekly','monthly');

create table happenings (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references tenants(id) on delete cascade,

  kind       happening_kind  not null default 'class',
  cycle      happening_cycle not null default 'weekly',

  title      jsonb not null,
  details    jsonb not null default '{}'::jsonb,
  -- Free text such as "for men" or "whole family", written in the admin.
  -- Kept out of this file as a literal: Hebrew in a .sql is corrupted by a
  -- clipboard round-trip, which already happened once on this project.
  -- Free text such as "for men" or "whole family", written in the admin.
  -- Kept out of this file as a literal: Hebrew in a .sql is corrupted by a
  -- clipboard round-trip, which already happened once on this project.
  audience   jsonb not null default '{}'::jsonb,
  location   jsonb not null default '{}'::jsonb,

  /** weekly: 0=Sunday … 6=Saturday. Null for one-off. */
  weekday    int check (weekday between 0 and 6),
  /** monthly: nth weekday, e.g. 1 = first Tuesday. */
  week_of_month int check (week_of_month between 1 and 5),
  /** once: the actual date. */
  on_date    date,

  starts_at  time,
  ends_at    time,

  /**
   * Times that follow the sun rather than the clock: a class "after mincha"
   * moves every week. Stored as an offset from a zman so the board is right
   * without anyone editing it.
   */
  anchor     text,                                  -- 'candle_lighting' | 'sunset' | 'tzeis' | null
  anchor_offset_min int not null default 0,

  is_active  boolean not null default true,
  /** Paused for the season rather than deleted — Arugam Bay empties out
   *  between November and March and the classes come back. */
  paused_note jsonb not null default '{}'::jsonb,

  sort       int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint weekly_needs_weekday  check (cycle <> 'weekly'  or weekday is not null),
  constraint monthly_needs_weekday check (cycle <> 'monthly' or (weekday is not null and week_of_month is not null)),
  constraint once_needs_date       check (cycle <> 'once'    or on_date is not null),
  constraint has_a_time            check (starts_at is not null or anchor is not null)
);

create index on happenings (tenant_id, sort) where is_active;

create trigger t_happenings_touch before update on happenings
  for each row execute function touch_updated_at();

alter table happenings enable row level security;

create policy happenings_read_public on happenings for select using (is_active);
create policy happenings_write on happenings
  for all using (app_can(tenant_id, 'staff')) with check (app_can(tenant_id, 'staff'));

-- ============ supabase/migrations/0011_printing.sql ============

-- 0011_printing.sql — printers, the print queue, and the receipt template.

create type printer_kind      as enum ('receipt','kitchen','bar');
create type printer_transport as enum ('cloudprnt','agent','browser');
create type print_status      as enum ('queued','claimed','printed','failed');

create table printers (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references tenants(id) on delete cascade,

  name       text not null,
  kind       printer_kind not null default 'receipt',
  transport  printer_transport not null default 'browser',

  /**
   * Which stations this printer is responsible for. A kitchen printer by
   * the grill should not spit out the bar's drinks.
   */
  stations   text[] not null default '{}',

  paper_width int not null default 80 check (paper_width in (58, 80)),
  /** Shared secret a polling printer presents; never leaves the admin. */
  poll_token text not null default encode(gen_random_bytes(16), 'hex'),
  last_seen_at timestamptz,

  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index on printers (poll_token);
create index on printers (tenant_id) where is_active;

create table print_jobs (
  id         bigserial primary key,
  tenant_id  uuid not null references tenants(id) on delete cascade,
  printer_id uuid not null references printers(id) on delete cascade,
  order_id   uuid references orders(id) on delete cascade,

  template   text not null default 'receipt',
  /** Rendered lines, so a reprint is byte-identical to the original even
   *  after the menu or the template changes. */
  payload    jsonb not null,

  status     print_status not null default 'queued',
  attempts   int not null default 0,
  error      text,

  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  printed_at timestamptz
);

create index on print_jobs (printer_id, status, created_at);
create index on print_jobs (order_id);

/** Per-tenant receipt layout, edited in the admin with a live preview. */
create table receipt_template (
  tenant_id   uuid primary key references tenants(id) on delete cascade,

  -- Free text lines, e.g. the house name and address. Kept out of this file
  -- as literals: Hebrew in a .sql is corrupted by a clipboard round-trip.
  header_lines jsonb not null default '[]'::jsonb,
  footer_lines jsonb not null default '[]'::jsonb,
  show_logo    boolean not null default true,
  show_qr      boolean not null default true,
  show_prices  boolean not null default true,
  /** Kitchen tickets deliberately omit money — a cook does not need it and
   *  it is one more thing to misread at speed. */
  kitchen_show_prices boolean not null default false,
  paper_width  int not null default 80 check (paper_width in (58, 80)),

  updated_at  timestamptz not null default now()
);

create trigger t_receipt_touch before update on receipt_template
  for each row execute function touch_updated_at();

alter table printers         enable row level security;
alter table print_jobs       enable row level security;
alter table receipt_template enable row level security;

create policy printers_staff on printers
  for all using (app_can(tenant_id, 'staff')) with check (app_can(tenant_id, 'staff'));
create policy jobs_staff on print_jobs
  for all using (app_can(tenant_id, 'kitchen')) with check (app_can(tenant_id, 'kitchen'));
create policy receipt_read_staff on receipt_template
  for select using (app_can(tenant_id, 'kitchen'));
create policy receipt_write on receipt_template
  for all using (app_can(tenant_id, 'staff')) with check (app_can(tenant_id, 'staff'));

/**
 * Hand the next queued job to a polling printer, exactly once.
 *
 * `for update skip locked` is what makes two printers polling the same
 * moment safe: each takes a different row instead of both taking the same
 * one and printing the order twice.
 */
create or replace function claim_print_job(p_token text)
returns table (job_id bigint, template text, payload jsonb)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_printer printers%rowtype;
  v_job     print_jobs%rowtype;
begin
  select * into v_printer from printers where poll_token = p_token and is_active;
  if not found then raise exception 'UNKNOWN_PRINTER'; end if;

  update printers set last_seen_at = now() where id = v_printer.id;

  select * into v_job
    from print_jobs
   where printer_id = v_printer.id and status = 'queued'
   order by created_at
   for update skip locked
   limit 1;

  if not found then return; end if;

  update print_jobs
     set status = 'claimed', claimed_at = now(), attempts = attempts + 1
   where id = v_job.id;

  return query select v_job.id, v_job.template, v_job.payload;
end $$;

revoke all on function claim_print_job(text) from public;

create or replace function confirm_print_job(p_token text, p_job bigint, p_ok boolean, p_error text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_printer printers%rowtype;
begin
  select * into v_printer from printers where poll_token = p_token and is_active;
  if not found then raise exception 'UNKNOWN_PRINTER'; end if;

  update print_jobs
     set status = case when p_ok then 'printed' else 'failed' end,
         printed_at = case when p_ok then now() else null end,
         error = p_error
   where id = p_job and printer_id = v_printer.id;
end $$;

revoke all on function confirm_print_job(text, bigint, boolean, text) from public;

-- Default template for the single tenant. Hebrew is inserted from the app on
-- first load, not from this file, for the encoding reason noted above.
insert into receipt_template (tenant_id)
select id from tenants
on conflict (tenant_id) do nothing;

-- ============ supabase/migrations/0012_site_text.sql ============

-- 0012_site_text.sql — editable copy for the public pages.

/**
 * Overrides, not storage.
 *
 * Every string also exists as a default in the code, so a missing row, an
 * unrun migration or a typo in a key can never leave a blank page. A row
 * here only replaces what the code already says.
 */
create table site_text (
  tenant_id  uuid not null references tenants(id) on delete cascade,
  key        text not null,
  value      jsonb not null,            -- {he, en}
  updated_at timestamptz not null default now(),
  primary key (tenant_id, key)
);

create trigger t_site_text_touch before update on site_text
  for each row execute function touch_updated_at();

alter table site_text enable row level security;

create policy site_text_read_public on site_text
  for select using (true);

create policy site_text_write on site_text
  for all using (app_can(tenant_id, 'staff'))
  with check (app_can(tenant_id, 'staff'));

-- ============ supabase/migrations/0013_receipt_media.sql ============

-- 0013_receipt_media.sql — logo and banner images on the printed receipt.

alter table receipt_template
  /** Small mark above the header lines. */
  add column if not exists logo_path text,
  /** Full-width banner at the very top, before the logo. */
  add column if not exists header_image_path text,
  /** Full-width banner at the very bottom, after the footer lines. */
  add column if not exists footer_image_path text;

/**
 * Receipt artwork lives in its own bucket.
 *
 * Separate from 'menu' so that a staff member who may edit dish photos
 * cannot necessarily alter what is printed on every receipt, and so the
 * size limit can be much smaller: a thermal printer renders 576 pixels
 * wide and anything larger is wasted bandwidth on every poll.
 */
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('receipt', 'receipt', true, 2097152,
        array['image/png','image/jpeg','image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy receipt_media_read on storage.objects
  for select using (bucket_id = 'receipt');

create policy receipt_media_write on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'receipt'
    and public.app_can(((storage.foldername(name))[1])::uuid, 'staff')
  );

create policy receipt_media_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'receipt'
    and public.app_can(((storage.foldername(name))[1])::uuid, 'staff')
  );

create policy receipt_media_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'receipt'
    and public.app_can(((storage.foldername(name))[1])::uuid, 'staff')
  );

-- ============ supabase/migrations/0014_pgcrypto_search_path.sql ============

-- 0014_pgcrypto_search_path.sql
--
-- Fixes: "function gen_random_bytes(integer) does not exist".
--
-- On Supabase, pgcrypto is installed into the `extensions` schema, not
-- `public`. Every security-definer function here declares
-- `set search_path = public` — which is the right instinct, since a mutable
-- search_path on a definer function is a privilege-escalation route — but it
-- also hides gen_random_bytes from them.
--
-- The column defaults have the same problem: a default is evaluated with the
-- search_path of whatever statement inserts the row, so an insert from
-- inside one of these functions could not resolve it either.
--
-- Both are fixed by naming the schema explicitly rather than widening the
-- search_path, which keeps the escalation protection intact.

-- ---------------------------------------------------------------- defaults

alter table orders
  alter column track_token
  set default encode(extensions.gen_random_bytes(16), 'hex');

alter table registrations
  alter column track_token
  set default encode(extensions.gen_random_bytes(16), 'hex');

alter table printers
  alter column poll_token
  set default encode(extensions.gen_random_bytes(16), 'hex');

-- ---------------------------------------------------------------- functions
--
-- Rewritten with the schema-qualified call. Everything else is unchanged;
-- only the gen_random_bytes line differs.

create or replace function place_registration(
  p_tenant       uuid,
  p_event        uuid,
  p_name         text,
  p_email        text,
  p_phone        text,
  p_nationality  text,
  p_notes        text,
  p_lines        jsonb,
  p_participants jsonb,
  p_donation     numeric
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
  v_total   numeric := 0;
  v_id      uuid;
  v_code    text;
  v_token   text;
  v_person  jsonb;
begin
  select * into v_event from events
   where id = p_event and tenant_id = p_tenant;
  if not found then raise exception 'UNKNOWN_EVENT'; end if;
  if not v_event.is_open then raise exception 'CLOSED'; end if;

  if jsonb_array_length(coalesce(p_lines, '[]'::jsonb)) = 0 then
    raise exception 'NOTHING_SELECTED';
  end if;

  for v_line in select * from jsonb_array_elements(p_lines) loop
    v_qty := greatest(coalesce((v_line->>'qty')::int, 0), 0);
    if v_qty = 0 then continue; end if;
    if v_qty > 50 then raise exception 'TOO_MANY'; end if;

    select * into v_type from registrant_types
     where id = (v_line->>'type_id')::uuid and tenant_id = p_tenant;
    if not found then raise exception 'UNKNOWN_TYPE'; end if;

    select * into v_meal from event_meals
     where id = v_type.meal_id and event_id = p_event;
    if not found then raise exception 'UNKNOWN_TYPE'; end if;
    if not v_meal.is_open then
      raise exception 'MEAL_CLOSED:%', v_meal.name->>'he';
    end if;

    -- Capacity is checked here, inside the transaction that writes the
    -- row, so two people filling the last seat cannot both succeed.
    if v_meal.capacity is not null
       and meal_seats_taken(v_meal.id) + (v_qty * v_type.seats) > v_meal.capacity then
      raise exception 'FULL:%', v_meal.name->>'he';
    end if;

    v_total := v_total + (v_type.price_ils * v_qty);
  end loop;

  v_code  := next_registration_code(p_tenant, p_event);
  v_token := encode(extensions.gen_random_bytes(16), 'hex');

  insert into registrations (
    tenant_id, event_id, code, full_name, email, phone,
    nationality, notes, state, total_ils, donation_ils, track_token
  ) values (
    p_tenant, p_event, v_code, p_name, p_email, p_phone,
    p_nationality, p_notes, 'pending',
    v_total + coalesce(p_donation, 0), coalesce(p_donation, 0), v_token
  )
  returning id into v_id;

  for v_line in select * from jsonb_array_elements(p_lines) loop
    v_qty := greatest(coalesce((v_line->>'qty')::int, 0), 0);
    if v_qty = 0 then continue; end if;
    select * into v_type from registrant_types
     where id = (v_line->>'type_id')::uuid and tenant_id = p_tenant;

    insert into registration_items (
      tenant_id, registration_id, meal_id, type_id, qty,
      unit_price_ils, line_total_ils
    ) values (
      p_tenant, v_id, v_type.meal_id, v_type.id, v_qty,
      v_type.price_ils, v_type.price_ils * v_qty
    );
  end loop;

  for v_person in select * from jsonb_array_elements(coalesce(p_participants, '[]'::jsonb)) loop
    insert into registration_participants (
      tenant_id, registration_id, meal_id, full_name, is_child, meal_choice
    ) values (
      p_tenant, v_id,
      nullif(v_person->>'meal_id', '')::uuid,
      v_person->>'full_name',
      coalesce((v_person->>'is_child')::boolean, false),
      nullif(v_person->>'meal_choice', '')
    );
  end loop;

  return query select v_id, v_code, v_token, v_total + coalesce(p_donation, 0);
end $$;

revoke all on function place_registration(uuid, uuid, text, text, text, text, text,
  jsonb, jsonb, numeric) from public;

-- ============ supabase/migrations/0015_place_order.sql ============

-- 0015_place_order.sql
--
-- place_order, on its own and corrected.
--
-- Running 0006 as one file left the column and order_tracking() in place
-- but not this function. The reason was the revoke at the end: it listed
-- twelve argument types for a fourteen-argument function, so it failed —
-- and because the SQL editor runs the script in a transaction, the failed
-- revoke rolled the successful create back with it.
--
-- Two further corrections:
--   * gen_random_bytes is schema-qualified. pgcrypto lives in `extensions`
--     on Supabase and does not resolve under `search_path = public`, so the
--     first order would have failed at runtime even once created.
--   * p_lat and p_lng now default to null and sit last. The application
--     sends twelve named arguments; without defaults PostgREST finds no
--     matching function and reports it as missing.

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
  p_delivery_fee int,
  p_lat          double precision default null,
  p_lng          double precision default null
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
  v_token := encode(extensions.gen_random_bytes(16), 'hex');

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
  lang_code, text, text, text, payment_method, jsonb, int,
  double precision, double precision) from public;

-- ============ supabase/migrations/0016_travel.sql ============

-- 0016_travel.sql — places to stay and things to do, editable from the admin.

create type stay_tier as enum ('luxury','standard','backpacker','family');

create table stays (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references tenants(id) on delete cascade,

  name       text not null,
  blurb      jsonb not null default '{}'::jsonb,     -- {he, en}
  tiers      stay_tier[] not null default '{}',

  /** Indicative nightly rate, for sorting and for setting expectations. */
  nightly_usd int,
  walk_minutes int,

  /**
   * The affiliate destination.
   *
   * Stored whole rather than assembled from a hotel id and a partner id,
   * because every network formats these differently and a half-built URL
   * that silently earns nothing is worse than an obvious plain link.
   */
  booking_url text,
  /** Shown to visitors so the arrangement is not hidden from them. */
  is_affiliate boolean not null default false,

  image_path text,
  icon       text not null default 'bed',

  sort       int not null default 0,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),

  constraint affiliate_needs_url check (not is_affiliate or booking_url is not null)
);

create index on stays (tenant_id, sort) where is_active;

create table tips (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references tenants(id) on delete cascade,

  title      jsonb not null,
  body       jsonb not null default '{}'::jsonb,
  tags       text[] not null default '{}',
  icon       text not null default 'map',

  sort       int not null default 0,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

create index on tips (tenant_id, sort) where is_active;

alter table stays enable row level security;
alter table tips  enable row level security;

create policy stays_read_public on stays for select using (is_active);
create policy stays_write on stays
  for all using (app_can(tenant_id, 'staff')) with check (app_can(tenant_id, 'staff'));

create policy tips_read_public on tips for select using (is_active);
create policy tips_write on tips
  for all using (app_can(tenant_id, 'staff')) with check (app_can(tenant_id, 'staff'));

-- ============ supabase/migrations/0017_event_template.sql ============

-- 0017_event_template.sql — the default shape every generated form starts from.

/**
 * One row per tenant: the template the shabbat generator copies.
 *
 * Kept as JSON rather than as tables of template-meals and template-types
 * because nothing queries inside it — it is read whole when a form is
 * generated and written whole when the defaults are edited. Real meals and
 * real prices live in event_meals and registrant_types, where they can be
 * joined against registrations.
 */
create table event_template (
  tenant_id   uuid primary key references tenants(id) on delete cascade,

  intro       jsonb not null default '{}'::jsonb,   -- {he, en}

  /**
   * [{ key, name:{he,en}, sort, serves_offset_min, capacity,
   *    types:[{ name:{he,en}, kind, price, seats }] }]
   *
   * serves_offset_min is relative to candle lighting, so a meal keeps its
   * place in the evening as sunset moves through the year instead of
   * drifting against it.
   */
  meals       jsonb not null default '[]'::jsonb,

  /** Which fields the public form asks for. */
  ask_email        boolean not null default true,
  ask_nationality  boolean not null default true,
  ask_notes        boolean not null default true,
  ask_participants boolean not null default true,

  /** Suggested donation buttons, in shekels. */
  donation_amounts int[] not null default '{0,50,100,180,360}',

  /** How many forms the nightly generator keeps open ahead. */
  weeks_ahead      int not null default 24 check (weeks_ahead between 1 and 104),
  /** Registration closes this many hours before candle lighting. */
  closes_hours_before int not null default 24 check (closes_hours_before between 0 and 336),

  updated_at  timestamptz not null default now()
);

create trigger t_event_template_touch before update on event_template
  for each row execute function touch_updated_at();

alter table event_template enable row level security;

create policy event_template_read on event_template
  for select using (true);
create policy event_template_write on event_template
  for all using (app_can(tenant_id, 'staff'))
  with check (app_can(tenant_id, 'staff'));

insert into event_template (tenant_id)
select id from tenants
on conflict (tenant_id) do nothing;

-- ============ supabase/migrations/0018_messages.sql ============

-- 0018_messages.sql — outgoing message templates, and an image for a tip.
--
-- ASCII only. Hebrew in a .sql file on this project has been corrupted by a
-- clipboard round-trip before; the wording is seeded from the app instead.

-- ------------------------------------------------------------------ tips

alter table tips add column if not exists image_path text;

-- ------------------------------------------------------- message templates

/**
 * Which moment a message belongs to. The code looks these up by key, so a
 * template can be rewritten freely but not invented: a new key needs a send
 * site in the app to be any use.
 */
-- These names are the order statuses the app already uses, not a parallel
-- vocabulary. A translation layer between "dispatched" and "on_the_way"
-- would be one more place for the two to drift apart.
--
-- Guarded because Postgres has no "create type if not exists", and Supabase
-- runs the whole editor buffer in one transaction: a second run would fail
-- on this line and roll back everything after it, including migrations that
-- had never been applied.
do $$ begin
  create type message_event as enum (
    'order_received',      -- the customer just placed an order
    'order_accepted',      -- the kitchen took it
    'order_ready',         -- ready for pickup / handed to the courier
    'order_dispatched',    -- a courier has it
    'order_delivered',
    'order_rejected',
    'registration_received',  -- signed up for a Shabbat meal
    'registration_confirmed',
    'registration_reminder',  -- the day before
    'shabbat_times'           -- the weekly candle-lighting message
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type message_channel as enum ('whatsapp', 'email');
exception when duplicate_object then null; end $$;

create table if not exists message_templates (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references tenants(id) on delete cascade,

  event      message_event   not null,
  channel    message_channel not null default 'whatsapp',

  /**
   * Subject is email-only; WhatsApp has no such thing. Kept on the same row
   * rather than in a separate table because every other column is shared
   * and two tables would mean two editors.
   */
  subject    jsonb not null default '{}'::jsonb,   -- {he, en}
  body       jsonb not null default '{}'::jsonb,   -- {he, en}, with {{placeholders}}

  /**
   * Off by default. A template that exists is not the same as one the house
   * has decided to send, and switching the whole thing on by writing rows
   * would start messaging customers the moment the migration runs.
   */
  is_enabled boolean not null default false,

  /** Minutes to wait before sending. Zero is immediate. */
  delay_min  int not null default 0 check (delay_min between 0 and 10080),

  updated_at timestamptz not null default now(),

  unique (tenant_id, event, channel)
);

drop trigger if exists t_msg_templates_touch on message_templates;
create trigger t_msg_templates_touch before update on message_templates
  for each row execute function touch_updated_at();

/**
 * Every message the system tried to send.
 *
 * Written whether or not the send succeeded, because the question asked
 * after a complaint is always "did we actually message them", and an empty
 * answer is indistinguishable from a provider outage without this.
 */
create table if not exists message_log (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references tenants(id) on delete cascade,

  event      message_event   not null,
  channel    message_channel not null default 'whatsapp',

  to_addr    text not null,          -- phone in E.164, or an email address
  body       text not null,          -- after substitution, exactly what was sent

  -- Loose references: an order or registration may be deleted later and the
  -- record of having messaged someone should outlive it.
  order_id        uuid,
  registration_id uuid,

  ok          boolean not null,
  provider_id text,                  -- the provider's own message id
  error       text,

  created_at timestamptz not null default now()
);

create index if not exists message_log_recent on message_log (tenant_id, created_at desc);
create index if not exists message_log_by_order on message_log (order_id) where order_id is not null;

-- ------------------------------------------------------------------- rls

alter table message_templates enable row level security;
alter table message_log       enable row level security;

-- Templates and the log are staff-only in both directions. Nothing here is
-- public: the log contains customer phone numbers.
drop policy if exists msg_templates_rw on message_templates;
create policy msg_templates_rw on message_templates
  for all using (app_can(tenant_id, 'staff')) with check (app_can(tenant_id, 'staff'));

drop policy if exists msg_log_read on message_log;
create policy msg_log_read on message_log
  for select using (app_can(tenant_id, 'staff'));

-- ------------------------------------------------------- sanity

/**
 * The guarded create above skips silently when the type already exists.
 * That is what makes the script re-runnable, but it would also hide an
 * enum left over from an earlier draft with different labels — and a
 * missing label only shows up later as a failed insert during a real
 * order. Fail loudly here instead.
 */
do $$
declare missing text;
begin
  select string_agg(w, ', ') into missing
  from unnest(array[
    'order_received','order_accepted','order_ready','order_dispatched',
    'order_delivered','order_rejected','registration_received',
    'registration_confirmed','registration_reminder','shabbat_times'
  ]) as w
  where not exists (
    select 1 from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'message_event' and e.enumlabel = w
  );

  if missing is not null then
    raise exception
      'message_event is missing: %. Drop the type and re-run: drop type message_event cascade;',
      missing;
  end if;
end $$;

-- ============ supabase/migrations/0019_happening_days.sql ============

-- 0019_happening_days.sql — a class can meet on more than one day, and a
-- notice can carry a poster.
--
-- ASCII only: Hebrew in a .sql file on this project has been corrupted by a
-- clipboard round-trip before.

-- ------------------------------------------------------------- many days

/**
 * A shiur that meets Sunday and Wednesday was two rows before this, which
 * meant editing it twice and getting it wrong once.
 */
alter table happenings add column if not exists weekdays int[] not null default '{}';

-- Carry the single day across before the old column goes.
update happenings
   set weekdays = array[weekday]
 where weekday is not null
   and cardinality(weekdays) = 0;

-- The old constraints name the column being dropped, so they go first.
alter table happenings drop constraint if exists weekly_needs_weekday;
alter table happenings drop constraint if exists monthly_needs_weekday;
alter table happenings drop column if exists weekday;

alter table happenings drop constraint if exists weekly_needs_days;
alter table happenings
  add constraint weekly_needs_days
  check (cycle <> 'weekly' or cardinality(weekdays) > 0);

alter table happenings drop constraint if exists monthly_needs_days;
alter table happenings
  add constraint monthly_needs_days
  check (cycle <> 'monthly' or (cardinality(weekdays) > 0 and week_of_month is not null));

-- 0 = Sunday through 6 = Saturday, the way JavaScript and Postgres both
-- count. An out-of-range day would silently never match.
alter table happenings drop constraint if exists weekdays_in_range;
alter table happenings
  add constraint weekdays_in_range
  check (weekdays <@ array[0,1,2,3,4,5,6]);

-- ---------------------------------------------------------------- poster

/**
 * A flyer for a farbrengen or an announcement. Lives in the shared
 * 'content' bucket alongside the gallery, so one storage policy covers it.
 */
alter table happenings add column if not exists image_path text;

-- ============ supabase/seed.sql ============

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
