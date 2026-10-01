/**
 * Kept out of the action module on purpose: a `use server` file may only
 * export async functions, and a stray constant there breaks every import
 * of the module at runtime.
 */
/** Shared with the client so the guidance cannot drift from the rule. */
export const DISH_IMAGE_SPEC = {
  maxBytes: 8 * 1024 * 1024,
  warnBytes: 600 * 1024,
  maxPerDish: 8,
  minWidth: 800,
  formats: ['image/jpeg', 'image/png', 'image/webp', 'image/avif'],
  formatLabel: 'JPEG · WebP · AVIF',
} as const;
