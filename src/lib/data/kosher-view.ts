import type { KosherStatus } from './kosher';

/**
 * How each verdict reads, and what it looks like.
 *
 * "Not kosher" is a first-class answer, not an absence. A traveller in a
 * supermarket needs to know what to put back as much as what to buy, and
 * an empty search result cannot tell "we checked and it is not" from
 * "nobody has looked".
 */
export const STATUS: Record<KosherStatus, { label: string; chip: string; short: string }> = {
  kosher: { label: 'כשר', chip: 'chip-kosher', short: '✓' },
  not_kosher: { label: 'לא כשר', chip: 'chip-out', short: '✗' },
  check: { label: 'צריך בדיקה', chip: '', short: '?' },
};

export const STATUS_ORDER: KosherStatus[] = ['kosher', 'check', 'not_kosher'];

/**
 * Fold a string for searching.
 *
 * Hebrew final letters and niqqud are stripped so "לחם" finds "לחם" typed
 * with a final mem, and Latin case is flattened so "Cargills" finds
 * "cargills". Without this the search box looks broken for half the words
 * on the page.
 */
export function fold(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[֑-ׇ]/g, '')
    .replace(/[‎‏]/g, '')
    .replace(/ך/g, 'כ').replace(/ם/g, 'מ').replace(/ן/g, 'נ')
    .replace(/ף/g, 'פ').replace(/ץ/g, 'צ')
    .replace(/["'׳״`]/g, '')
    .trim();
}

/** Every field worth matching on, as one folded haystack. */
export function searchable(p: {
  name: { he?: string | null; en?: string | null };
  brand: string | null;
  certification: string | null;
  notes: { he?: string | null; en?: string | null };
  whereToBuy: string | null;
  barcode: string | null;
}): string {
  return fold([
    p.name.he, p.name.en, p.brand, p.certification,
    p.notes.he, p.notes.en, p.whereToBuy, p.barcode,
  ].filter(Boolean).join(' '));
}
