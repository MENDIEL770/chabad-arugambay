import type { MenuCategory } from './types';
import type { ModifierGroup } from './modifiers';

/**
 * The salad and sauces a laffa or pita arrives with. Every one of them is
 * something a customer routinely asks to leave out or have on the side, so
 * they are modelled as removable defaults rather than as paid extras.
 */
function saladGroup(prefix: string): ModifierGroup {
  const inside = [
    ['chips', 'צ׳יפס', 'Chips'],
    ['hummus', 'חומוס', 'Hummus'],
    ['tahini', 'טחינה', 'Tahini'],
    ['spicy', 'חריף', 'Spicy'],
    ['tomato', 'עגבניה', 'Tomato'],
    ['cucumber', 'מלפפון', 'Cucumber'],
    ['onion', 'בצל', 'Onion'],
    ['pickles', 'חמוצים', 'Pickles'],
  ] as const;

  return {
    id: `${prefix}-inside`,
    name: { he: 'מה בפנים', en: 'What is inside' },
    kind: 'includes',
    minSelect: 0,
    maxSelect: 99,
    options: [
      ...inside.map(([id, he, en]) => ({
        id: `${prefix}-${id}`,
        name: { he, en },
        priceDeltaLkr: 0,
        isDefault: true,
        allowSide: true,
        isAvailable: true,
      })),
      {
        id: `${prefix}-egg`,
        name: { he: 'ביצה קשה', en: 'Hard-boiled egg' },
        priceDeltaLkr: 400,
        isDefault: false,
        allowSide: false,
        isAvailable: true,
      },
      {
        id: `${prefix}-amba`,
        name: { he: 'עמבה', en: 'Amba' },
        priceDeltaLkr: 0,
        isDefault: false,
        allowSide: true,
        isAvailable: true,
      },
    ],
  };
}

function breadGroup(prefix: string): ModifierGroup {
  return {
    id: `${prefix}-bread`,
    name: { he: 'לחם', en: 'Bread' },
    kind: 'single',
    minSelect: 1,
    maxSelect: 1,
    options: [
      { id: `${prefix}-pita`,  name: { he: 'פיתה', en: 'Pita' },   priceDeltaLkr: 0,   isDefault: false, allowSide: false, isAvailable: true },
      { id: `${prefix}-laffa`, name: { he: 'לאפה', en: 'Laffa' },  priceDeltaLkr: 300, isDefault: false, allowSide: false, isAvailable: true },
      { id: `${prefix}-plate`, name: { he: 'במנה (בלי לחם)', en: 'On a plate' }, priceDeltaLkr: 0, isDefault: false, allowSide: false, isAvailable: true },
    ],
  };
}

const NO_MODS: ModifierGroup[] = [];

/**
 * Local seed menu. The site runs on this until Supabase credentials are set,
 * so the whole thing is demoable and works offline — the same arrangement as
 * the signage project.
 *
 * Prices are LKR and deliberately realistic for Arugam Bay, so the layout is
 * tested against the digit widths it will actually carry.
 */
