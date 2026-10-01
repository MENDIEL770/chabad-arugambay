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
