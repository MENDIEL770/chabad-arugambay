-- 0019_happening_days.sql — a class can meet on more than one day, and a
-- notice can carry a poster.
--
-- ASCII only: Hebrew in a .sql file on this project has been corrupted by a
-- clipboard round-trip before.

-- ------------------------------------------------------------- many days

/**
 * A shiur that meets Sunday and Wednesday was two rows before this, which
 * meant editing it twice and getting it wrong once.
 */
alter table happenings add column if not exists weekdays int[] not null default '{}';

-- Carry the single day across before the old column goes.
update happenings
   set weekdays = array[weekday]
 where weekday is not null
   and cardinality(weekdays) = 0;

-- The old constraints name the column being dropped, so they go first.
alter table happenings drop constraint if exists weekly_needs_weekday;
alter table happenings drop constraint if exists monthly_needs_weekday;
alter table happenings drop column if exists weekday;

alter table happenings drop constraint if exists weekly_needs_days;
alter table happenings
  add constraint weekly_needs_days
  check (cycle <> 'weekly' or cardinality(weekdays) > 0);

alter table happenings drop constraint if exists monthly_needs_days;
alter table happenings
  add constraint monthly_needs_days
  check (cycle <> 'monthly' or (cardinality(weekdays) > 0 and week_of_month is not null));

-- 0 = Sunday through 6 = Saturday, the way JavaScript and Postgres both
-- count. An out-of-range day would silently never match.
alter table happenings drop constraint if exists weekdays_in_range;
alter table happenings
  add constraint weekdays_in_range
  check (weekdays <@ array[0,1,2,3,4,5,6]);

-- ---------------------------------------------------------------- poster

/**
 * A flyer for a farbrengen or an announcement. Lives in the shared
 * 'content' bucket alongside the gallery, so one storage policy covers it.
 */
alter table happenings add column if not exists image_path text;
