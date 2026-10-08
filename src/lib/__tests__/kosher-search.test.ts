import { describe, it, expect } from 'vitest';
import { fold, searchable, STATUS, STATUS_ORDER } from '@/lib/data/kosher-view';

const product = {
  name: { he: 'לחם אחיד', en: 'Plain bread' },
  brand: 'Prima',
  certification: 'OU',
  notes: { he: 'רק האריזה הכחולה', en: 'Blue packet only' },
  whereToBuy: 'Cargills',
  barcode: '4792024001234',
};

describe('kosher search', () => {
  it('matches regardless of case', () => {
    expect(searchable(product)).toContain(fold('PRIMA'));
    expect(searchable(product)).toContain(fold('cargills'));
  });

  // The thing that makes a Hebrew search box feel broken: a word typed
  // mid-sentence has a different last letter from the same word alone.
  it('matches a Hebrew word whichever final letter was typed', () => {
    expect(fold('לחם')).toBe(fold('לחמ'));
    expect(searchable(product)).toContain(fold('לחמ'));
    expect(fold('ארץ')).toBe(fold('ארצ'));
    expect(fold('מלך')).toBe(fold('מלכ'));
  });

  it('ignores niqqud', () => {
    expect(fold('לֶחֶם')).toBe(fold('לחם'));
  });

  it('ignores the quote marks Hebrew abbreviations use', () => {
    // בד"ץ and בד״ץ are the same word typed two ways.
    expect(fold('בד"ץ')).toBe(fold('בד״ץ'));
    expect(fold('בד״ץ')).toBe(fold('בדצ'));
  });

  it('ignores bidi marks pasted in from elsewhere', () => {
    expect(fold('‎OU‏')).toBe('ou');
  });

  it('searches the barcode, which is what someone scanning has', () => {
    expect(searchable(product)).toContain('4792024001234');
  });

  it('searches both languages and the shop name', () => {
    const hay = searchable(product);
    for (const needle of ['plain bread', 'אחיד', 'ou', 'cargills', 'blue packet']) {
      expect(hay, needle).toContain(fold(needle));
    }
  });

  it('survives a product with almost nothing filled in', () => {
    expect(() =>
      searchable({
        name: { he: 'x' }, brand: null, certification: null,
        notes: {}, whereToBuy: null, barcode: null,
      }),
    ).not.toThrow();
  });

  it('every status has a label and a place in the order', () => {
    for (const s of STATUS_ORDER) {
      expect(STATUS[s].label, s).toBeTruthy();
    }
    expect(STATUS_ORDER).toHaveLength(Object.keys(STATUS).length);
    // Kosher first: the common question is "what can I buy".
    expect(STATUS_ORDER[0]).toBe('kosher');
  });
});
