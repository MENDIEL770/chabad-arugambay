import type { I18n } from './types';

/**
 * Knowledge base behind "שאלו אותנו".
 *
 * Deliberately not a language model. Most of what people ask has exactly one
 * correct answer that changes weekly — when the registration closes, what a
 * dish costs, when the house is open — and the failure mode of a generative
 * answer there is a confidently wrong time. So: curated entries, matched by
 * keyword, with the volatile parts filled from live data at render time.
 *
 * `answer` receives the current facts. Anything time- or price-dependent must
 * come from there and never be written into the string.
 */
export interface KbFacts {
  occasionTitle: string | null;
  candleLighting: string | null;
  havdalah: string | null;
  registrationCloses: string | null;
  storeStatus: string;
  storeOpen: boolean;
  cheapestDishLkr: number | null;
  deliveryFeeLkr: number;
}

export interface KbEntry {
  id: string;
  question: I18n;
  /** Extra words people actually type, for matching. */
  keywords: string[];
  answer: (f: KbFacts) => string;
  link?: { href: string; label: string };
}

const lkr = (n: number) => `${n.toLocaleString('en-US')} LKR`;

export const KB: KbEntry[] = [
  {
    id: 'registration-deadline',
    question: { he: 'עד מתי אפשר להירשם לשבת או לחג?', en: 'When does registration close?' },
    keywords: ['הרשמה', 'נסגרת', 'נסגר', 'דדליין', 'מתי', 'להירשם', 'רישום'],
    answer: (f) =>
      f.registrationCloses
        ? `ההרשמה ל${f.occasionTitle} נסגרת ב-${f.registrationCloses}, כדי שנספיק לקנות ולבשל. אחרי זה אפשר עדיין להגיע — אבל בלי אוכל מובטח.`
        : 'אין כרגע אירוע פתוח להרשמה. בדקו שוב בקרוב.',
    link: { href: '/shabbat', label: 'לזמנים ולהרשמה' },
  },
  {
    id: 'candle-lighting',
    question: { he: 'מתי הדלקת נרות?', en: 'When is candle lighting?' },
    keywords: ['נרות', 'הדלקה', 'הדלקת', 'שקיעה', 'זמן', 'כניסת שבת'],
    answer: (f) =>
      f.candleLighting
        ? `הדלקת נרות ל${f.occasionTitle} ב-${f.candleLighting}, וצאת ב-${f.havdalah}. הזמנים לשיטת אדמו״ר הזקן, 18 דקות לפני השקיעה.`
        : 'הזמנים מתעדכנים אוטומטית בדף הזמנים.',
    link: { href: '/shabbat', label: 'כל הזמנים' },
  },
  {
    id: 'opening-hours',
    question: { he: 'מתי בית חב״ד פתוח?', en: 'When are you open?' },
    keywords: ['פתוח', 'סגור', 'שעות', 'פתיחה', 'מתי'],
    answer: (f) =>
      `כרגע ${f.storeStatus}. בימי חול המסעדה פתוחה 11:00–21:30. בשבת ובחג הכול סגור מהדלקת נרות ועד חצי שעה אחרי הצאת.`,
    link: { href: '/menu', label: 'לתפריט' },
  },
  {
    id: 'prices',
    question: { he: 'כמה עולה מנה במסעדה?', en: 'How much is a dish?' },
    keywords: ['מחיר', 'עולה', 'כמה', 'מנה', 'אוכל', 'תפריט', 'יקר', 'זול'],
    answer: (f) =>
      f.cheapestDishLkr
        ? `המחירים ברופי סרי-לנקי, מ-${lkr(f.cheapestDishLkr)} ומעלה. המחיר המעודכן של כל מנה מופיע בתפריט.`
        : 'המחירים מופיעים בתפריט ומתעדכנים שם.',
    link: { href: '/menu', label: 'לתפריט' },
  },
  {
    id: 'delivery',
    question: { he: 'יש משלוחים? כמה זה עולה?', en: 'Do you deliver?' },
    keywords: ['משלוח', 'משלוחים', 'שליח', 'להביא', 'הביתה', 'נהג'],
    answer: (f) =>
      `כן, לאזור ארוגם ביי — ${lkr(f.deliveryFeeLkr)}, בערך 35 דקות. משלמים לנהג במזומן ברופי. מחוץ לאזור אפשר לאסוף.`,
    link: { href: '/menu', label: 'להזמנה' },
  },
  {
    id: 'kashrut',
    question: { he: 'האוכל כשר? באיזו השגחה?', en: 'Is the food kosher?' },
    keywords: ['כשר', 'כשרות', 'השגחה', 'מהדרין', 'בשרי', 'חלבי', 'פרווה'],
    answer: () =>
      'הכול כשר בהשגחת בית חב״ד, בשר וחלב בהפרדה מלאה — שני מטבחים, שני סטים של כלים. הבשר מיובא, הירקות נבדקים כאן.',
    link: { href: '/articles', label: 'איך הכשרות עובדת כאן' },
  },
  {
    id: 'sleeping',
    question: { he: 'אפשר לישון בבית חב״ד?', en: 'Can I sleep at Chabad?' },
    keywords: ['לישון', 'שינה', 'מיטה', 'להתארח', 'אכסניה', 'מקום'],
    answer: () =>
      'יש מספר מצומצם של מיטות, בעיקר לשבתות וחגים. סמנו את זה בטופס ההרשמה ונחזור אליכם. אם מלא — נעזור למצוא מקום בסביבה.',
    link: { href: '/travel', label: 'המלצות לינה' },
  },
  {
    id: 'getting-here',
    question: { he: 'איך מגיעים מקולומבו?', en: 'How do I get here from Colombo?' },
    keywords: ['קולומבו', 'להגיע', 'דרך', 'אוטובוס', 'רכבת', 'טיסה', 'נסיעה', 'תחבורה'],
    answer: () =>
      'הדרך הנפוצה היא אוטובוס לפוטוביל (8–10 שעות) ומשם טוק-טוק, או מונית פרטית ישירה (בערך 6 שעות). יש גם טיסה פנימית לבטיקלואה.',
    link: { href: '/articles', label: 'המדריך המלא' },
  },
  {
    id: 'cost',
    question: { he: 'כמה עולה סעודת שבת?', en: 'What does a Shabbat meal cost?' },
    keywords: ['עולה', 'מחיר', 'סעודה', 'שבת', 'תשלום', 'כסף', 'חינם'],
    answer: () =>
      'מבוגר 55 ₪, ילד 30 ₪ לסעודה. מי שאין לו — מוזמן בכל מקרה, פשוט כתבו לנו. אף אחד לא נשאר בחוץ בגלל כסף.',
    link: { href: '/shabbat', label: 'להרשמה' },
  },
];

