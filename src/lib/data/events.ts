import { createServiceClient } from '@/lib/supabase/server';
import { getEventTemplate } from './event-template';
import { hasSupabase, TENANT_ID } from '@/lib/config';
import { getUpcomingOccasions } from '@/lib/data/calendar';
import type { Occasion } from '@/lib/calendar/occasions';
import type { I18n } from './types';

export interface RegistrantType {
  id: string;
  name: I18n;
  kind: 'adult' | 'child' | 'infant' | 'donation' | 'sale';
  priceIls: number;
  seats: number;
  maxPerRegistration: number;
}

export interface EventMeal {
  id: string;
  name: I18n;
  /**
   * null means inherit the template. An empty array is a deliberate "do not
   * ask for this meal" — Shabbat lunch is a buffet where the question is
   * meaningless even when Friday night offers a plate.
   */
  mealChoices: string[] | null;
  servesAt: string | null;
  capacity: number | null;
  seatsLeft: number | null;
  isOpen: boolean;
  types: RegistrantType[];
}

export interface EventRecord {
  id: string;
  /**
   * The template's dietary options, carried on the event so the public
   * form can resolve a meal's `null` (inherit) without a second query.
   */
  mealChoices: string[];
  slug: string;
  kind: 'shabbat' | 'yomtov' | 'event' | 'payment_page';
  title: I18n;
  intro: I18n;
  startsOn: string;
  endsOn: string;
  erevOn: string;
  isOpen: boolean;
  /** Shown in the public list of upcoming shabbatot. A private event is
   *  reachable by its link but does not appear there. */
  isListed: boolean;
  closesHoursBefore: number;
  handEdited: boolean;
  meals: EventMeal[];
}

/** URL-safe slug from the occasion, e.g. shabbat-2026-10-10. */
function slugFor(o: Occasion): string {
  const prefix = o.kind === 'shabbat' ? 'shabbat' : 'chag';
  return `${prefix}-${o.startDate}`;
}

export async function getOpenEvents(): Promise<EventRecord[]> {
  if (!hasSupabase()) return [];
  const sb = createServiceClient();

  const { data, error } = await sb
    .from('events')
    .select('*')
    .eq('tenant_id', TENANT_ID)
    .eq('is_open', true)
    .eq('is_listed', true)
    .order('starts_on');

  if (error) {
    if (/schema cache|does not exist/i.test(error.message)) {
      console.warn('[events] tables missing — run supabase/migrations/0007_events.sql');
      return [];
    }
    throw new Error(`Could not load events: ${error.message}`);
  }
  // The list view shows no meals, so it needs no choices either.
  return (data ?? []).map((r) => shape(r, [], []));
}

function shape(
  r: Record<string, unknown>,
  meals: EventMeal[],
  templateChoices: string[] = [],
): EventRecord {
  return {
    id: r.id as string,
    mealChoices: templateChoices,
    slug: r.slug as string,
    kind: r.kind as EventRecord['kind'],
    title: r.title as I18n,
    intro: (r.intro ?? {}) as I18n,
    startsOn: r.starts_on as string,
    endsOn: r.ends_on as string,
    erevOn: r.erev_on as string,
    isOpen: r.is_open as boolean,
    isListed: r.is_listed !== false,
    closesHoursBefore: (r.closes_hours_before as number) ?? 24,
    handEdited: Boolean(r.hand_edited),
    meals,
  };
}

/** One event with its meals, types and live seat counts. */
/** One event with its meals and prices, for the admin editor. */
export async function getEventById(id: string): Promise<EventRecord | null> {
  return loadEvent('id', id);
}

/**
 * Load one event with its meals and prices.
 *
 * Shared by the public form (by slug) and the admin editor (by id) so the
 * two can never disagree about what a form contains.
 */
