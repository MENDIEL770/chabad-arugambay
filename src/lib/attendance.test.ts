import { describe, expect, it } from 'vitest';
import { groupByLetter, norm, packPages, sectionHeight, LAYOUT, type Attendee } from './attendance';

const a = (last: string, first = 'ישראל', adults = 1, children = 0): Attendee => ({
  last, first, adults, children,
});

describe('hebrew normalisation', () => {
  it('folds final letters so כהן and כהך sort together', () => {
    expect(norm('אברהמוביץם')).toBe('אברהמוביצמ');
    expect(norm('כ״ץ')).toBe('כצ');
  });

  it('strips nikud and the maqaf, and folds the final nun', () => {
    // ן folds to נ by design: בן־צבי and בנצבי must land in the same place.
    expect(norm('בֶּן־צְבִי')).toBe('בנצבי');
  });
});

describe('grouping', () => {
  it('orders sections by the hebrew alphabet, not unicode', () => {
    const s = groupByLetter([a('שפירא'), a('אברהם'), a('לוי')]);
    expect(s.map((x) => x.label)).toEqual(['א', 'ל', 'ש']);
  });

  it('files a final-letter surname under its base letter', () => {
    // "ןון" is contrived, but ם/ן surnames are real and must not make
    // their own phantom section.
    const s = groupByLetter([a('מזרחי'), a('םזרחי')]);
    expect(s).toHaveLength(1);
    expect(s[0].label).toBe('מ');
    expect(s[0].rows).toHaveLength(2);
  });

  it('puts latin surnames in one A-Z section at the end', () => {
    const s = groupByLetter([a('Cohen'), a('אברהם'), a('Levi')]);
    expect(s.map((x) => x.label)).toEqual(['א', 'A-Z']);
    expect(s[1].ltr).toBe(true);
    expect(s[1].rows.map((r) => r.last)).toEqual(['Cohen', 'Levi']);
  });

  it('sorts by first name within the same surname', () => {
    const s = groupByLetter([
      { last: 'כהן', first: 'שרה' },
      { last: 'כהן', first: 'אבי' },
    ]);
    expect(s[0].rows.map((r) => r.first)).toEqual(['אבי', 'שרה']);
  });

  it('totals adults and children per section', () => {
    const s = groupByLetter([a('כהן', 'א', 2, 3), a('כץ', 'ב', 1, 1)]);
    expect(s[0].adults).toBe(3);
    expect(s[0].children).toBe(4);
  });

  it('loses nobody', () => {
    const rows = [a('כהן'), a('Smith'), a('אברהם'), a('123')];
    const total = groupByLetter(rows).reduce((n, s) => n + s.rows.length, 0);
    expect(total).toBe(rows.length);
  });
});

describe('page packing', () => {
  const section = (n: number, label = 'א') => ({
    label, rows: Array.from({ length: n }, () => a('כהן')), ltr: false, adults: n, children: 0,
  });

  it('keeps a letter whole rather than splitting it', () => {
    const pages = packPages([section(30), section(30)]);
    for (const page of pages) {
      for (const s of page) expect(s.rows.length).toBe(30);
    }
  });

  it('shares a page between short letters', () => {
    const pages = packPages([section(2, 'א'), section(2, 'ב'), section(2, 'ג')]);
    expect(pages).toHaveLength(1);
    expect(pages[0]).toHaveLength(3);
  });

  it('never exceeds the usable page height within a page', () => {
    const pages = packPages([section(10), section(10), section(10), section(10), section(10)]);
    for (const page of pages) {
      const used = page.reduce((h, s, i) => h + (i ? LAYOUT.GAP : 0) + sectionHeight(s), 0);
      // A single oversized section is allowed to overflow; two are not.
      if (page.length > 1) expect(used).toBeLessThanOrEqual(LAYOUT.PAGE_H);
    }
  });

  it('gives a letter too tall for one page its own page anyway', () => {
    const pages = packPages([section(100)]);
    expect(pages).toHaveLength(1);
  });

  it('returns no pages for no sections', () => {
    expect(packPages([])).toEqual([]);
  });
});
