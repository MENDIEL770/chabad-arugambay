-- 0021_reports.sql — sales reporting over the order snapshots.
--
-- ASCII only: Hebrew in a .sql file on this project has been corrupted by a
-- clipboard round-trip before.

/**
 * Which orders count as business done.
 *
 * Rejected and cancelled are excluded everywhere. Everything else counts,
 * including orders still in the kitchen: a report run at 8pm that ignores
 * the twelve tickets on the pass is wrong about tonight, and tonight is
 * exactly when someone looks.
 */
create or replace function report_counts(p_status order_status)
returns boolean language sql immutable as $$
  select p_status not in ('cancelled', 'rejected')
$$;

/**
 * Headline numbers for a date range.
 *
 * Dates are order_date, which the table already stores in Asia/Colombo.
 * Deriving them from created_at would bucket a 1am order into the previous
 * day in UTC — the same timezone fault that once put every chag a day
 * early on this project.
 */
create or replace function report_summary(
  p_tenant uuid,
  p_from   date,
  p_to     date
)
returns table (
  orders        bigint,
  revenue_lkr   bigint,
  avg_order_lkr int,
  items_sold    bigint,
  delivery_lkr  bigint,
  cancelled     bigint,
  unpaid_lkr    bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with scoped as (
    select * from orders
     where tenant_id = p_tenant
       and order_date between p_from and p_to
  )
  select
    count(*) filter (where report_counts(status)),
    coalesce(sum(total_lkr) filter (where report_counts(status)), 0),
    coalesce(
      (sum(total_lkr) filter (where report_counts(status))
       / nullif(count(*) filter (where report_counts(status)), 0))::int,
      0),
    coalesce((
      select sum((i->>'qty')::int)
        from scoped s2, jsonb_array_elements(s2.items) i
       where report_counts(s2.status)
    ), 0),
    coalesce(sum(delivery_fee_lkr) filter (where report_counts(status)), 0),
    count(*) filter (where not report_counts(status)),
    -- Money still owed: placed, not cancelled, and never marked paid.
    coalesce(sum(total_lkr) filter (
      where report_counts(status) and pay_status in ('unpaid', 'cod_pending')
    ), 0)
  from scoped;
$$;

/** One row per day, for the chart and the spreadsheet. */
create or replace function report_by_day(
  p_tenant uuid,
  p_from   date,
  p_to     date
)
returns table (day date, orders bigint, revenue_lkr bigint)
language sql
stable
security definer
set search_path = public
as $$
  -- Left join off a generated series so a day with no orders is a zero row
  -- rather than a gap. A chart that silently skips quiet days makes a bad
  -- week look like a good one.
  select d::date,
         count(o.id),
         coalesce(sum(o.total_lkr), 0)
    from generate_series(p_from, p_to, interval '1 day') d
    left join orders o
      on o.tenant_id = p_tenant
     and o.order_date = d::date
     and report_counts(o.status)
   group by d
   order by d;
$$;

/**
 * What actually sold, by dish.
 *
 * Read out of the JSONB snapshot rather than joined to menu_items on
 * purpose: the snapshot is what the customer was charged for, and a dish
 * renamed or deleted since must still appear in last month's report under
 * the name it was sold as.
 */
create or replace function report_by_dish(
  p_tenant uuid,
  p_from   date,
  p_to     date
)
returns table (dish text, qty bigint, revenue_lkr bigint, orders bigint)
language sql
stable
security definer
set search_path = public
as $$
  select i->>'name',
         sum((i->>'qty')::int),
         sum((i->>'line_total')::int),
         count(distinct o.id)
    from orders o, jsonb_array_elements(o.items) i
   where o.tenant_id = p_tenant
     and o.order_date between p_from and p_to
     and report_counts(o.status)
   group by i->>'name'
   order by sum((i->>'line_total')::int) desc;
$$;

/** Delivery vs pickup vs dine-in, and payment method. */
create or replace function report_by_split(
  p_tenant uuid,
  p_from   date,
  p_to     date
)
returns table (kind text, label text, orders bigint, revenue_lkr bigint)
language sql
stable
security definer
set search_path = public
as $$
  select 'fulfillment', fulfillment::text, count(*), coalesce(sum(total_lkr), 0)
    from orders
   where tenant_id = p_tenant and order_date between p_from and p_to
     and report_counts(status)
   group by fulfillment
  union all
  select 'payment', pay_method::text, count(*), coalesce(sum(total_lkr), 0)
    from orders
   where tenant_id = p_tenant and order_date between p_from and p_to
     and report_counts(status)
   group by pay_method
  union all
  select 'channel', channel::text, count(*), coalesce(sum(total_lkr), 0)
    from orders
   where tenant_id = p_tenant and order_date between p_from and p_to
     and report_counts(status)
   group by channel;
$$;

/**
 * Orders by hour of day, so staffing can follow demand.
 *
 * created_at is the right column here, converted to the tenant's zone:
 * the question is what time of day people order, which order_date cannot
 * answer.
 */
create or replace function report_by_hour(
  p_tenant uuid,
  p_from   date,
  p_to     date
)
returns table (hour int, orders bigint, revenue_lkr bigint)
language sql
stable
security definer
set search_path = public
as $$
  select h::int,
         count(o.id),
         coalesce(sum(o.total_lkr), 0)
    from generate_series(0, 23) h
    left join orders o
      on o.tenant_id = p_tenant
     and o.order_date between p_from and p_to
     and report_counts(o.status)
     and extract(hour from (o.created_at at time zone 'Asia/Colombo')) = h
   group by h
   order by h;
$$;

-- Staff-only. These read every order in a range, including phone numbers'
-- worth of commercial detail, so no anonymous access.
revoke all on function report_summary(uuid, date, date)    from public, anon;
revoke all on function report_by_day(uuid, date, date)     from public, anon;
revoke all on function report_by_dish(uuid, date, date)    from public, anon;
revoke all on function report_by_split(uuid, date, date)   from public, anon;
revoke all on function report_by_hour(uuid, date, date)    from public, anon;
