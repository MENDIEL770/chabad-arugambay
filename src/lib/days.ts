/**
 * Weekday names, indexed the way JavaScript and Postgres both count: 0 is
 * Sunday.
 *
 * In a plain module, not beside the action that uses them. A file marked
 * `use server` may only export async functions — exporting a constant from
 * one makes every import of that module fail at runtime, which is how this
 * list went missing from the hours screen and took the save button with it.
 */
export const DAY_NAMES = [
  'ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת',
] as const;

/** Short form, for tight rows. */
export const DAY_SHORT = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'] as const;
