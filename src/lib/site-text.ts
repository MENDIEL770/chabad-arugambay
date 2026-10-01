/**
 * Every editable string on the public site.
 *
 * The default is the source of truth for structure: the admin lists exactly
 * these keys, and the page falls back to the default whenever the database
 * has nothing. That means a missing override, an unrun migration or a
 * deleted row shows the original copy rather than an empty element — a
 * failure mode that is easy to miss until a visitor sees it.
 */
export interface TextEntry {
  /** Which admin section it appears under. */
  group: string;
  /** What it is, in the admin list. */
  label: string;
  he: string;
  en: string;
  /** Long copy gets a textarea rather than a single line. */
  multiline?: boolean;
}

export const SITE_TEXT = {
  'home.lede': {
    group: 'דף הבית',
    label: 'פסקת פתיחה',
    he: 'סעודות על שפת הים, מקום לישון למי שצריך, ואוכל כשר כל השבוע. כל מי שעובר בארוגם ביי מוזמן.',
    en: 'Meals by the sea, a bed for whoever needs one, and kosher food all week.',
    multiline: true,
  },
  'home.services.eyebrow': {
    group: 'דף הבית',
    label: 'תווית מעל הכרטיסים',
    he: 'מה אפשר לעשות כאן',
    en: 'What you can do here',
  },
  'home.services.title': {
    group: 'דף הבית',
    label: 'כותרת הכרטיסים',
    he: 'כל מה שקורה בבית, במקום אחד',
    en: 'Everything happening here, in one place',
  },
  'home.services.body': {
    group: 'דף הבית',
    label: 'משפט מתחת לכותרת',
    he: 'הרשמה, אוכל, טיולים ותשובות — בלי לחפש במי-יודע-איזו קבוצת וואטסאפ.',
    en: 'Registration, food, trips and answers.',
    multiline: true,
  },
  'home.restaurant.title': {
    group: 'דף הבית',
    label: 'כותרת מקטע המסעדה',
    he: 'אוכל כשר, חם, על החוף',
    en: 'Kosher food, hot, on the beach',
  },
  'home.restaurant.body': {
    group: 'דף הבית',
    label: 'טקסט מקטע המסעדה',
    he: 'בשר וחלב בהפרדה מלאה, בהשגחת בית חב״ד. מזמינים מהטלפון, ומקבלים עדכון בוואטסאפ בכל שלב — מהמטבח ועד שהנהג בדרך.',
    en: 'Meat and dairy fully separated, under Chabad supervision.',
    multiline: true,
  },

  'menu.intro': {
    group: 'תפריט',
    label: 'משפט מתחת לכותרת',
    he: 'הכול כשר בהשגחת בית חב״ד, בשר וחלב בהפרדה מלאה. המחירים ברופי סרי-לנקי.',
    en: 'All kosher under Chabad supervision. Prices in Sri Lankan rupees.',
    multiline: true,
  },
  'menu.delivery_note': {
    group: 'תפריט',
    label: 'שורת המשלוח',
    he: 'משלמים לנהג במזומן',
    en: 'Pay the driver in cash',
  },

  'shabbat.intro': {
    group: 'שבתות וחגים',
    label: 'משפט מתחת לכותרת',
    he: 'זמנים לשיטת אדמו״ר הזקן, מחושבים למיקום של ארוגם ביי. הדלקת נרות 18 דקות לפני השקיעה.',
    en: 'Times per the Alter Rebbe, computed for Arugam Bay.',
    multiline: true,
  },
  'shabbat.footnote': {
    group: 'שבתות וחגים',
    label: 'הערה בתחתית',
    he: 'טפסי ההרשמה נפתחים אוטומטית 24 שבתות מראש. מי שמגיע בלי להירשם — תמיד יש מקום, פשוט קשה יותר לתכנן כמה אוכל להכין.',
    en: 'Registration opens automatically 24 weeks ahead.',
    multiline: true,
  },

  'travel.intro': {
    group: 'טיולים',
    label: 'משפט מתחת לכותרת',
    he: 'המלצות ממי שגר כאן, לא מבלוגים. אם משהו חסר — שאלו בוואטסאפ ונוסיף אותו.',
    en: 'Recommendations from people who live here.',
    multiline: true,
  },

  'ask.intro': {
    group: 'שאלו אותנו',
    label: 'משפט מתחת לכותרת',
    he: 'הזמנים והמחירים כאן מתעדכנים לבד מהמערכת, אז הם תמיד נכונים להיום.',
    en: 'Times and prices here update themselves.',
    multiline: true,
  },

  'donate.title': {
    group: 'תרומה',
    label: 'כותרת',
    he: 'הסעודות פתוחות לכל מי שמגיע',
    en: 'The meals are open to anyone who comes',
  },
  'donate.body': {
    group: 'תרומה',
    label: 'טקסט',
    he: 'אף אחד לא משלם כדי להיכנס, ואף אחד לא נשאר בחוץ בגלל כסף. מי שיכול לעזור — עוזר לנו להמשיך להאכיל את מי שלא יכול.',
    en: 'Nobody pays to come in, and nobody is turned away over money.',
    multiline: true,
  },

  'footer.about': {
    group: 'פוטר',
    label: 'טקסט על הבית',
    he: 'פתוח לכל יהודי שעובר כאן — לשבת, לארוחה, או רק לקפה ושיחה.',
    en: 'Open to any Jew passing through.',
    multiline: true,
  },
} as const satisfies Record<string, TextEntry>;

export type TextKey = keyof typeof SITE_TEXT;

/**
 * Read an entry as the shared shape.
 *
 * `as const satisfies` keeps each entry's exact literal type, which is what
 * makes TextKey precise — but it also means an entry without `multiline`
 * genuinely has no such property. Widening here once beats loosening the
 * declaration and losing the key safety.
 */
export function entryFor(key: TextKey): TextEntry {
  return SITE_TEXT[key] as TextEntry;
}

/** Overrides loaded for the current request, keyed the same way. */
export type TextOverrides = Partial<Record<TextKey, { he: string; en: string }>>;

/**
 * Read one string. Falls back through override → code default, so the call
 * site never has to handle a missing value.
 */
export function text(overrides: TextOverrides, key: TextKey, lang: 'he' | 'en' = 'he'): string {
  const override = overrides[key];
  if (override?.[lang]?.trim()) return override[lang];
  return SITE_TEXT[key][lang];
}

/** Grouped for the admin page, preserving the order declared above. */
export function groupedKeys(): { group: string; keys: TextKey[] }[] {
  const out: { group: string; keys: TextKey[] }[] = [];
  for (const key of Object.keys(SITE_TEXT) as TextKey[]) {
    const group = entryFor(key).group;
    const bucket = out.find((g) => g.group === group);
    if (bucket) bucket.keys.push(key);
    else out.push({ group, keys: [key] });
  }
  return out;
}
