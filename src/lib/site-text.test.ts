import { describe, expect, it } from 'vitest';
import { SITE_TEXT, entryFor, groupedKeys, text, type TextKey, type TextOverrides } from './site-text';

const KEYS = Object.keys(SITE_TEXT) as TextKey[];

describe('every key has usable defaults', () => {
  it.each(KEYS)('%s has Hebrew and English', (key) => {
    const e = entryFor(key);
    expect(e.he.trim().length).toBeGreaterThan(0);
    expect(e.en.trim().length).toBeGreaterThan(0);
    expect(e.label.trim().length).toBeGreaterThan(0);
    expect(e.group.trim().length).toBeGreaterThan(0);
  });
});

describe('fallback behaviour', () => {
  it('uses the code default when there is no override', () => {
    expect(text({}, 'donate.title')).toBe(SITE_TEXT['donate.title'].he);
  });

  it('uses the override when one exists', () => {
    const o: TextOverrides = { 'donate.title': { he: 'כותרת חדשה', en: 'New' } };
    expect(text(o, 'donate.title')).toBe('כותרת חדשה');
    expect(text(o, 'donate.title', 'en')).toBe('New');
  });

  /**
   * The failure that matters: an override saved with a blank value must not
   * blank the page. This is the whole reason the defaults stay in code.
   */
  it('falls back when an override is blank or whitespace', () => {
    for (const blank of ['', '   ', '\n']) {
      const o = { 'donate.title': { he: blank, en: blank } } as TextOverrides;
      expect(text(o, 'donate.title')).toBe(SITE_TEXT['donate.title'].he);
    }
  });

  it('falls back per language, not all or nothing', () => {
    const o: TextOverrides = { 'donate.title': { he: 'רק עברית', en: '' } };
    expect(text(o, 'donate.title')).toBe('רק עברית');
    expect(text(o, 'donate.title', 'en')).toBe(SITE_TEXT['donate.title'].en);
  });

  it('ignores an override for a key the code does not know', () => {
    const o = { 'nope.gone': { he: 'x', en: 'x' } } as unknown as TextOverrides;
    expect(text(o, 'donate.title')).toBe(SITE_TEXT['donate.title'].he);
  });
});

describe('admin grouping', () => {
  it('lists every key exactly once', () => {
    const listed = groupedKeys().flatMap((g) => g.keys);
    expect(listed.sort()).toEqual([...KEYS].sort());
  });

  it('keeps each group contiguous', () => {
    const groups = groupedKeys().map((g) => g.group);
    expect(new Set(groups).size).toBe(groups.length);
  });
});
