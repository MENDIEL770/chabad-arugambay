import { createServiceClient } from '@/lib/supabase/server';
import { hasSupabase, TENANT_ID } from '@/lib/config';
import type { I18n } from './types';

export interface MealTally {
  mealId: string;
  mealName: string;
  servesAt: string | null;
  capacity: number | null;
  /** Seats taken, which is not the same as rows: a type can seat more than one. */
  seats: number;
  byType: { typeName: string; qty: number; seats: number; priceIls: number }[];
}

export interface RegistrationRow {
  id: string;
  code: string;
  fullName: string;
  phone: string;
  email: string | null;
  nationality: string | null;
  notes: string | null;
  state: string;
  totalIls: number;
  donationIls: number;
  paidAt: string | null;
  createdAt: string;
  /** meal name → how many of each type, for the table and the export. */
  perMeal: { mealName: string; typeName: string; qty: number }[];
  participants: { name: string; mealName: string | null; mealChoice: string | null }[];
}

export interface EventRegistrations {
  eventId: string;
  title: string;
  startsOn: string;
  meals: MealTally[];
  rows: RegistrationRow[];
  totals: {
    registrations: number;
    people: number;
    revenueIls: number;
    donationsIls: number;
    unpaid: number;
  };
}

const he = (v: unknown, fallback = ''): string => (v as I18n | null)?.he ?? fallback;

/**
 * Everything the admin needs about one event's registrations, in one read.
 *
 * Assembled in the app rather than as a view because the same shape feeds
 * the screen, the CSV and the printable sheet — and keeping one source for
 * all three is what stops the printed headcount disagreeing with the one
 * on the screen.
 */
export async function getEventRegistrations(
  eventId: string,
): Promise<EventRegistrations | null> {
  if (!hasSupabase()) return null;
  const sb = createServiceClient();

  const { data: event, error: evErr } = await sb
    .from('events')
    .select('id, title, starts_on')
    .eq('id', eventId)
    .eq('tenant_id', TENANT_ID)
    .maybeSingle();

  if (evErr || !event) return null;

  const [{ data: meals }, { data: types }, { data: regs }] = await Promise.all([
    sb.from('event_meals').select('id, name, serves_at, capacity, sort')
      .eq('event_id', eventId).order('sort'),
    sb.from('registrant_types').select('id, meal_id, name, price_ils, seats, sort')
      .eq('tenant_id', TENANT_ID).order('sort'),
    sb.from('registrations').select('*')
      .eq('event_id', eventId).in('state', ['pending', 'confirmed'])
      .order('created_at'),
  ]);

  // Items and participants are fetched for THIS event's registrations only.
  // Reading them tenant-wide and filtering here looked equivalent but was
  // not: PostgREST caps a request at 1000 rows, so once enough Shabbatot
  // had accumulated the oldest rows silently fell off the end and names
  // started disappearing from the list and the export.
  const regIds = (regs ?? []).map((r) => r.id as string);

  const [{ data: items }, { data: people }] = regIds.length
    ? await Promise.all([
        sb.from('registration_items')
          .select('registration_id, meal_id, type_id, qty')
          .in('registration_id', regIds),
        sb.from('registration_participants')
          .select('registration_id, full_name, meal_id, meal_choice')
          .in('registration_id', regIds),
      ])
    : [{ data: [] }, { data: [] }];

  const mealName = new Map((meals ?? []).map((m) => [m.id as string, he(m.name)]));
  const typeById = new Map(
    (types ?? []).map((t) => [
      t.id as string,
      { name: he(t.name), seats: (t.seats as number) ?? 1, price: Number(t.price_ils ?? 0), mealId: t.meal_id as string },
    ]),
  );

  const myItems = items ?? [];
  const myPeople = people ?? [];

  const tallies: MealTally[] = (meals ?? []).map((m) => {
    const mid = m.id as string;
    const rows = myItems.filter((i) => i.meal_id === mid);
    const byType = new Map<string, { qty: number; seats: number; price: number }>();

    for (const r of rows) {
      const t = typeById.get(r.type_id as string);
      if (!t) continue;
      const qty = (r.qty as number) ?? 0;
      const cur = byType.get(t.name) ?? { qty: 0, seats: 0, price: t.price };
      cur.qty += qty;
      cur.seats += qty * t.seats;
      byType.set(t.name, cur);
    }

    return {
      mealId: mid,
      mealName: he(m.name),
      servesAt: (m.serves_at as string | null) ?? null,
      capacity: (m.capacity as number | null) ?? null,
      seats: [...byType.values()].reduce((s, v) => s + v.seats, 0),
      byType: [...byType.entries()].map(([typeName, v]) => ({
        typeName, qty: v.qty, seats: v.seats, priceIls: v.price,
      })),
    };
  });

  const rows: RegistrationRow[] = (regs ?? []).map((r) => {
    const id = r.id as string;
    return {
      id,
      code: r.code as string,
      fullName: r.full_name as string,
      phone: r.phone as string,
      email: (r.email as string | null) ?? null,
      nationality: (r.nationality as string | null) ?? null,
      notes: (r.notes as string | null) ?? null,
      state: r.state as string,
      totalIls: Number(r.total_ils ?? 0),
      donationIls: Number(r.donation_ils ?? 0),
      paidAt: (r.paid_at as string | null) ?? null,
      createdAt: r.created_at as string,
      perMeal: myItems
        .filter((i) => i.registration_id === id)
        .map((i) => ({
          mealName: mealName.get(i.meal_id as string) ?? '—',
          typeName: typeById.get(i.type_id as string)?.name ?? '—',
          qty: (i.qty as number) ?? 0,
        })),
      participants: myPeople
        .filter((p) => p.registration_id === id)
        .map((p) => ({
          name: p.full_name as string,
          mealName: p.meal_id ? (mealName.get(p.meal_id as string) ?? null) : null,
          mealChoice: (p.meal_choice as string | null) ?? null,
        })),
    };
  });

  return {
    eventId,
    title: he(event.title, 'אירוע'),
    startsOn: event.starts_on as string,
    meals: tallies,
    rows,
    totals: {
      registrations: rows.length,
      people: tallies.reduce((s, m) => Math.max(s, m.seats), 0),
      revenueIls: rows.reduce((s, r) => s + r.totalIls, 0),
      donationsIls: rows.reduce((s, r) => s + r.donationIls, 0),
      unpaid: rows.filter((r) => !r.paidAt).length,
    },
  };
}
