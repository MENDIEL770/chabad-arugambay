-- 0024_kosher.sql — the kosher product guide for Sri Lanka.
--
-- ASCII only: Hebrew in a .sql file on this project has been corrupted by a
-- clipboard round-trip before. All wording is written through the admin.

-- Guarded: Postgres has no "create type if not exists", and Supabase runs
-- the editor buffer in one transaction, so a second run would roll back
-- everything after this line.
do $$ begin
  create type kosher_status as enum ('kosher', 'not_kosher', 'check');
exception when duplicate_object then null; end $$;

/**
 * Groups on the public page: dairy, snacks, drinks, cleaning, and so on.
 *
 * A table rather than an enum because the shliach adds groups as the
 * shelves in Sri Lanka change, and an enum needs a migration to extend.
 */
create table if not exists kosher_categories (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references tenants(id) on delete cascade,

  name       jsonb not null,                       -- {he, en}
  icon       text not null default 'dish',
  sort       int  not null default 0,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists kosher_categories_sorted
  on kosher_categories (tenant_id, sort) where is_active;

/**
 * One product.
 *
 * `status` is the point of the page. A traveller standing in a supermarket
 * needs to know what to avoid as much as what to buy, so "not kosher" and
 * "needs checking" are first-class answers rather than absences — an empty
 * search result cannot tell those apart from "nobody has looked yet".
 */
create table if not exists kosher_products (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  category_id uuid references kosher_categories(id) on delete set null,

  name        jsonb not null,                      -- {he, en}
  brand       text,
  status      kosher_status not null default 'check',

  /** Which hechsher, or why it is accepted without one. */
  certification text,
  /** pareve / dairy / meat, free text so a local note can be written. */
  kosher_type text,

  /** Anything a shopper needs: a flavour that differs, a batch code. */
  notes       jsonb not null default '{}'::jsonb,  -- {he, en}
  /** Where it has actually been seen: Cargills, Keells, the Arugam shops. */
  where_to_buy text,

  barcode     text,
  image_path  text,

  /**
   * When the ruling was last confirmed. A kosher guide that does not say
   * how old it is invites someone to rely on a four-year-old answer about a
   * product whose formula has changed since.
   */
  verified_on date,

  sort        int not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists kosher_products_browse
  on kosher_products (tenant_id, category_id, sort) where is_active;

/** Barcodes are the fast path when someone scans in a shop. */
create index if not exists kosher_products_barcode
  on kosher_products (tenant_id, barcode) where barcode is not null;

drop trigger if exists t_kosher_touch on kosher_products;
create trigger t_kosher_touch before update on kosher_products
  for each row execute function touch_updated_at();

-- ------------------------------------------------------------------- rls

alter table kosher_categories enable row level security;
alter table kosher_products   enable row level security;

drop policy if exists kosher_cat_read on kosher_categories;
create policy kosher_cat_read on kosher_categories for select using (is_active);

drop policy if exists kosher_cat_write on kosher_categories;
create policy kosher_cat_write on kosher_categories
  for all using (app_can(tenant_id, 'staff')) with check (app_can(tenant_id, 'staff'));

drop policy if exists kosher_read on kosher_products;
create policy kosher_read on kosher_products for select using (is_active);

drop policy if exists kosher_write on kosher_products;
create policy kosher_write on kosher_products
  for all using (app_can(tenant_id, 'staff')) with check (app_can(tenant_id, 'staff'));
