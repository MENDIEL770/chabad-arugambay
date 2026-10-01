/**
 * The restaurant's actual menu, transcribed from the printed card.
 *
 * Kept as data rather than SQL so it can be applied through the API — no
 * clipboard round-trip, which is what corrupted Hebrew on this project
 * once already — and so the import can be verified immediately after.
 *
 * Prices are LKR. Take-away carries a 200 surcharge, which is a
 * fulfilment-level fee rather than a property of any dish.
 */
export const TAKEAWAY_SURCHARGE_LKR = 200;

type Kosher = 'meat' | 'dairy' | 'pareve';
type Station = 'grill' | 'cold' | 'bar' | 'bakery';
type GroupKind = 'includes' | 'single' | 'multi';

export interface MenuOptionSeed {
  he: string;
  en: string;
  price?: number;
  isDefault?: boolean;
  allowSide?: boolean;
}

export interface MenuGroupSeed {
  he: string;
  en: string;
  kind: GroupKind;
  min?: number;
  max?: number;
  options: MenuOptionSeed[];
}

export interface MenuItemSeed {
  he: string;
  en: string;
  descHe?: string;
  descEn?: string;
  price: number;
  kosher: Kosher;
  station?: Station;
  prep?: number;
  tags?: string[];
  groups?: MenuGroupSeed[];
}

export interface MenuCategorySeed {
  he: string;
  en: string;
  items: MenuItemSeed[];
}

/** The salad build shared by all three laffas. */
const laffaInside = (extra: MenuOptionSeed[] = []): MenuGroupSeed => ({
  he: 'מה בפנים',
  en: 'What is inside',
  kind: 'includes',
  min: 0,
  max: 99,
  options: extra,
});

const SIDE_CHOICE: MenuGroupSeed = {
  he: 'תוספת',
  en: 'Side',
  kind: 'single',
  min: 1,
  max: 1,
  options: [
    { he: 'אורז', en: 'Rice' },
    { he: 'צ׳יפס גדול', en: 'Large chips' },
    { he: 'פירה', en: 'Mash' },
    { he: 'פסטה', en: 'Pasta' },
  ],
};

const EXTRA_CHICKEN: MenuGroupSeed = {
  he: 'תוספת עוף',
  en: 'Extra chicken',
  kind: 'single',
  min: 0,
  max: 1,
  options: [
    { he: 'חצי מנה', en: 'Half portion', price: 1000 },
    { he: 'מנה שלמה', en: 'Full portion', price: 2000 },
  ],
};