export interface DishFact {
  nameHe: string;
  nameEn: string;
  priceLkr: number;
  available: boolean;
  descriptionHe: string;
}

function normalise(s: string): string {
  return s
    .toLowerCase()
    .replace(/[ךםןףץ]/g, (c) => ({ ך: 'כ', ם: 'מ', ן: 'נ', ף: 'פ', ץ: 'צ' })[c]!)
    .replace(/["'״׳?!.,]/g, '');
}

/**
 * Answer "how much is <dish>" directly.
 *
 * Asking about a specific dish and being told the cheapest item on the menu
 * is the kind of near-miss that makes people stop trusting the whole thing.
 * Dish names are matched before the general entries so the precise answer
 * wins when one exists.
 */
export function matchDish(query: string, dishes: DishFact[]): DishFact | null {
  const q = normalise(query);
  if (!q) return null;

  // Longest name first, so "ארוחת בוקר ישראלית" beats "ארוחת בוקר".
  const ranked = [...dishes].sort((a, b) => b.nameHe.length - a.nameHe.length);

  for (const d of ranked) {
    const he = normalise(d.nameHe);
    const en = normalise(d.nameEn);
    if (q.includes(he) || (en.length > 3 && q.includes(en))) return d;
    // Also match on the distinctive first word ("שקשוקה" in "שקשוקה עם חלה").
    const head = he.split(/\s+/)[0];
    if (head.length > 3 && q.includes(head)) return d;
  }
  return null;
}

export function describeDish(d: DishFact): string {
  const price = `${d.priceLkr.toLocaleString('en-US')} LKR`;
  const ils = Math.round(d.priceLkr / 100);
  const base = `${d.nameHe} — ${price} (בערך ${ils} ₪)${d.descriptionHe ? `, ${d.descriptionHe}` : ''}.`;
  return d.available ? base : `${base} אזל להיום, אבל בדרך כלל יש.`;
}

/**
 * Score entries against a free-text question. Simple token overlap — the
 * corpus is small and curated, so precision matters more than cleverness, and
 * a wrong confident answer is worse than showing two candidates.
 */
export function searchKb(query: string): KbEntry[] {
  const tokens = normalise(query).split(/\s+/).filter((t) => t.length > 1);
  if (tokens.length === 0) return KB;

  return KB.map((entry) => {
      const hay = normalise(`${entry.question.he} ${entry.keywords.join(' ')}`);
      const score = tokens.reduce((s, t) => (hay.includes(t) ? s + 1 : s), 0);
      return { entry, score };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((r) => r.entry);
}
