/**
 * Every string the public site shows that is not content from the database.
 *
 * Flat keys grouped by prefix. Hebrew is the source: it is what the house
 * writes and what a translator reads from. A test fails when any key is
 * missing an English value, so a half-translated page cannot ship.
 */
export interface Message {
  he: string;
  en: string;
}

export const DICT = {
  'locale.switch': { he: 'English', en: 'עברית' },
  'locale.switchLabel': { he: 'Read this page in English', en: 'קראו את העמוד בעברית' },
} as const satisfies Record<string, Message>;

export type MessageKey = keyof typeof DICT;
