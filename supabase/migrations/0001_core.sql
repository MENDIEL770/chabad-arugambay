-- 0001_core.sql — tenants, identity, roles, settings, audit.
-- Single-tenant in practice (Arugam Bay), multi-tenant-ready in schema:
-- every table carries tenant_id from day one.

create extension if not exists "pgcrypto";
create extension if not exists "postgis";

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
