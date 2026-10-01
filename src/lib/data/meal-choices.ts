import type { I18n } from './types';

/**
 * The dietary options a registration form can offer.
 *
 * A fixed catalogue rather than free text: the kitchen cooks from these
 * counts, and "veg", "vegetarian" and "צמחוני" typed into three different
 * forms would be three different numbers for the same plate.
 */
export interface MealChoiceDef {
  key: string;
  label: I18n;
  /** Shown under the label on the form when it needs saying. */
  note?: I18n;
}

export const MEAL_CHOICES: MealChoiceDef[] = [
  {
    key: 'vegetarian',
    label: { he: 'צמחוני', en: 'Vegetarian' },
  },
  {
    key: 'gluten_free',
    label: { he: 'ללא גלוטן', en: 'Gluten free' },
    note: { he: 'נעשה כמיטב יכולתנו, המטבח אינו נקי מגלוטן', en: 'Prepared with care; the kitchen is not gluten-free' },
  },
  {
    key: 'vegan',
    label: { he: 'טבעוני', en: 'Vegan' },
  },
];

export const CHOICE_BY_KEY = new Map(MEAL_CHOICES.map((c) => [c.key, c]));

/** Drops anything the app does not recognise, so a stale key cannot leak. */
export function knownChoices(keys: readonly string[] | null | undefined): string[] {
  return (keys ?? []).filter((k) => CHOICE_BY_KEY.has(k));
}

/**
 * What one meal actually offers.
 *
 * null on the meal means inherit; an empty array means the question was
 * deliberately switched off for that meal. Those are different intentions
 * and collapsing them would turn "do not ask at Shabbat lunch" back into
 * "ask whatever the template says".
 */
export function choicesForMeal(
  mealChoices: string[] | null | undefined,
  templateChoices: string[] | null | undefined,
): MealChoiceDef[] {
  const keys = mealChoices === null || mealChoices === undefined
    ? knownChoices(templateChoices)
    : knownChoices(mealChoices);
  return keys.map((k) => CHOICE_BY_KEY.get(k)!).filter(Boolean);
}

/** The label to print on a kitchen sheet or an export. */
export function choiceLabel(key: string | null | undefined): string {
  if (!key) return '';
  return CHOICE_BY_KEY.get(key)?.label.he ?? key;
}
