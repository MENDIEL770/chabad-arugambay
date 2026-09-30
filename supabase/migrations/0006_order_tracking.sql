-- 0006_order_tracking.sql — let a customer follow their own order, safely.

/**
 * A separate, unguessable token for the tracking link.
 *
 * The order id is a uuid, but it travels in emails, WhatsApp messages and
 * kitchen tickets. Using it as the access key would mean anyone who ever saw
 * one — or who guesses — can read a customer's name, phone and address. The
 * token is generated per order, never printed on a ticket, and is the only
 * thing /order/<token> accepts.
 */
alter table orders
  add column if not exists track_token text not null
    default encode(gen_random_bytes(16), 'hex');

create unique index if not exists orders_track_token_key on orders (track_token);

/**
 * Exactly the fields a customer may see about their own order.
 *
 * Deliberately excludes address, notes and the phone number: the person
 * following the link already knows them, and a leaked link should not hand
 * them to anyone else. No policy on `orders` is added — the tracking route
 * reads through this function with the service key and returns nothing else.
 */
create or replace function order_tracking(p_token text)
returns table (
  code          text,
  status        order_status,
  fulfillment   fulfillment,
  eta_minutes   int,
  items         jsonb,
  total_lkr     int,
  pay_method    payment_method,
  pay_status    payment_status,
  created_at    timestamptz,
  timeline      jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  select o.code, o.status, o.fulfillment, o.eta_minutes, o.items,
         o.total_lkr, o.pay_method, o.pay_status, o.created_at, o.timeline
    from orders o
   where o.track_token = p_token
$$;

revoke all on function order_tracking(text) from public;
grant execute on function order_tracking(text) to anon, authenticated;

/**
 * Placing an order is done by a guest, so it cannot go through RLS as the
 * caller. It runs as definer and rebuilds every price from the menu table —
 * the client sends item ids and quantities only. A browser that posts its
 * own totals must not be able to set them.
 */
create or replace function place_order(
  p_tenant       uuid,
  p_channel      order_channel,
  p_fulfillment  fulfillment,
  p_name         text,
  p_phone        text,
  p_lang         lang_code,
  p_address      text,
  p_address_notes text,
  p_table_no     text,
  p_pay_method   payment_method,
  p_lines        jsonb,          -- [{item_id, qty, modifiers:[{id,state}], note}]
  p_lat          double precision,
  p_lng          double precision,
  p_delivery_fee int
)
returns table (order_id uuid, order_code text, track_token text, total int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_line     jsonb;
  v_item     menu_items%rowtype;
  v_qty      int;
  v_unit     int;
  v_delta    int;
  v_subtotal int := 0;
  v_snapshot jsonb := '[]'::jsonb;
  v_mods     jsonb;
  v_mod      jsonb;
  v_opt      item_modifier_options%rowtype;
  v_names    jsonb;
  v_total    int;
  v_id       uuid;
  v_code     text;
  v_token    text;
begin
  if jsonb_array_length(coalesce(p_lines, '[]'::jsonb)) = 0 then
    raise exception 'EMPTY_CART';
  end if;

  for v_line in select * from jsonb_array_elements(p_lines) loop
    v_qty := greatest(coalesce((v_line->>'qty')::int, 0), 0);
    if v_qty = 0 then continue; end if;
    if v_qty > 50 then raise exception 'QTY_TOO_LARGE'; end if;

    select * into v_item from menu_items
     where id = (v_line->>'item_id')::uuid and tenant_id = p_tenant;

    if not found then raise exception 'UNKNOWN_ITEM'; end if;
    -- The same rule the UI used, re-evaluated at the moment money is agreed.
    if not item_is_sellable(v_item) then
      raise exception 'SOLD_OUT:%', v_item.name->>'he';
    end if;

    v_unit  := v_item.price_lkr;
    v_delta := 0;
    v_names := '[]'::jsonb;
    v_mods  := coalesce(v_line->'modifiers', '[]'::jsonb);

    for v_mod in select * from jsonb_array_elements(v_mods) loop
      select o.* into v_opt
        from item_modifier_options o
        join item_modifier_groups g on g.id = o.group_id
       where o.id = (v_mod->>'id')::uuid
         and o.tenant_id = p_tenant
         and g.item_id = v_item.id;         -- an option from another dish is rejected

      if not found then raise exception 'UNKNOWN_MODIFIER'; end if;
      if not v_opt.is_available then raise exception 'MODIFIER_UNAVAILABLE'; end if;

      -- Removing or setting aside a default never changes the price.
      if (v_mod->>'state') in ('in', 'side') and not v_opt.is_default then
        v_delta := v_delta + v_opt.price_delta_lkr;
      end if;

      v_names := v_names || jsonb_build_object(
        'name', v_opt.name->>'he',
        'state', v_mod->>'state',
        'is_default', v_opt.is_default
      );
    end loop;

    v_subtotal := v_subtotal + (v_unit + v_delta) * v_qty;

    v_snapshot := v_snapshot || jsonb_build_object(
      'item_id',   v_item.id,
      'name',      v_item.name->>'he',
      'name_en',   v_item.name->>'en',
      'station',   v_item.station,
      'qty',       v_qty,
      'unit',      v_unit + v_delta,
      'line_total',(v_unit + v_delta) * v_qty,
      'modifiers', v_names,
      'note',      nullif(trim(coalesce(v_line->>'note', '')), '')
    );
  end loop;

  if v_subtotal = 0 then raise exception 'EMPTY_CART'; end if;

  v_total := v_subtotal + case when p_fulfillment = 'delivery'
                               then greatest(coalesce(p_delivery_fee, 0), 0)
                               else 0 end;
  v_code  := next_order_code(p_tenant);
  v_token := encode(gen_random_bytes(16), 'hex');

  insert into orders (
    tenant_id, code, channel, fulfillment, table_no,
    customer_name, customer_phone, customer_lang,
    address_text, address_notes, address_lat, address_lng,
    items, subtotal_lkr, delivery_fee_lkr, total_lkr,
    pay_method, pay_status, status, track_token, timeline
  ) values (
    p_tenant, v_code, p_channel, p_fulfillment, p_table_no,
    p_name, p_phone, p_lang,
    p_address, p_address_notes, p_lat, p_lng,
    v_snapshot, v_subtotal,
    case when p_fulfillment = 'delivery' then greatest(coalesce(p_delivery_fee,0),0) else 0 end,
    v_total,
    p_pay_method,
    case when p_pay_method in ('cash_lkr_to_driver','cash_lkr_at_counter')
         then 'cod_pending'::payment_status else 'unpaid'::payment_status end,
    'received', v_token,
    jsonb_build_array(jsonb_build_object('status','received','at', now()))
  )
  returning id into v_id;

  insert into order_events (tenant_id, order_id, type, payload, actor)
  values (p_tenant, v_id, 'placed', jsonb_build_object('channel', p_channel), 'customer');

  return query select v_id, v_code, v_token, v_total;
end $$;

revoke all on function place_order(uuid, order_channel, fulfillment, text, text,
  lang_code, text, text, text, payment_method, jsonb,
  double precision, double precision, int) from public;
