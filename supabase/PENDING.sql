-- Run both in the Supabase SQL Editor, then: npm run check:tables

-- ============================================================
-- 0016_travel.sql
-- ============================================================

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

-- ============================================================
-- 0017_event_template.sql
-- ============================================================

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
