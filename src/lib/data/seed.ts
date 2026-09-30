import type { MenuCategory } from './types';

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
        soldToday: 0, sort: 1,
      },
      {
        id: 'itm-israeli-breakfast',
        categoryId: 'cat-breakfast',
        name: { he: 'ארוחת בוקר ישראלית', en: 'Israeli breakfast' },
        description: { he: 'ביצים, סלטים, גבינות, לחם', en: 'Eggs, salads, cheeses, bread' },
        priceLkr: 3100, imagePath: null, imageUrl: null,
        kosher: 'dairy', tags: [], prepMinutes: 20, station: 'cold',
        isAvailable: true, stock: 'daily_limit', stockQty: null, dailyLimit: 20,
        soldToday: 17, sort: 2,
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
      },
      {
        id: 'itm-fish-curry',
        categoryId: 'cat-mains',
        name: { he: 'קארי דג סרי-לנקי', en: 'Sri Lankan fish curry' },
        description: { he: 'דג היום, אורז וסמבול', en: 'Catch of the day, rice and sambol' },
        priceLkr: 3200, imagePath: null, imageUrl: null,
        kosher: 'pareve', tags: ['spicy'], prepMinutes: 25, station: 'grill',
        isAvailable: true, stock: 'count', stockQty: 6, dailyLimit: null,
        soldToday: 4, sort: 2,
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
      },
      {
        id: 'itm-hummus',
        categoryId: 'cat-mains',
        name: { he: 'חומוס עם פול', en: 'Hummus with ful' },
        description: { he: 'עם ביצה, פיתה חמה', en: 'With egg and warm pita' },
        priceLkr: 1600, imagePath: null, imageUrl: null,
        kosher: 'pareve', tags: ['vegetarian'], prepMinutes: 8, station: 'cold',
        isAvailable: true, stock: 'none', stockQty: null, dailyLimit: null,
        soldToday: 0, sort: 4,
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
        soldToday: 0, sort: 1,
      },
      {
        id: 'itm-king-coconut',
        categoryId: 'cat-drinks',
        name: { he: 'קוקוס מלכותי', en: 'King coconut' },
        description: { he: 'ישר מהעץ, קר', en: 'Straight off the tree, chilled' },
        priceLkr: 500, imagePath: null, imageUrl: null,
        kosher: 'pareve', tags: ['vegan'], prepMinutes: 2, station: 'bar',
        isAvailable: true, stock: 'count', stockQty: 0, dailyLimit: null,
        soldToday: 24, sort: 2,
      },
    ],
  },
];
