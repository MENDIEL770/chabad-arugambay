/**
 * Kept out of the action module on purpose: a `use server` file may only
 * export async functions, and a stray constant there breaks every import
 * of the module at runtime.
 */
/** 576px is the full width of 80mm thermal paper; larger is wasted bytes. */
export const RECEIPT_IMAGE_SPEC = {
  maxBytes: 2 * 1024 * 1024,
  recommendedWidth: 576,
  formats: ['image/png', 'image/jpeg', 'image/webp'],
  formatLabel: 'PNG · JPEG · WebP',
} as const;
