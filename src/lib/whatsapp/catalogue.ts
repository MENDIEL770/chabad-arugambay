/**
 * Every message the house can send, what it knows about, and the wording it
 * starts from.
 *
 * The Hebrew lives here rather than in the migration: Hebrew in a .sql file
 * on this project has been corrupted by a clipboard round-trip before. The
 * table is seeded from this catalogue the first time the editor is opened.
 *
 * The default wording is the wording that was previously hard-coded, so
 * turning the editor on changes nothing until somebody edits something.
 */

export type MessageEvent =
  | 'order_received' | 'order_accepted' | 'order_ready' | 'order_dispatched'
  | 'order_delivered' | 'order_rejected'
  | 'registration_received' | 'registration_confirmed' | 'registration_reminder'
  | 'shabbat_times';

export type MessageChannel = 'whatsapp' | 'email';

export interface Placeholder {
  key: string;
  label: string;
  /** A realistic value, so the preview reads like a real message. */
  sample: string;
}

/** Available to every template; not repeated in each list. */
export const COMMON_PLACEHOLDERS: Placeholder[] = [
  { key: 'name', label: 'שם הלקוח', sample: 'מנדי' },
  { key: 'house', label: 'שם בית חב״ד', sample: 'בית חב״ד ארוגם ביי' },
  { key: 'phone', label: 'הטלפון שלנו', sample: '+94 76 123 4567' },
  { key: 'site', label: 'כתובת האתר', sample: 'chabad-arugambay.vercel.app' },
];

const ORDER: Placeholder[] = [
  { key: 'code', label: 'מספר הזמנה', sample: 'A7K2' },
  { key: 'total', label: 'סכום', sample: 'LKR 4,500' },
  { key: 'items', label: 'רשימת המנות', sample: 'שווארמה בלאפה ×2\nחומוס' },
  { key: 'fulfillment', label: 'משלוח / איסוף / ישיבה', sample: 'משלוח' },
  { key: 'track_url', label: 'קישור למעקב', sample: 'https://…/r/A7K2' },
  { key: 'eta', label: 'זמן משוער (דקות)', sample: '35' },
  { key: 'driver', label: 'שם הנהג', sample: 'Suresh' },
  { key: 'driver_phone', label: 'טלפון הנהג', sample: '+94 77 987 6543' },
  { key: 'reason', label: 'סיבת הדחייה', sample: 'אזל המלאי' },
  // Empty unless the order is actually cash-on-delivery, so the line
  // disappears for everyone else rather than reading as a demand.
  { key: 'cash_note', label: 'תשלום במזומן לנהג', sample: 'לתשלום לנהג במזומן: LKR 4,500' },
];

const REGISTRATION: Placeholder[] = [
  { key: 'event_title', label: 'שם האירוע', sample: 'שבת פרשת נח' },
  { key: 'event_date', label: 'תאריך', sample: 'שישי, 24 באוקטובר' },
  { key: 'meals', label: 'הסעודות שנרשמו', sample: 'ליל שבת 19:30 · צהריים 13:00' },
  { key: 'guests', label: 'מספר הסועדים', sample: '2' },
  { key: 'code', label: 'קוד הרשמה', sample: 'SH-4821' },
  { key: 'total', label: 'סכום', sample: '180 ₪' },
];

const ZMANIM: Placeholder[] = [
  { key: 'candle_lighting', label: 'הדלקת נרות', sample: '17:48' },
  { key: 'havdalah', label: 'צאת השבת', sample: '18:40' },
  { key: 'parasha', label: 'פרשת השבוע', sample: 'נח' },
];

export interface MessageDef {
  event: MessageEvent;
  group: 'מסעדה' | 'אירועים' | 'שבת';
  label: string;
  /** When it fires, in words. Shown under the title in the editor. */
  when: string;
  placeholders: Placeholder[];
  defaultBody: string;
  /** Whether it starts switched on once WhatsApp is connected. */
  onByDefault: boolean;
  /** Not yet wired to anything that fires it. */
  comingSoon?: boolean;
}

