import { DICT, type MessageKey } from './dictionary';
import { DEFAULT_LOCALE, type Locale } from './locale';

export type { MessageKey };

/**
 * Look up one string.
 *
 * A missing English translation falls back to the Hebrew rather than to the
 * key, because a visitor seeing a Hebrew sentence on an English page is a
 * cosmetic problem and seeing `nav.menu` is a broken one. A test fails the
 * build when any key is missing, so the fallback should never fire in
 * practice — it exists for the moment between adding a key and translating
 * it.
 */
export function translate(
  locale: Locale,
  key: MessageKey,
  vars?: Record<string, string | number>,
): string {
  const entry = DICT[key];
  if (!entry) return key;

  const raw = entry[locale] || entry[DEFAULT_LOCALE] || key;
  if (!vars) return raw;

  return raw.replace(/\{(\w+)\}/g, (m, name: string) =>
    name in vars ? String(vars[name]) : m,
  );
}

export type T = (key: MessageKey, vars?: Record<string, string | number>) => string;

/** A bound lookup, so components call `t('nav.menu')`. */
export function makeT(locale: Locale): T {
  return (key, vars) => translate(locale, key, vars);
}

/** Pick the right side of any `{he, en}` value coming out of the database. */
export function pick(
  locale: Locale,
  value: { he?: string | null; en?: string | null } | null | undefined,
  fallback = '',
): string {
  if (!value) return fallback;
  const chosen = locale === 'en' ? value.en : value.he;
  // Content is written in Hebrew first; an untranslated row shows the
  // Hebrew rather than an empty element.
  return (chosen || value.he || value.en || fallback) as string;
}
