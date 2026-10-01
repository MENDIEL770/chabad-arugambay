-- 0022_meal_choices.sql — which dietary options a registration form offers.
--
-- ASCII only: Hebrew in a .sql file on this project has been corrupted by a
-- clipboard round-trip before. The labels live in the app.

/**
 * The default set, for every form the generator makes.
 *
 * An empty array means the question is not asked at all. Keys only -- the
 * wording is in src/lib/data/meal-choices.ts, which is also what stops a
 * key being offered that nothing downstream understands.
 */
alter table event_template
  add column if not exists meal_choices text[] not null default '{}';

/**
 * Per-meal override.
 *
 * NULL means inherit the template, which is different from an empty array:
 * empty is a deliberate "do not ask for this meal". Friday night may offer
 * a vegetarian plate while Shabbat lunch is a buffet where the question is
 * meaningless, and that distinction needs three states, not two.
 */
alter table event_meals
  add column if not exists meal_choices text[];

/** The answer a guest gave, already on registration_participants.meal_choice. */
create index if not exists participants_by_choice
  on registration_participants (registration_id)
  where meal_choice is not null;