export const MESSAGES: MessageDef[] = [
  {
    event: 'order_received',
    group: 'מסעדה',
    label: 'הזמנה התקבלה',
    when: 'מיד כשלקוח שולח הזמנה מהאתר',
    placeholders: ORDER,
    onByDefault: true,
    defaultBody:
      'שלום {{name}}, קיבלנו את ההזמנה שלכם 🙂\n' +
      'מספר {{code}} · {{total}}\n\n' +
      'נאשר אותה עוד רגע ונעדכן כמה זמן זה ייקח.\n\n' +
      'מעקב: {{track_url}}',
  },
  {
    event: 'order_accepted',
    group: 'מסעדה',
    label: 'ההזמנה אושרה',
    when: 'כשהמטבח מאשר את ההזמנה',
    placeholders: ORDER,
    onByDefault: true,
    // eta on its own line on purpose: the kitchen often accepts without
    // setting one, and a vanishing value mid-sentence leaves
    // "מוכן בעוד כ- דקות". On its own line it simply disappears.
    defaultBody: 'הזמנה {{code}} אושרה 👍\nמוכן בעוד כ-{{eta}} דקות.\n\nמעקב: {{track_url}}',
  },
  {
    event: 'order_ready',
    group: 'מסעדה',
    label: 'ההזמנה מוכנה',
    when: 'כשהמטבח מסמן שההזמנה מוכנה',
    placeholders: ORDER,
    onByDefault: true,
    defaultBody: 'הזמנה {{code}} מוכנה 🛍️\nמחכה לכם בדלפק.',
  },
  {
    event: 'order_dispatched',
    group: 'מסעדה',
    label: 'השליח יצא',
    when: 'כשההזמנה נמסרת לשליח',
    placeholders: ORDER,
    onByDefault: true,
    defaultBody:
      'הזמנה {{code}} בדרך אליכם 🛵\n' +
      'הנהג: {{driver}} · {{driver_phone}}\n' +
      '{{cash_note}}\n\n' +
      'מעקב: {{track_url}}',
  },
  {
    event: 'order_delivered',
    group: 'מסעדה',
    label: 'ההזמנה נמסרה',
    when: 'כשההזמנה מסומנת כנמסרה',
    placeholders: ORDER,
    onByDefault: true,
    defaultBody: 'הזמנה {{code}} נמסרה. בתיאבון! 🙏\n\nתודה שהזמנתם מ{{house}}.',
  },
  {
    event: 'order_rejected',
    group: 'מסעדה',
    label: 'ההזמנה נדחתה',
    when: 'כשהמטבח דוחה הזמנה',
    placeholders: ORDER,
    onByDefault: true,
    defaultBody:
      'מצטערים — לא נוכל להכין את הזמנה {{code}}.\n' +
      'הסיבה: {{reason}}\n\n' +
      'לא חויבתם על כלום. אם זו טעות, כתבו לנו כאן ונסדר.',
  },
  {
    event: 'registration_received',
    group: 'אירועים',
    label: 'הרשמה התקבלה',
    when: 'מיד עם שליחת טופס הרשמה לשבת או חג',
    placeholders: REGISTRATION,
    onByDefault: true,
    defaultBody:
      'שלום {{name}}, נרשמתם ל{{event_title}} 🕯️\n' +
      '{{event_date}}\n\n' +
      '{{meals}}\n' +
      'מספר סועדים: {{guests}}\n' +
      'קוד הרשמה: {{code}}\n\n' +
      'נשמח לראותכם!\n{{house}}',
  },
  {
    event: 'registration_confirmed',
    group: 'אירועים',
    label: 'הרשמה אושרה',
    when: 'כשהרשמה מאושרת או משולמת',
    placeholders: REGISTRATION,
    onByDefault: false,
    defaultBody:
      'ההרשמה שלכם ל{{event_title}} אושרה ✅\n' +
      '{{event_date}}\n{{meals}}\n\nשבת שלום!',
  },
  {
    event: 'registration_reminder',
    group: 'אירועים',
    label: 'תזכורת לפני האירוע',
    when: 'יום לפני האירוע',
    placeholders: REGISTRATION,
    onByDefault: false,
    comingSoon: true,
    defaultBody: 'תזכורת: מחר {{event_title}} 🕯️\n{{meals}}\n\nמחכים לכם!\n{{house}}',
  },
  {
    event: 'shabbat_times',
    group: 'שבת',
    label: 'זמני שבת שבועיים',
    when: 'כל יום חמישי, למי שביקש לקבל',
    placeholders: ZMANIM,
    onByDefault: false,
    comingSoon: true,
    defaultBody:
      'שבת שלום! 🕯️\n' +
      'פרשת {{parasha}}\n' +
      'הדלקת נרות: {{candle_lighting}}\n' +
      'צאת השבת: {{havdalah}}\n\n{{house}}',
  },
];

export const MESSAGE_BY_EVENT = new Map(MESSAGES.map((m) => [m.event, m]));

/** Every placeholder a given message may use, common ones included. */
export function placeholdersFor(event: MessageEvent): Placeholder[] {
  return [...(MESSAGE_BY_EVENT.get(event)?.placeholders ?? []), ...COMMON_PLACEHOLDERS];
}

/** Sample values for every placeholder, for the preview. */
export function sampleValues(event: MessageEvent): Record<string, string> {
  return Object.fromEntries(placeholdersFor(event).map((p) => [p.key, p.sample]));
}

/** The order-status names map one-to-one onto the first six events. */
export function eventForOrderStatus(status: string): MessageEvent | null {
  const e = `order_${status}` as MessageEvent;
  return MESSAGE_BY_EVENT.has(e) ? e : null;
}
