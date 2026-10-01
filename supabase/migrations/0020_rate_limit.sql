-- 0020_rate_limit.sql — an atomic throttle for the two public endpoints.
--
-- ASCII only: Hebrew in a .sql file on this project has been corrupted by a
-- clipboard round-trip before.

/**
 * One row per (bucket, key, window).
 *
 * The existing guard counts a phone's OPEN orders, which is a good rule but
 * not a throttle: it resets as soon as orders complete, and changing the
 * phone number sidesteps it entirely. This counts attempts per time window
 * and can be keyed on anything -- a hashed IP as well as a phone.
 *
 * The key is already hashed by the caller. A raw IP is personal data and
 * there is no reason for this table to hold one: the only question ever
 * asked of it is "how many times has this same caller tried", and a hash
 * answers that.
 */
create table if not exists rate_limit_hits (
  tenant_id    uuid not null references tenants(id) on delete cascade,
  bucket       text not null,
  key          text not null,
  window_start timestamptz not null,
  hits         int not null default 1,
  primary key (tenant_id, bucket, key, window_start)
);

create index if not exists rate_limit_sweep on rate_limit_hits (window_start);

alter table rate_limit_hits enable row level security;
-- No policy: only the security-definer function below touches this, and the
-- service role bypasses RLS. Nothing else has any business reading it.

/**
 * Count one attempt and say whether it is allowed.
 *
 * Insert-or-increment is a single statement, so two requests arriving at
 * the same instant cannot both read the old count and both decide they are
 * under the limit. The read-then-write check in the app could.
 *
 * Returns true when the caller may proceed.
 */
create or replace function bump_rate_limit(
  p_tenant     uuid,
  p_bucket     text,
  p_key        text,
  p_limit      int,
  p_window_sec int
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window timestamptz;
  v_hits   int;
begin
  if p_key is null or length(p_key) = 0 then
    -- Nothing to key on: allow rather than block. A missing header must not
    -- take ordering down.
    return true;
  end if;

  -- Fixed windows aligned to the epoch, so every caller shares the same
  -- boundaries and the window cannot be reset by timing a request.
  v_window := to_timestamp(floor(extract(epoch from now()) / p_window_sec) * p_window_sec);

  insert into rate_limit_hits (tenant_id, bucket, key, window_start, hits)
  values (p_tenant, p_bucket, p_key, v_window, 1)
  on conflict (tenant_id, bucket, key, window_start)
  do update set hits = rate_limit_hits.hits + 1
  returning hits into v_hits;

  -- Opportunistic sweep: a day of expired windows is plenty of history and
  -- this saves running a cron for one table.
  if random() < 0.01 then
    delete from rate_limit_hits where window_start < now() - interval '1 day';
  end if;

  return v_hits <= p_limit;
end
$$;

revoke all on function bump_rate_limit(uuid, text, text, int, int) from public, anon, authenticated;
