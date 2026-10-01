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
