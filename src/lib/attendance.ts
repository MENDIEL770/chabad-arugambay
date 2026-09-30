/**
 * Attendance list: Hebrew sorting, letter sections and page packing.
 *
 * Ported from the spec. Pure functions with no DOM or database, so the
 * ordering and pagination rules can be tested directly — they are the part
 * that quietly goes wrong once real names arrive.
 */

const FINALS: Record<string, string> = { ך: 'כ', ם: 'מ', ן: 'נ', ף: 'פ', ץ: 'צ' };
const HEBREW_ORDER = 'אבגדהוזחטיכלמנסעפצקרשת';

export interface Attendee {
  last: string;
  first: string;
  adults?: number;
  children?: number;
  kind?: string;
  note?: string;
  regCode?: string;
}

export interface Section {
  label: string;
  rows: Attendee[];
  ltr: boolean;
  adults: number;
  children: number;
}

/** Strip points and punctuation, fold final letters, for comparison only. */
export function norm(s: string): string {
  return [...s.replace(/[^\p{L}\p{N} ]/gu, '')]
    .map((c) => FINALS[c] ?? c)
    .join('')
    .trim();
}

export function isHebrew(s: string): boolean {
  return /[֐-׿]/.test(s);
}

function letterIndex(s: string): number {
  const i = HEBREW_ORDER.indexOf(s[0] ?? '');
  // Unknown first letter sorts last within the Hebrew block rather than
  // silently ahead of alef.
  return i === -1 ? HEBREW_ORDER.length : i;
}

/**
 * Group by first letter of the surname, Hebrew sections first in alphabet
 * order, then a single A-Z section for Latin names — which would otherwise
 * fall between the cracks entirely.
 */
export function groupByLetter(rows: Attendee[]): Section[] {
  const hebrew = rows.filter((r) => isHebrew(r.last));
  const latin = rows.filter((r) => !isHebrew(r.last));

  const compare = (a: Attendee, b: Attendee) => {
    const ka = norm(a.last);
    const kb = norm(b.last);
    if (ka !== kb) {
      const d = letterIndex(ka) - letterIndex(kb);
      if (d !== 0) return d;
      return ka.localeCompare(kb, 'he');
    }
    return norm(a.first).localeCompare(norm(b.first), 'he');
  };

  const totals = (list: Attendee[]) => ({
    adults: list.reduce((s, r) => s + (r.adults ?? 0), 0),
    children: list.reduce((s, r) => s + (r.children ?? 0), 0),
  });

  const sections: Section[] = [];
  for (const letter of HEBREW_ORDER) {
    const group = hebrew.filter((r) => norm(r.last)[0] === letter).sort(compare);
    if (group.length) sections.push({ label: letter, rows: group, ltr: false, ...totals(group) });
  }

  // Anything Hebrew whose first letter is not in the alphabet list.
  const orphans = hebrew.filter((r) => !HEBREW_ORDER.includes(norm(r.last)[0] ?? ''));
  if (orphans.length) {
    sections.push({ label: 'אחר', rows: orphans.sort(compare), ltr: false, ...totals(orphans) });
  }

  if (latin.length) {
    const sorted = [...latin].sort(
      (a, b) => a.last.localeCompare(b.last) || a.first.localeCompare(b.first),
    );
    sections.push({ label: 'A-Z', rows: sorted, ltr: true, ...totals(sorted) });
  }

  return sections;
}

/** Estimated block heights in px, from the spec. */
export const LAYOUT = {
  HEADER_H: 96,
  THEAD_H: 22,
  ROW_H: 27,
  GAP: 16,
  PAGE_H: 1030,
} as const;

export function sectionHeight(s: Section): number {
  return LAYOUT.HEADER_H + LAYOUT.THEAD_H + LAYOUT.ROW_H * s.rows.length;
}

/**
 * Greedy packing so a letter is never split across a page break, and short
 * letters share a page instead of each wasting one.
 *
 * CSS `page-break-inside: avoid` is the safety net: when this estimate is
 * wrong the browser pushes the whole block rather than splitting it.
 */
export function packPages(sections: Section[]): Section[][] {
  const pages: Section[][] = [];
  let current: Section[] = [];
  let used = 0;

  for (const s of sections) {
    const h = sectionHeight(s);
    if (current.length && used + LAYOUT.GAP + h > LAYOUT.PAGE_H) {
      pages.push(current);
      current = [];
      used = 0;
    }
    current.push(s);
    used += (used ? LAYOUT.GAP : 0) + h;
  }
  if (current.length) pages.push(current);
  return pages;
}