async function loadEvent(by: 'slug' | 'id', value: string): Promise<EventRecord | null> {
  if (!hasSupabase()) return null;
  const sb = createServiceClient();

  const { data: ev, error } = await sb
    .from('events')
    .select('*')
    .eq('tenant_id', TENANT_ID)
    .eq(by, value)
    .maybeSingle();

  if (error || !ev) return null;

  const { data: meals } = await sb
    .from('event_meals')
    .select('*')
    .eq('event_id', ev.id)
    .order('sort');

  const { data: types } = await sb
    .from('registrant_types')
    .select('*')
    .eq('tenant_id', TENANT_ID)
    .order('sort');

  const shaped: EventMeal[] = [];
  for (const m of meals ?? []) {
    // Seats are computed in the database so the number reflects other
    // people's registrations, not a stale count cached at render time.
    const { data: left } = await sb.rpc('meal_seats_left', { p_meal: m.id });
    shaped.push({
      id: m.id as string,
      name: m.name as I18n,
      servesAt: (m.serves_at as string | null) ?? null,
      capacity: (m.capacity as number | null) ?? null,
      // Absent column (migration not run) reads as inherit, which is
      // the behaviour that existed before the feature.
      mealChoices: (m.meal_choices as string[] | null) ?? null,
      seatsLeft: m.capacity == null ? null : (left as number),
      isOpen: m.is_open as boolean,
      types: (types ?? [])
        .filter((t) => t.meal_id === m.id)
        .map((t) => ({
          id: t.id as string,
          name: t.name as I18n,
          kind: t.kind as RegistrantType['kind'],
          priceIls: Number(t.price_ils),
          seats: (t.seats as number) ?? 1,
          maxPerRegistration: (t.max_per_registration as number) ?? 20,
        })),
    });
  }

  // The template's default travels with the event so the public form can
  // resolve a meal's null (inherit) without a second round trip.
  const template = await getEventTemplate();

  return shape(ev, shaped, template.mealChoices);
}

export async function getEventBySlug(slug: string): Promise<EventRecord | null> {
  return loadEvent('slug', slug);
}

export interface GenerateResult {
  created: string[];
  skipped: string[];
  handEdited: string[];
}

/**
 * Keep N upcoming shabbatot and chagim open for registration.
 *
 * Idempotent by `occasion_key`, so running it twice creates nothing twice.
 * An event a human has touched is never modified — losing a shliach's own
 * wording to a nightly job is the fastest way to make them stop trusting
 * the system, so `hand_edited` is a one-way door.
 */
export async function generateShabbatEvents(count?: number): Promise<GenerateResult> {
  // Read once per run: the generator writes many events from one template.
  const template = await getEventTemplate();
  const weeks = count ?? template.weeksAhead;
  if (!hasSupabase()) return { created: [], skipped: [], handEdited: [] };

  const sb = createServiceClient();
  const occasions = getUpcomingOccasions(weeks);
  const result: GenerateResult = { created: [], skipped: [], handEdited: [] };

  const { data: existing } = await sb
    .from('events')
    .select('occasion_key, hand_edited')
    .eq('tenant_id', TENANT_ID);

  const known = new Map(
    (existing ?? []).map((e) => [e.occasion_key as string, Boolean(e.hand_edited)]),
  );

  for (const o of occasions) {
    const key = o.key;
    if (known.has(key)) {
      (known.get(key) ? result.handEdited : result.skipped).push(key);
      continue;
    }

    const { data: created, error } = await sb
      .from('events')
      .insert({
        tenant_id: TENANT_ID,
        slug: slugFor(o),
        kind: o.kind === 'shabbat' ? 'shabbat' : 'yomtov',
        title: o.title,
        intro: template.intro,
        occasion_key: key,
        starts_on: o.startDate,
        ends_on: o.endDate,
        erev_on: o.erevDate,
      })
      .select('id')
      .single();

    if (error || !created) continue;

    for (const m of template.meals) {
      const { data: meal } = await sb
        .from('event_meals')
        .insert({
          tenant_id: TENANT_ID,
          event_id: created.id,
          name: m.name,
          sort: m.sort,
          capacity: m.capacity,
          meal_choices: null,
          // Relative to candle lighting, so the meal stays where it belongs
          // in the evening as sunset moves across the year.
          serves_at: o.candleLighting.plus({ minutes: m.servesOffsetMin }).toISO(),
        })
        .select('id')
        .single();

      if (!meal) continue;

      await sb.from('registrant_types').insert(
        m.types.map((t, i) => ({
          tenant_id: TENANT_ID,
          meal_id: meal.id,
          name: t.name,
          kind: t.kind,
          price_ils: t.price,
          seats: t.seats,
          sort: i + 1,
        })),
      );
    }

    result.created.push(slugFor(o));
  }

  return result;
}
