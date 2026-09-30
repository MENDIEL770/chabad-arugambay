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
