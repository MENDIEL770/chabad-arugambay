import { describe, expect, it } from 'vitest';
import {
  defaultSelection, describeModifications, priceDelta, selectionKey,
  validateSelection, type ModifierGroup,
} from './modifiers';

/** The laffa from the brief: comes with chips and salad, all removable. */
const INSIDE: ModifierGroup = {
  id: 'g-inside',
  name: { he: 'מה בפנים', en: 'What is inside' },
  kind: 'includes',
  minSelect: 0,
  maxSelect: 99,
  options: [
    { id: 'o-chips',    name: { he: 'צ׳יפס',   en: 'Chips' },    priceDeltaLkr: 0, isDefault: true,  allowSide: true,  isAvailable: true },
    { id: 'o-tahini',   name: { he: 'טחינה',   en: 'Tahini' },   priceDeltaLkr: 0, isDefault: true,  allowSide: true,  isAvailable: true },
    { id: 'o-spicy',    name: { he: 'חריף',    en: 'Spicy' },    priceDeltaLkr: 0, isDefault: true,  allowSide: true,  isAvailable: true },
    { id: 'o-tomato',   name: { he: 'עגבניה',  en: 'Tomato' },   priceDeltaLkr: 0, isDefault: true,  allowSide: true,  isAvailable: true },
    { id: 'o-cucumber', name: { he: 'מלפפון',  en: 'Cucumber' }, priceDeltaLkr: 0, isDefault: true,  allowSide: true,  isAvailable: true },
    { id: 'o-onion',    name: { he: 'בצל',     en: 'Onion' },    priceDeltaLkr: 0, isDefault: true,  allowSide: true,  isAvailable: true },
    { id: 'o-egg',      name: { he: 'ביצה',    en: 'Egg' },      priceDeltaLkr: 400, isDefault: false, allowSide: false, isAvailable: true },
  ],
};

const EXTRAS: ModifierGroup = {
  id: 'g-extras',
  name: { he: 'תוספות', en: 'Extras' },
  kind: 'multi',
  minSelect: 0,
  maxSelect: 3,
  options: [
    { id: 'x-fries',  name: { he: 'צ׳יפס בצד', en: 'Side fries' }, priceDeltaLkr: 800, isDefault: false, allowSide: false, isAvailable: true },
    { id: 'x-pickle', name: { he: 'חמוצים',    en: 'Pickles' },    priceDeltaLkr: 300, isDefault: false, allowSide: false, isAvailable: true },
  ],
};

const SIZE: ModifierGroup = {
  id: 'g-size',
  name: { he: 'גודל', en: 'Size' },
  kind: 'single',
  minSelect: 1,
  maxSelect: 1,
  options: [
    { id: 's-reg', name: { he: 'רגיל', en: 'Regular' }, priceDeltaLkr: 0,   isDefault: false, allowSide: false, isAvailable: true },
    { id: 's-big', name: { he: 'גדול', en: 'Large' },   priceDeltaLkr: 600, isDefault: false, allowSide: false, isAvailable: true },
  ],
};

const GROUPS = [INSIDE, EXTRAS, SIZE];

describe('defaults', () => {
  it('starts with everything the dish normally comes with', () => {
    const sel = defaultSelection([INSIDE]);
    expect(sel['o-chips']).toBe('in');
    expect(sel['o-onion']).toBe('in');
    expect(sel['o-egg']).toBe('out'); // a paid extra, not part of the build
  });

  it('preselects the first option of a required single-choice group', () => {
    expect(defaultSelection([SIZE])['s-reg']).toBe('in');
  });
});

describe('the kitchen ticket shows differences only', () => {
  it('says nothing at all when the dish is built as standard', () => {
    expect(describeModifications([INSIDE], defaultSelection([INSIDE]))).toEqual([]);
  });

  it('names a removed ingredient', () => {
    const sel = { ...defaultSelection([INSIDE]), 'o-onion': 'out' as const };
    const mods = describeModifications([INSIDE], sel);
    expect(mods).toHaveLength(1);
    expect(mods[0]).toEqual({ text: { he: 'בלי בצל', en: 'No Onion' }, kind: 'removal' });
  });

  it('names an ingredient moved to the side', () => {
    const sel = { ...defaultSelection([INSIDE]), 'o-tahini': 'side' as const };
    expect(describeModifications([INSIDE], sel)[0]).toEqual({
      text: { he: 'טחינה בצד', en: 'Tahini on the side' },
      kind: 'side',
    });
  });

  it('handles several exceptions at once without listing the rest', () => {
    const sel = {
      ...defaultSelection([INSIDE]),
      'o-onion': 'out' as const,
      'o-spicy': 'out' as const,
      'o-tahini': 'side' as const,
    };
    const texts = describeModifications([INSIDE], sel).map((m) => m.text.he);
    expect(texts).toEqual(['טחינה בצד', 'בלי חריף', 'בלי בצל']);
    expect(texts).not.toContain('צ׳יפס'); // still in — must not appear
  });

  it('marks an added extra that is not part of the build', () => {
    const sel = { ...defaultSelection([INSIDE]), 'o-egg': 'in' as const };
    expect(describeModifications([INSIDE], sel)[0].text.he).toBe('תוספת ביצה');
  });
});

describe('pricing', () => {
  it('charges nothing for removing an included ingredient', () => {
    const sel = { ...defaultSelection(GROUPS), 'o-onion': 'out' as const, 'o-tahini': 'side' as const };
    expect(priceDelta(GROUPS, sel)).toBe(0);
  });

  it('charges for a non-default addition', () => {
    const sel = { ...defaultSelection(GROUPS), 'o-egg': 'in' as const };
    expect(priceDelta(GROUPS, sel)).toBe(400);
  });

  it('adds up extras and the chosen size', () => {
    const sel = {
      ...defaultSelection(GROUPS),
      'x-fries': 'in' as const,
      's-reg': 'out' as const,
      's-big': 'in' as const,
    };
    expect(priceDelta(GROUPS, sel)).toBe(800 + 600);
  });
});

describe('validation', () => {
  it('requires a choice in a required single group', () => {
    const sel = { ...defaultSelection(GROUPS), 's-reg': 'out' as const };
    expect(validateSelection(GROUPS, sel)[0].message).toContain('גודל');
  });

  it('rejects more extras than the group allows', () => {
    const sel = { ...defaultSelection(GROUPS), 'x-fries': 'in' as const, 'x-pickle': 'in' as const };
    const tight = [{ ...EXTRAS, maxSelect: 1 }];
    expect(validateSelection(tight, sel)).toHaveLength(1);
  });

  it('passes a standard build', () => {
    expect(validateSelection(GROUPS, defaultSelection(GROUPS))).toEqual([]);
  });
});

describe('cart line identity', () => {
  it('separates two of the same dish built differently', () => {
    const plain = defaultSelection([INSIDE]);
    const noOnion = { ...plain, 'o-onion': 'out' as const };
    expect(selectionKey('itm', plain)).not.toBe(selectionKey('itm', noOnion));
  });

  it('is stable regardless of the order options were clicked', () => {
    const a = { 'o-chips': 'in' as const, 'o-onion': 'out' as const, 'o-tahini': 'side' as const };
    const b = { 'o-tahini': 'side' as const, 'o-chips': 'in' as const, 'o-onion': 'out' as const };
    expect(selectionKey('itm', a)).toBe(selectionKey('itm', b));
  });

  it('merges two identical builds into one line', () => {
    const sel = defaultSelection([INSIDE]);
    expect(selectionKey('itm', sel)).toBe(selectionKey('itm', { ...sel }));
  });
});
