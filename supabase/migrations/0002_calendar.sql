-- 0002_calendar.sql — Hebrew calendar + halachic times, precomputed per tenant.
-- Precomputed (not computed per request) so the shabbat generator, relative
-- event times, dynamic values, the public site and the restaurant's automatic
-- shabbat closing all read the same numbers, and so a mistake is correctable
-- by hand instead of by deploy.

create table tenant_zmanim (
  tenant_id       uuid not null references tenants(id) on delete cascade,
  date            date not null,                 -- civil date, tenant timezone

  hebrew_date     text not null,                 -- 'ל׳ אלול תשפ״ו'
  hebrew_date_en  text not null,                 -- '30 Elul 5786'
  parsha          jsonb,                         -- {he, en}; null midweek
  holiday         jsonb,                         -- {he, en}; null ordinary day

  -- day classification. Drives restaurant closing and form generation.
  is_shabbat      boolean not null default false,
  is_yomtov       boolean not null default false,
  is_chol_hamoed  boolean not null default false,
  is_fast         boolean not null default false,
  is_rosh_chodesh boolean not null default false,
  -- second night of yom tov / motzaei shabbat into yom tov: candles are lit
  -- from an existing flame, and not before nightfall.
  from_existing_flame boolean not null default false,

  -- times, stored as timestamptz (absolute instants, rendered in tenant tz)
  alos            timestamptz,   -- 16.9deg  (Baal HaTanya)
  sunrise         timestamptz,   -- visible / mishor
  sunrise_baal    timestamptz,   -- 1.583deg below horizon
  sof_zman_shma   timestamptz,
  sof_zman_tfila  timestamptz,
  chatzos         timestamptz,
  mincha_gedola   timestamptz,
  mincha_ketana   timestamptz,
  plag_hamincha   timestamptz,
  sunset          timestamptz,   -- visible
  sunset_baal     timestamptz,   -- 1.583deg
  tzeis           timestamptz,   -- 6deg + tzeis_extra_min
  candle_lighting timestamptz,   -- visible sunset - candle_offset_min
  havdalah        timestamptz,   -- end of shabbat / yom tov

  source          i18n_source not null default 'computed',
  note            text,
  updated_at      timestamptz not null default now(),

  primary key (tenant_id, date)
);

create index on tenant_zmanim (tenant_id, date) where is_shabbat or is_yomtov;

create trigger t_tenant_zmanim_touch before update on tenant_zmanim
  for each row execute function touch_updated_at();

comment on table tenant_zmanim is
  'Precedence when writing: manual > imported > computed. A recompute must
   never overwrite a row whose source is manual.';

-- Guard the precedence rule in the database, not only in application code.
create or replace function zmanim_respect_precedence()
returns trigger language plpgsql as $$
begin
  if old.source = 'manual' and new.source = 'computed' then
    return old;  -- silently keep the hand-entered row
  end if;
  if old.source = 'imported' and new.source = 'computed' then
    return old;
  end if;
  return new;
end $$;

create trigger t_zmanim_precedence before update on tenant_zmanim
  for each row execute function zmanim_respect_precedence();
