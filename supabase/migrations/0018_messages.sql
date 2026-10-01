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

create type message_channel as enum ('whatsapp', 'email');

create table message_templates (
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

create trigger t_msg_templates_touch before update on message_templates
  for each row execute function touch_updated_at();

/**
 * Every message the system tried to send.
 *
 * Written whether or not the send succeeded, because the question asked
 * after a complaint is always "did we actually message them", and an empty
 * answer is indistinguishable from a provider outage without this.
 */
create table message_log (
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

create index on message_log (tenant_id, created_at desc);
create index on message_log (order_id) where order_id is not null;

-- ------------------------------------------------------------------- rls

alter table message_templates enable row level security;
alter table message_log       enable row level security;

-- Templates and the log are staff-only in both directions. Nothing here is
-- public: the log contains customer phone numbers.
create policy msg_templates_rw on message_templates
  for all using (app_can(tenant_id, 'staff')) with check (app_can(tenant_id, 'staff'));

create policy msg_log_read on message_log
  for select using (app_can(tenant_id, 'staff'));
