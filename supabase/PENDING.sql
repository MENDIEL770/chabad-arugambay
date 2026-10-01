-- Run in the Supabase SQL Editor, then: npm run check:tables
-- Safe to run more than once.

-- ============================================================
-- 0022_meal_choices.sql
-- ============================================================

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

-- ============================================================
-- 0023_receipt_formats.sql
-- ============================================================

-- 0023_receipt_formats.sql — accept AVIF on receipt artwork.
--
-- ASCII only: Hebrew in a .sql file on this project has been corrupted by a
-- clipboard round-trip before.

/**
 * The bucket's own allow-list rejected anything but PNG, JPEG and WebP, and
 * Storage refuses before the app ever sees the file. AVIF is what a modern
 * phone and most export tools produce now.
 *
 * SVG is deliberately NOT added. A thermal printer rasterises at 576px, so
 * vector art buys nothing, and an SVG served from a public bucket can carry
 * script. The app says so by name rather than refusing silently.
 */
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('receipt', 'receipt', true, 2097152,
        array['image/png','image/jpeg','image/webp','image/avif'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

