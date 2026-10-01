import { createServiceClient } from '@/lib/supabase/server';
import { hasSupabase, TENANT_ID } from '@/lib/config';
import type { I18n } from './types';

export interface TemplateType {
  name: I18n;
  kind: 'adult' | 'child' | 'infant' | 'donation';
  price: number;
  /** Infants take no seat, so they need no name and no capacity. */
  seats: number;
}

export interface TemplateMeal {
  key: string;
  name: I18n;
  sort: number;
  /** Minutes relative to candle lighting; negative is before. */
  servesOffsetMin: number;
  capacity: number | null;
  types: TemplateType[];
}

export interface EventTemplate {
  /**
   * Dietary options every new form offers. Empty means the question is not
   * asked at all; a meal can still override it either way.
   */
  mealChoices: string[];
  intro: I18n;
  meals: TemplateMeal[];
  askEmail: boolean;
  askNationality: boolean;
  askNotes: boolean;
  askParticipants: boolean;
  donationAmounts: number[];
  weeksAhead: number;
  closesHoursBefore: number;
}

/** What the brief specified, and what the generator used before this table. */
export const DEFAULT_TEMPLATE: EventTemplate = {
  // Off out of the box: a form that asks about diet when the house serves
  // one menu wastes a question, and turning it on is one checkbox.
  mealChoices: [],
  intro: {
    he: 'סעודות על שפת הים. מי שמגיע — מוזמן.',
    en: 'Meals by the sea. Everyone passing through is welcome.',
  },
  meals: [
    {
      key: 'friday-night',
      name: { he: 'סעודת ליל שבת', en: 'Friday night dinner' },
      sort: 1,
      servesOffsetMin: 115, // candle lighting + about two hours
      capacity: null,
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
      servesOffsetMin: 1140, // the following midday
      capacity: null,
      types: [
        { name: { he: 'מבוגר', en: 'Adult' }, kind: 'adult', price: 50, seats: 1 },
        { name: { he: 'ילד (עד 12)', en: 'Child (under 12)' }, kind: 'child', price: 25, seats: 1 },
        { name: { he: 'תינוק', en: 'Infant' }, kind: 'infant', price: 0, seats: 0 },
      ],
    },
  ],
  askEmail: true,
  askNationality: true,
  askNotes: true,
  askParticipants: true,
  donationAmounts: [0, 50, 100, 180, 360],
  weeksAhead: 24,
  closesHoursBefore: 24,
};

/**
 * The saved template, or the built-in one.
 *
 * Falls back rather than failing: a missing row or an unrun migration must
 * not stop the generator, because an event with no form is worse than an
 * event with default prices.
 */
export async function getEventTemplate(): Promise<EventTemplate> {
  if (!hasSupabase()) return DEFAULT_TEMPLATE;

  const { data, error } = await createServiceClient()
    .from('event_template')
    .select('*')
    .eq('tenant_id', TENANT_ID)
    .maybeSingle();

  if (error || !data) return DEFAULT_TEMPLATE;

  const meals = data.meals as TemplateMeal[] | null;

  return {
    intro: (data.intro as I18n)?.he ? (data.intro as I18n) : DEFAULT_TEMPLATE.intro,
    // An empty array is a real choice; only a missing value falls back.
    meals: meals?.length ? meals : DEFAULT_TEMPLATE.meals,
    askEmail: data.ask_email !== false,
    askNationality: data.ask_nationality !== false,
    askNotes: data.ask_notes !== false,
    askParticipants: data.ask_participants !== false,
    donationAmounts: (data.donation_amounts as number[]) ?? DEFAULT_TEMPLATE.donationAmounts,
    mealChoices: (data.meal_choices as string[] | null) ?? DEFAULT_TEMPLATE.mealChoices,
    weeksAhead: (data.weeks_ahead as number) ?? DEFAULT_TEMPLATE.weeksAhead,
    closesHoursBefore: (data.closes_hours_before as number) ?? DEFAULT_TEMPLATE.closesHoursBefore,
  };
}