export const SEED_MENU: MenuCategory[] = [
  {
    id: 'cat-breakfast',
    name: { he: 'ארוחת בוקר', en: 'Breakfast' },
    sort: 1,
    isActive: true,
    items: [
      {
        id: 'itm-shakshuka',
        categoryId: 'cat-breakfast',
        name: { he: 'שקשוקה', en: 'Shakshuka' },
        description: { he: 'עם חלה טרייה וסלט', en: 'With fresh challah and salad' },
        priceLkr: 2400, imagePath: null, imageUrl: null,
        kosher: 'dairy', tags: ['vegetarian'], prepMinutes: 15, station: 'grill',
        isAvailable: true, stock: 'none', stockQty: null, dailyLimit: null,
        soldToday: 0, sort: 1, modifierGroups: NO_MODS, images: [],
      },
      {
        id: 'itm-israeli-breakfast',
        categoryId: 'cat-breakfast',
        name: { he: 'ארוחת בוקר ישראלית', en: 'Israeli breakfast' },
        description: { he: 'ביצים, סלטים, גבינות, לחם', en: 'Eggs, salads, cheeses, bread' },
        priceLkr: 3100, imagePath: null, imageUrl: null,
        kosher: 'dairy', tags: [], prepMinutes: 20, station: 'cold',
        isAvailable: true, stock: 'daily_limit', stockQty: null, dailyLimit: 20,
        soldToday: 17, sort: 2, modifierGroups: NO_MODS, images: [],
      },
    ],
  },
  {
    id: 'cat-mains',
    name: { he: 'עיקריות', en: 'Mains' },
    sort: 2,
    isActive: true,
    items: [
      {
        id: 'itm-falafel',
        categoryId: 'cat-mains',
        name: { he: 'פלאפל בפיתה', en: 'Falafel in pita' },
        description: { he: 'חומוס, סלטים, עמבה', en: 'Hummus, salads, amba' },
        priceLkr: 1800, imagePath: null, imageUrl: null,
        kosher: 'pareve', tags: ['vegan'], prepMinutes: 10, station: 'grill',
        isAvailable: true, stock: 'none', stockQty: null, dailyLimit: null,
        soldToday: 0, sort: 1,
        modifierGroups: [breadGroup('falafel'), saladGroup('falafel')], images: [],
      },
      {
        id: 'itm-fish-curry',
        categoryId: 'cat-mains',
        name: { he: 'קארי דג סרי-לנקי', en: 'Sri Lankan fish curry' },
        description: { he: 'דג היום, אורז וסמבול', en: 'Catch of the day, rice and sambol' },
        priceLkr: 3200, imagePath: null, imageUrl: null,
        kosher: 'pareve', tags: ['spicy'], prepMinutes: 25, station: 'grill',
        isAvailable: true, stock: 'count', stockQty: 6, dailyLimit: null,
        soldToday: 4, sort: 2, modifierGroups: NO_MODS, images: [],
      },
      {
        id: 'itm-schnitzel',
        categoryId: 'cat-mains',
        name: { he: 'שניצל עוף', en: 'Chicken schnitzel' },
        description: { he: 'עם צ׳יפס ביתי', en: 'With house fries' },
        priceLkr: 3600, imagePath: null, imageUrl: null,
        kosher: 'meat', tags: ['kids'], prepMinutes: 20, station: 'grill',
        isAvailable: false, stock: 'none', stockQty: null, dailyLimit: null,
        soldToday: 12, sort: 3,
        modifierGroups: [breadGroup('schnitzel'), saladGroup('schnitzel')], images: [],
      },
      {
        id: 'itm-shawarma',
        categoryId: 'cat-mains',
        name: { he: 'שווארמה בלאפה', en: 'Shawarma in laffa' },
        description: { he: 'עוף, צ׳יפס בפנים, סלטים וטחינה', en: 'Chicken, chips inside, salads and tahini' },
        priceLkr: 3900, imagePath: null, imageUrl: null,
        kosher: 'meat', tags: [], prepMinutes: 12, station: 'grill',
        isAvailable: true, stock: 'none', stockQty: null, dailyLimit: null,
        soldToday: 0, sort: 0,
        modifierGroups: [breadGroup('shawarma'), saladGroup('shawarma')], images: [],
      },
      {
        id: 'itm-hummus',
        categoryId: 'cat-mains',
        name: { he: 'חומוס עם פול', en: 'Hummus with ful' },
        description: { he: 'עם ביצה, פיתה חמה', en: 'With egg and warm pita' },
        priceLkr: 1600, imagePath: null, imageUrl: null,
        kosher: 'pareve', tags: ['vegetarian'], prepMinutes: 8, station: 'cold',
        isAvailable: true, stock: 'none', stockQty: null, dailyLimit: null,
        soldToday: 0, sort: 4, modifierGroups: NO_MODS, images: [],
      },
    ],
  },
  {
    id: 'cat-drinks',
    name: { he: 'שתייה', en: 'Drinks' },
    sort: 3,
    isActive: true,
    items: [
      {
        id: 'itm-lime',
        categoryId: 'cat-drinks',
        name: { he: 'לימונדה נענע', en: 'Mint lemonade' },
        description: { he: 'סחוט טרי', en: 'Freshly squeezed' },
        priceLkr: 900, imagePath: null, imageUrl: null,
        kosher: 'pareve', tags: ['vegan'], prepMinutes: 5, station: 'bar',
        isAvailable: true, stock: 'none', stockQty: null, dailyLimit: null,
        soldToday: 0, sort: 1, modifierGroups: NO_MODS, images: [],
      },
      {
        id: 'itm-king-coconut',
        categoryId: 'cat-drinks',
        name: { he: 'קוקוס מלכותי', en: 'King coconut' },
        description: { he: 'ישר מהעץ, קר', en: 'Straight off the tree, chilled' },
        priceLkr: 500, imagePath: null, imageUrl: null,
        kosher: 'pareve', tags: ['vegan'], prepMinutes: 2, station: 'bar',
        isAvailable: true, stock: 'count', stockQty: 0, dailyLimit: null,
        soldToday: 24, sort: 2, modifierGroups: NO_MODS, images: [],
      },
    ],
  },
];
