import type { I18n } from './types';
import type { IconName } from '@/components/ui/icon';

export type TravelTier = 'luxury' | 'standard' | 'backpacker' | 'family';

export interface Stay {
  id: string;
  name: string;
  blurb: I18n;
  tiers: TravelTier[];
  nightlyUsd: number;
  /** Affiliate destination. Empty until the Booking partner id is issued. */
  bookingUrl: string | null;
  walkMinutes: number | null;
  icon: IconName;
}

export interface Tip {
  id: string;
  title: I18n;
  body: I18n;
  tags: string[];
  icon: IconName;
}

export interface Article {
  slug: string;
  title: I18n;
  excerpt: I18n;
  icon: IconName;
  minutes: number;
}

export const TIER_LABEL: Record<TravelTier, string> = {
  luxury: 'יוקרתי',
  standard: 'רגיל',
  backpacker: 'טרמפיסט',
  family: 'משפחות',
};

/**
 * Seed recommendations. Written from what is actually in Arugam Bay rather
 * than filler, so the search and the tier filter are exercised against real
 * spread. `bookingUrl` stays null until the affiliate id exists — a link that
 * silently earns nothing is worse than no link.
 */
export const STAYS: Stay[] = [
  {
    id: 'hideaway',
    name: 'Hideaway Arugam Bay',
    blurb: { he: 'חמש דקות הליכה מבית חב״ד, בריכה, ארוחת בוקר טובה.',
             en: 'Five minutes from Chabad, pool, good breakfast.' },
    tiers: ['standard', 'family'], nightlyUsd: 48, bookingUrl: null,
    walkMinutes: 5, icon: 'bed',
  },
  {
    id: 'main-point',
    name: 'Main Point Surf Camp',
    blurb: { he: 'על הגל עצמו. מיטות בדורם, שיעורי גלישה, קהילה צעירה.',
             en: 'On the break. Dorm beds, surf lessons, young crowd.' },
    tiers: ['backpacker'], nightlyUsd: 12, bookingUrl: null,
    walkMinutes: 12, icon: 'surf',
  },
  {
    id: 'kottukal',
    name: 'Kottukal Beach House',
    blurb: { he: 'וילות על החוף, שקט, מתאים למשפחות עם ילדים קטנים.',
             en: 'Beachfront villas, quiet, good for small children.' },
    tiers: ['luxury', 'family'], nightlyUsd: 140, bookingUrl: null,
    walkMinutes: 25, icon: 'palm',
  },
  {
    id: 'surf-n-sun',
    name: 'Surf N Sun',
    blurb: { he: 'קבנות עץ מול הים, מחיר הוגן, בעלים מקומיים.',
             en: 'Wooden cabanas facing the sea, fair price, local owners.' },
    tiers: ['standard', 'backpacker'], nightlyUsd: 30, bookingUrl: null,
    walkMinutes: 8, icon: 'hut',
  },
];

export const TIPS: Tip[] = [
  {
    id: 'surf-beginners',
    title: { he: 'ספוט גלישה למתחילים', en: 'Beginner surf spot' },
    body: { he: 'Baby Point בצד הצפוני — גלים קטנים וקרקעית חול. מדריכים מקומיים על החוף, בערך 3,000 LKR לשיעור.',
            en: 'Baby Point on the north side — small waves, sandy bottom.' },
    tags: ['גלישה', 'מתחילים', 'חוף'], icon: 'surf',
  },
  {
    id: 'lagoon-safari',
    title: { he: 'ספארי בלגונה', en: 'Lagoon safari' },
    body: { he: 'פוטוביל לגון בזריחה — פילים, תנינים וציפורים. יוצאים ב-5:30, חוזרים לפני החום.',
            en: 'Pottuvil lagoon at sunrise — elephants, crocodiles, birds.' },
    tags: ['טבע', 'זריחה', 'משפחות'], icon: 'binoculars',
  },
  {
    id: 'tuktuk-price',
    title: { he: 'כמה עולה טוק-טוק', en: 'What a tuk-tuk should cost' },
    body: { he: 'בתוך ארוגם ביי 300–500 LKR. לפוטוביל 800. לשדה התעופה במטרה — 12,000 ומעלה. סכמו מראש, תמיד.',
            en: 'Within Arugam Bay 300–500 LKR. Agree the price first, always.' },
    tags: ['תחבורה', 'מחירים'], icon: 'tuktuk',
  },
  {
    id: 'elephant-rock',
    title: { he: 'שקיעה מאלפנט רוק', en: 'Sunset at Elephant Rock' },
    body: { he: 'הליכה של 40 דקות לאורך החוף, או טוק-טוק. עלו שעה לפני השקיעה — בדקו את הזמן בדף הזמנים.',
            en: 'Forty-minute walk along the beach, or a tuk-tuk.' },
    tags: ['שקיעה', 'הליכה', 'נוף'], icon: 'mountain',
  },
];

export const ARTICLES: Article[] = [
  {
    slug: 'colombo-to-arugam-bay',
    title: { he: 'מקולומבו לארוגם ביי — כל הדרכים', en: 'Colombo to Arugam Bay' },
    excerpt: { he: 'אוטובוס, רכבת, טוק-טוק או טיסה פנימית. כמה זמן, כמה עולה, ומה כדאי.',
               en: 'Bus, train, tuk-tuk or domestic flight.' },
    icon: 'bus', minutes: 6,
  },
  {
    slug: 'shabbat-in-sri-lanka',
    title: { he: 'שבת בסרי לנקה — מה צריך לדעת', en: 'Shabbat in Sri Lanka' },
    excerpt: { he: 'זמני הדלקה, איפה מתפללים, ואיך זה עובד כשאתה רחוק מהבית.',
               en: 'Candle lighting, minyan, and being far from home.' },
    icon: 'candle', minutes: 4,
  },
  {
    slug: 'surf-season',
    title: { he: 'עונת הגלישה בארוגם ביי', en: 'The surf season' },
    excerpt: { he: 'אפריל עד אוקטובר, איזה ספוט מתאים למי, ואיפה לשכור ציוד.',
               en: 'April to October, which break suits whom.' },
    icon: 'waves', minutes: 5,
  },
  {
    slug: 'kashrut-here',
    title: { he: 'איך הכשרות עובדת כאן', en: 'How kashrut works here' },
    excerpt: { he: 'מה מייבאים, מה קונים בשוק המקומי, ולמה אין בשר טרי כל יום.',
               en: 'What we import, what we buy locally.' },
    icon: 'leaf', minutes: 7,
  },
];
