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
