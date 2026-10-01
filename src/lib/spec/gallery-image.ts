/**
 * Kept out of the action module: a `use server` file may only export async
 * functions, and a constant there reaches the client as undefined.
 */
export const GALLERY_IMAGE_SPEC = {
  maxBytes: 10 * 1024 * 1024,
  warnBytes: 900 * 1024,
  minWidth: 900,
  formats: ['image/jpeg', 'image/png', 'image/webp', 'image/avif'],
  formatLabel: 'JPEG · PNG · WebP · AVIF',
} as const;

/** Suggested albums. Free text is allowed; these are just the common ones. */
export const ALBUM_SUGGESTIONS = [
  'שבתות', 'חגים', 'המסעדה', 'הבית', 'טיולים', 'אורחים',
] as const;
