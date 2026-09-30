/**
 * Phone entry for a house whose guests are mostly Israeli and whose drivers
 * are all Sri Lankan.
 *
 * Both countries use 10-digit mobile numbers beginning with 0 — 05x in
 * Israel, 07x in Sri Lanka — so a bare 10 digits is genuinely ambiguous.
 * The form therefore asks for a country and exactly 10 local digits, and
 * this module turns the pair into the E.164 string WhatsApp needs.
 */

export interface Country {
  code: string;      // dial code, no plus
  iso: string;
  label: string;
  /** Local digits expected, including the leading trunk 0. */
  localDigits: number;
  example: string;
}

export const COUNTRIES: Country[] = [
  { code: '972', iso: 'IL', label: 'ישראל +972',    localDigits: 10, example: '0501234567' },
  { code: '94',  iso: 'LK', label: 'סרי לנקה +94',  localDigits: 10, example: '0771234567' },
  { code: '1',   iso: 'US', label: 'ארה״ב +1',      localDigits: 10, example: '2125550123' },
  { code: '44',  iso: 'GB', label: 'בריטניה +44',   localDigits: 10, example: '7700900123' },
  { code: '33',  iso: 'FR', label: 'צרפת +33',      localDigits: 10, example: '0612345678' },
  { code: '7',   iso: 'RU', label: 'רוסיה +7',      localDigits: 10, example: '9123456789' },
];

export const DEFAULT_COUNTRY = COUNTRIES[0];

export function digitsOnly(input: string): string {
  return input.replace(/\D/g, '');
}

export interface PhoneResult {
  ok: boolean;
  /** E.164, e.g. +972501234567 */
  e164?: string;
  error?: string;
}

/**
 * Combine a dial code with locally-typed digits.
 *
 * The trunk 0 is dropped: +9720501234567 is not a number anyone can call,
 * and it is the single most common mistake when people type their own
 * number after choosing a country.
 */
export function toE164(dialCode: string, local: string): PhoneResult {
  const cc = digitsOnly(dialCode);
  let d = digitsOnly(local);

  if (!cc) return { ok: false, error: 'צריך לבחור מדינה' };
  if (!d) return { ok: false, error: 'צריך מספר טלפון' };

  // Someone pasted the full international form into the local field.
  if (d.startsWith(cc) && d.length > 10) d = d.slice(cc.length);
  if (d.startsWith('0')) d = d.slice(1);

  if (d.length < 6) return { ok: false, error: 'המספר קצר מדי' };
  if (d.length > 12) return { ok: false, error: 'המספר ארוך מדי' };

  return { ok: true, e164: `+${cc}${d}` };
}

/** Split an E.164 string back for display in the form. */
export function fromE164(e164: string): { country: Country; local: string } {
  const d = digitsOnly(e164);
  // Longest dial code first, so +972 is not read as +97.
  const country =
    [...COUNTRIES].sort((a, b) => b.code.length - a.code.length).find((c) => d.startsWith(c.code)) ??
    DEFAULT_COUNTRY;
  return { country, local: d.slice(country.code.length) };
}

/** For display next to an order or registration. */
export function formatE164(e164: string): string {
  const { country, local } = fromE164(e164);
  return `+${country.code} ${local}`;
}
