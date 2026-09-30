import { createServiceClient } from '@/lib/supabase/server';
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
  servesAt: string | null;
  capacity: number | null;
  seatsLeft: number | null;
  isOpen: boolean;
  types: RegistrantType[];
}

export interface EventRecord {
  id: string;
  slug: string;
  kind: 'shabbat' | 'yomtov' | 'event' | 'payment_page';
  title: I18n;
  intro: I18n;
  startsOn: string;
  endsOn: string;
  erevOn: string;
  isOpen: boolean;
  closesHoursBefore: number;
  handEdited: boolean;
  meals: EventMeal[];
}

/** Defaults from the brief: ליל שבת 55/30, יום שבת 50/25. */
const DEFAULT_MEALS = [
  {
    key: 'friday-night',
    name: { he: 'סעודת ליל שבת', en: 'Friday night dinner' },
    sort: 1,
    types: [
      { name: { he: 'מבוגר', en: 'Adult' }, kind: 'adult', price: 55, seats: 1 },
      { name: { he: 'ילד (עד 12)', en: 'Child (under 12)' }, kind: 'child', price: 30, seats: 1 },
      { name: { he: 'תינוק', en: 'Infant' }, kind: 'infant', price: 0, seats: 0 },
    ],
  },
  {
    key: 'shabbat-day',
    name: { he: 'סעודת יום שבת', en: 'Shabbat lunch' },
    sort: 2,
    types: [
      { name: { he: 'מבוגר', en: 'Adult' }, kind: 'adult', price: 50, seats: 1 },
      { name: { he: 'ילד (עד 12)', en: 'Child (under 12)' }, kind: 'child', price: 25, seats: 1 },
      { name: { he: 'תינוק', en: 'Infant' }, kind: 'infant', price: 0, seats: 0 },
    ],
  },
] as const;

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
  return (data ?? []).map((r) => shape(r, []));
}

function shape(r: Record<string, unknown>, meals: EventMeal[]): EventRecord {
  return {
    id: r.id as string,
    slug: r.slug as string,
    kind: r.kind as EventRecord['kind'],
    title: r.title as I18n,
    intro: (r.intro ?? {}) as I18n,
    startsOn: r.starts_on as string,
    endsOn: r.ends_on as string,
    erevOn: r.erev_on as string,
    isOpen: r.is_open as boolean,
    closesHoursBefore: (r.closes_hours_before as number) ?? 24,
    handEdited: Boolean(r.hand_edited),
    meals,
  };
}

/** One event with its meals, types and live seat counts. */
export async function getEventBySlug(slug: string): Promise<EventRecord | null> {
  if (!hasSupabase()) return null;
  const sb = createServiceClient();

  const { data: ev, error } = await sb
    .from('events')
    .select('*')
    .eq('tenant_id', TENANT_ID)
    .eq('slug', slug)
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

  return shape(ev, shaped);
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
export async function generateShabbatEvents(count = 24): Promise<GenerateResult> {
  if (!hasSupabase()) return { created: [], skipped: [], handEdited: [] };

  const sb = createServiceClient();
  const occasions = getUpcomingOccasions(count);
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
        intro: {
          he: 'סעודות על שפת הים. מי שמגיע — מוזמן.',
          en: 'Meals by the sea. Everyone passing through is welcome.',
        },
        occasion_key: key,
        starts_on: o.startDate,
        ends_on: o.endDate,
        erev_on: o.erevDate,
      })
      .select('id')
      .single();

    if (error || !created) continue;

    for (const m of DEFAULT_MEALS) {
      const { data: meal } = await sb
        .from('event_meals')
        .insert({
          tenant_id: TENANT_ID,
          event_id: created.id,
          name: m.name,
          sort: m.sort,
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