export const REAL_MENU: MenuCategorySeed[] = [
  {
    he: 'ארוחות בוקר',
    en: 'Breakfast',
    items: [
      {
        he: 'לאפה חביתה', en: 'Omelette laffa',
        descHe: 'חביתה, טחינה / מיונז, בצל, עגבניה, מלפפון',
        descEn: 'Omelette, tahini or mayo, onion, tomato, cucumber',
        price: 1800, kosher: 'pareve', prep: 10,
        groups: [
          laffaInside([
            { he: 'טחינה', en: 'Tahini', isDefault: true },
            { he: 'מיונז', en: 'Mayo' },
            { he: 'בצל', en: 'Onion', isDefault: true },
            { he: 'עגבניה', en: 'Tomato', isDefault: true },
            { he: 'מלפפון', en: 'Cucumber', isDefault: true },
            { he: 'תוספת ביצה', en: 'Extra egg', price: 200, allowSide: false },
          ]),
        ],
      },
      {
        he: 'חביתה בצלחת', en: 'Omelette plate',
        descHe: 'חביתה, טחינה וסלט ישראלי, מוגש לצד לאפה טרייה',
        descEn: 'Omelette, tahini and Israeli salad with fresh laffa',
        price: 2200, kosher: 'pareve', prep: 12,
        groups: [{
          he: 'תוספות', en: 'Extras', kind: 'multi', min: 0, max: 3,
          options: [{ he: 'תוספת ביצה', en: 'Extra egg', price: 200, allowSide: false }],
        }],
      },
      {
        he: 'שקשוקה', en: 'Shakshuka',
        descHe: 'שקשוקה, סלט ישראלי וטחינה, מוגש לצד לאפה טרייה',
        descEn: 'Shakshuka, Israeli salad and tahini with fresh laffa',
        price: 2200, kosher: 'pareve', prep: 15,
      },
      {
        he: 'ארוחת בוקר פינוקים', en: 'Big breakfast',
        descHe: '3 ביצים לבחירה, מטבוחה, סלט ישראלי, טחינה, לאפה ושייק הבית',
        descEn: 'Three eggs your way, matbucha, Israeli salad, tahini, laffa and a house shake',
        price: 3000, kosher: 'pareve', prep: 20,
        groups: [{
          he: 'איך הביצים', en: 'Eggs', kind: 'single', min: 1, max: 1,
          options: [
            { he: 'עין', en: 'Fried' },
            { he: 'מקושקשת', en: 'Scrambled' },
            { he: 'אומלט', en: 'Omelette' },
            { he: 'ביצה קשה', en: 'Hard boiled' },
          ],
        }],
      },
    ],
  },
  {
    he: 'סלטים',
    en: 'Salads',
    items: [
      {
        he: 'סלט ישראלי גדול', en: 'Large Israeli salad',
        descHe: 'מלפפון, עגבניה, בצל קצוץ, גזר מגורד וטחינה',
        descEn: 'Cucumber, tomato, chopped onion, grated carrot and tahini',
        price: 1800, kosher: 'pareve', station: 'cold', prep: 8,
      },
      {
        he: 'סלט קריספי צ׳יקן', en: 'Crispy chicken salad',
        descHe: 'מלפפון, עגבניה, בצל קצוץ, שניצלונים קריספיים ברוטב צ׳ילי מתוק',
        descEn: 'Cucumber, tomato, onion, crispy chicken strips in sweet chilli',
        price: 2500, kosher: 'meat', prep: 15,
      },
    ],
  },
  {
    he: 'סנדוויצים',
    en: 'Sandwiches',
    items: [
      {
        he: 'לאפה שניצל', en: 'Schnitzel laffa',
        descHe: 'שניצל הבית, צ׳יפס, מטבוחה, טחינה, עגבניה, מלפפון, בצל, חצילים',
        descEn: 'House schnitzel, chips, matbucha, tahini, salad, aubergine',
        price: 2800, kosher: 'meat', prep: 15,
        groups: [
          laffaInside([
            { he: 'צ׳יפס', en: 'Chips', isDefault: true },
            { he: 'מטבוחה', en: 'Matbucha', isDefault: true },
            { he: 'טחינה', en: 'Tahini', isDefault: true },
            { he: 'עגבניה', en: 'Tomato', isDefault: true },
            { he: 'מלפפון', en: 'Cucumber', isDefault: true },
            { he: 'בצל', en: 'Onion', isDefault: true },
            { he: 'חצילים', en: 'Aubergine', isDefault: true },
          ]),
        ],
      },
      {
        he: 'לאפה חזה עוף ירושלמי', en: 'Jerusalem chicken laffa',
        descHe: 'חזה עוף בתיבול ירושלמי, צ׳יפס, עגבניה, מלפפון, בצל, רוטב אלף האיים',
        descEn: 'Jerusalem-spiced chicken breast, chips, salad, thousand island',
        price: 2800, kosher: 'meat', prep: 15,
        groups: [
          laffaInside([
            { he: 'צ׳יפס', en: 'Chips', isDefault: true },
            { he: 'עגבניה', en: 'Tomato', isDefault: true },
            { he: 'מלפפון', en: 'Cucumber', isDefault: true },
            { he: 'בצל', en: 'Onion', isDefault: true },
            { he: 'רוטב אלף האיים', en: 'Thousand island', isDefault: true },
          ]),
        ],
      },
      {
        he: 'לאפה שאוורמה', en: 'Shawarma laffa',
        descHe: 'שאוורמה הבית, צ׳יפס, עגבניה, מלפפון, בצל, טחינה',
        descEn: 'House shawarma, chips, tomato, cucumber, onion, tahini',
        price: 2800, kosher: 'meat', prep: 12,
        groups: [
          laffaInside([
            { he: 'צ׳יפס', en: 'Chips', isDefault: true },
            { he: 'עגבניה', en: 'Tomato', isDefault: true },
            { he: 'מלפפון', en: 'Cucumber', isDefault: true },
            { he: 'בצל', en: 'Onion', isDefault: true },
            { he: 'טחינה', en: 'Tahini', isDefault: true },
          ]),
        ],
      },
    ],
  },
  {
    he: 'מנות עיקריות',
    en: 'Main courses',
    items: [
      {
        he: 'צלחת שניצל', en: 'Schnitzel plate',
        descHe: 'שניצל הבית עם תוספת לבחירה',
        descEn: 'House schnitzel with a side of your choice',
        price: 3600, kosher: 'meat', prep: 20,
        groups: [SIDE_CHOICE, EXTRA_CHICKEN],
      },
      {
        he: 'צלחת חזה עוף ירושלמי', en: 'Jerusalem chicken plate',
        descHe: 'חזה עוף בתיבול ירושלמי מסורתי עם תוספת לבחירה',
        descEn: 'Jerusalem-spiced chicken breast with a side of your choice',
        price: 3600, kosher: 'meat', prep: 20,
        groups: [SIDE_CHOICE, EXTRA_CHICKEN],
      },
      {
        he: 'צלחת שאוורמה', en: 'Shawarma plate',
        descHe: 'מנת שאוורמה מפנקת עם תוספת לבחירה',
        descEn: 'Generous shawarma with a side of your choice',
        price: 3600, kosher: 'meat', prep: 18,
        groups: [SIDE_CHOICE, EXTRA_CHICKEN],
      },
      {
        he: 'מוקפץ עוף אסייתי', en: 'Asian chicken stir-fry',
        descHe: 'איטריות אורז מוקפצות עם עוף, כרוב, בצל, גזר, שום וג׳ינג׳ר ברוטב טריאקי וצ׳ילי מתוק',
        descEn: 'Rice noodles with chicken, cabbage, onion, carrot, garlic and ginger',
        price: 2800, kosher: 'meat', prep: 18,
      },
    ],
  },
  {
    he: 'צמחוני',
    en: 'Vegetarian',
    items: [
      {
        he: 'פסטה ברוטב עגבניות', en: 'Pasta in tomato sauce',
        descHe: 'פסטה ברוטב עגבניות טריות, בצל ושום',
        descEn: 'Pasta in fresh tomato sauce with onion and garlic',
        price: 1400, kosher: 'pareve', prep: 15, tags: ['vegetarian'],
      },
      {
        he: 'מוקפץ נודלס', en: 'Noodle stir-fry',
        descHe: 'נודלס מוקפץ ברוטב אסייתי עם כרוב, בצל, גזר, שום וג׳ינג׳ר',
        descEn: 'Stir-fried noodles with cabbage, onion, carrot, garlic and ginger',
        price: 1500, kosher: 'pareve', prep: 15, tags: ['vegetarian'],
      },
    ],
  },
  {
    he: 'תוספות',
    en: 'Sides',
    items: [
      { he: 'צ׳יפס', en: 'Chips', price: 1000, kosher: 'pareve', prep: 10 },
      { he: 'צ׳יפס גדול', en: 'Large chips', price: 1500, kosher: 'pareve', prep: 12 },
      { he: 'אורז', en: 'Rice', price: 1000, kosher: 'pareve', prep: 5 },
      { he: 'פירה', en: 'Mash', price: 1000, kosher: 'pareve', prep: 5 },
      { he: 'לחם', en: 'Bread', price: 350, kosher: 'pareve', station: 'bakery', prep: 2 },
      { he: 'לאפה', en: 'Laffa', price: 400, kosher: 'pareve', station: 'bakery', prep: 3 },
    ],
  },
  {
    he: 'קינוחים ושייקים',
    en: 'Desserts and shakes',
    items: [
      {
        he: 'שייק אלוקי', en: 'House shake',
        descHe: 'פירות לבחירה', descEn: 'Your choice of fruit',
        price: 1000, kosher: 'pareve', station: 'bar', prep: 5,
        groups: [{
          he: 'פרי', en: 'Fruit', kind: 'single', min: 1, max: 1,
          options: [
            { he: 'מנגו', en: 'Mango' },
            { he: 'אננס', en: 'Pineapple' },
            { he: 'בננה', en: 'Banana' },
            { he: 'פסיפלורה', en: 'Passionfruit' },
          ],
        }],
      },
      {
        he: 'צלחת פירות', en: 'Fruit plate',
        descHe: 'מנגו, אננס, אבטיח, בננה, פסיפלורה',
        descEn: 'Mango, pineapple, watermelon, banana, passionfruit',
        price: 1200, kosher: 'pareve', station: 'cold', prep: 8,
      },
    ],
  },
  {
    he: 'שתייה',
    en: 'Drinks',
    items: [
      {
        he: 'שתייה קלה', en: 'Soft drink',
        descHe: 'ספרייט / קולה / קולה זירו', descEn: 'Sprite, Coke or Coke Zero',
        price: 400, kosher: 'pareve', station: 'bar', prep: 2,
        groups: [{
          he: 'איזו', en: 'Which', kind: 'single', min: 1, max: 1,
          options: [
            { he: 'ספרייט', en: 'Sprite' },
            { he: 'קולה', en: 'Coke' },
            { he: 'קולה זירו', en: 'Coke Zero' },
          ],
        }],
      },
      { he: 'מים / סודה', en: 'Water or soda', price: 300, kosher: 'pareve', station: 'bar', prep: 1 },
    ],
  },
];
