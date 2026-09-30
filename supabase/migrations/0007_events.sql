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
