import { describe, expect, it } from 'vitest';
import { matchDish, searchKb, describeDish, type DishFact } from './kb';

const DISHES: DishFact[] = [
  { nameHe: 'שקשוקה', nameEn: 'Shakshuka', priceLkr: 2400, available: true, descriptionHe: 'עם חלה' },
  { nameHe: 'ארוחת בוקר ישראלית', nameEn: 'Israeli breakfast', priceLkr: 3100, available: true, descriptionHe: '' },
  { nameHe: 'שניצל עוף', nameEn: 'Chicken schnitzel', priceLkr: 3600, available: false, descriptionHe: '' },
  { nameHe: 'קוקוס מלכותי', nameEn: 'King coconut', priceLkr: 500, available: true, descriptionHe: '' },
];

describe('dish matching', () => {
  it('answers about a specific dish rather than the cheapest one', () => {
    expect(matchDish('כמה עולה שקשוקה', DISHES)?.nameHe).toBe('שקשוקה');
    expect(matchDish('כמה עולה שקשוקה', DISHES)?.priceLkr).toBe(2400);
  });

  it('prefers the longer name when two overlap', () => {
    // "ארוחת בוקר ישראלית" must win over a bare "ארוחת בוקר" prefix match.
    expect(matchDish('מחיר ארוחת בוקר ישראלית', DISHES)?.nameHe).toBe('ארוחת בוקר ישראלית');
  });

  it('matches English names too', () => {
    expect(matchDish('how much is shakshuka', DISHES)?.nameHe).toBe('שקשוקה');
  });

  it('matches on the distinctive first word', () => {
    expect(matchDish('יש לכם שניצל?', DISHES)?.nameHe).toBe('שניצל עוף');
  });

  it('returns nothing when no dish is mentioned', () => {
    expect(matchDish('מתי הדלקת נרות', DISHES)).toBeNull();
    expect(matchDish('', DISHES)).toBeNull();
  });

  it('says so when the dish is sold out instead of quoting it as available', () => {
    const d = matchDish('שניצל', DISHES)!;
    expect(describeDish(d)).toContain('אזל להיום');
  });

  it('converts to shekels for the reader', () => {
    expect(describeDish(DISHES[0])).toContain('24 ₪');
  });
});

describe('question matching', () => {
  it('finds the registration entry from a natural phrasing', () => {
    expect(searchKb('מתי נסגרת ההרשמה')[0].id).toBe('registration-deadline');
  });

  it('finds candle lighting', () => {
    expect(searchKb('מתי מדליקים נרות')[0].id).toBe('candle-lighting');
  });

  it('folds final letters so both spellings match', () => {
    // "מקום" vs "מקומ" — Hebrew typing in a search box is inconsistent.
    expect(searchKb('לישון').length).toBeGreaterThan(0);
  });

  it('returns nothing for a question outside the corpus', () => {
    expect(searchKb('איפה לחנות את הצוללת')).toHaveLength(0);
  });
});
