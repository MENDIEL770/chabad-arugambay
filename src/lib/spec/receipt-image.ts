/**
 * Kept out of the action module on purpose: a `use server` file may only
 * export async functions, and a stray constant there breaks every import
 * of the module at runtime.
 */
/** 576px is the full width of 80mm thermal paper; larger is wasted bytes. */
export const RECEIPT_IMAGE_SPEC = {
  maxBytes: 2 * 1024 * 1024,
  recommendedWidth: 576,
  formats: ['image/png', 'image/jpeg', 'image/webp', 'image/avif'],
  formatLabel: 'PNG · JPEG · WebP · AVIF',
} as const;

/**
 * Why a file was refused, in words someone can act on.
 *
 * A generic "unsupported format" is useless when the two things people
 * actually try are an SVG logo and a photo straight off an iPhone. The
 * bucket rejects both before the app sees them, so the message has to name
 * the type and say what to do instead.
 */
export function explainFormat(type: string, name: string): string | null {
  if ((RECEIPT_IMAGE_SPEC.formats as readonly string[]).includes(type)) return null;

  if (type === 'image/svg+xml' || /\.svg$/i.test(name)) {
    return 'SVG לא נתמך. המדפסת מדפיסה 576 פיקסלים רוחב, אז ייצאו את הלוגו כ-PNG באותו רוחב.';
  }
  if (type === 'image/heic' || type === 'image/heif' || /\.hei[cf]$/i.test(name)) {
    return 'קובץ HEIC מאייפון לא נתמך. בהגדרות המצלמה אפשר לבחור ״תואם ביותר״, או לשמור את התמונה כ-JPEG.';
  }
  return `הפורמט ${type || 'הזה'} לא נתמך. ${RECEIPT_IMAGE_SPEC.formatLabel}.`;
}
