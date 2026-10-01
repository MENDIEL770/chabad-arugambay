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
