/**
 * Two languages, Hebrew first.
 *
 * Hebrew lives at the bare path (`/menu`) and English under a prefix
 * (`/en/menu`). The house's own community reads Hebrew, so the primary
 * audience gets the clean URL and every link already shared keeps working;
 * the prefix is added by a rewrite rather than a redirect, so nothing
 * bounces.
 */
export const LOCALES = ['he', 'en'] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'he';

export function isLocale(v: unknown): v is Locale {
  return typeof v === 'string' && (LOCALES as readonly string[]).includes(v);
}

export function dirOf(locale: Locale): 'rtl' | 'ltr' {
  return locale === 'he' ? 'rtl' : 'ltr';
}

/** The BCP-47 tag for <html lang> and for toLocaleString. */
export function langOf(locale: Locale): string {
  return locale === 'he' ? 'he-IL' : 'en-GB';
}

export const LOCALE_LABEL: Record<Locale, string> = {
  he: 'עברית',
  en: 'English',
};

/**
 * Build a path in the given locale.
 *
 * Takes an unprefixed path — the way every link in the code is written —
 * and returns what the browser should navigate to. Keeping this in one
 * function is what stops half the links losing the language when someone
 * is reading in English.
 */
export function localePath(locale: Locale, path: string): string {
  const clean = path.startsWith('/') ? path : `/${path}`;
  if (locale === DEFAULT_LOCALE) return clean;
  return clean === '/' ? `/${locale}` : `/${locale}${clean}`;
}

/** Strip a locale prefix off a path, giving the canonical unprefixed form. */
export function stripLocale(path: string): { locale: Locale; path: string } {
  const m = path.match(/^\/([a-z]{2})(?=\/|$)/);
  if (m && isLocale(m[1]) && m[1] !== DEFAULT_LOCALE) {
    const rest = path.slice(m[0].length) || '/';
    return { locale: m[1], path: rest };
  }
  return { locale: DEFAULT_LOCALE, path };
}

/** Pick a locale from an Accept-Language header. Hebrew unless English wins. */
export function fromAcceptLanguage(header: string | null): Locale {
  if (!header) return DEFAULT_LOCALE;
  // q-values, highest first. "he" anywhere means Hebrew: the site is
  // Hebrew-first and a Hebrew speaker should never be sent to English.
  const parts = header.split(',').map((p) => {
    const [tag, q] = p.trim().split(';q=');
    return { tag: tag.toLowerCase(), q: q ? Number(q) : 1 };
  }).sort((a, b) => b.q - a.q);

  for (const { tag } of parts) {
    if (tag.startsWith('he') || tag.startsWith('iw')) return 'he';
    if (tag.startsWith('en')) return 'en';
  }
  return DEFAULT_LOCALE;
}
