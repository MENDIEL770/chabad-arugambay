import { describe, expect, it } from 'vitest';
import { toE164, fromE164, formatE164, COUNTRIES } from './phone';

describe('local digits to E.164', () => {
  it('drops the trunk zero', () => {
    // +9720501234567 is not dialable, and typing the 0 after picking a
    // country is the most common mistake there is.
    expect(toE164('972', '0501234567').e164).toBe('+972501234567');
  });

  it('accepts the number without a leading zero too', () => {
    expect(toE164('972', '501234567').e164).toBe('+972501234567');
  });

  it('separates two 10-digit numbers that look identical', () => {
    // Israeli 05x and Sri Lankan 07x are both ten digits from zero; only
    // the chosen country tells them apart.
    expect(toE164('972', '0521234567').e164).toBe('+972521234567');
    expect(toE164('94', '0771234567').e164).toBe('+94771234567');
  });

  it('strips formatting people actually type', () => {
    expect(toE164('972', '050-123-4567').e164).toBe('+972501234567');
    expect(toE164('94', '(077) 123 4567').e164).toBe('+94771234567');
  });

  it('recovers when the full international number is pasted in', () => {
    expect(toE164('94', '+94771234567').e164).toBe('+94771234567');
    expect(toE164('972', '972501234567').e164).toBe('+972501234567');
  });

  it('rejects what cannot be dialled', () => {
    expect(toE164('972', '').ok).toBe(false);
    expect(toE164('972', '12345').ok).toBe(false);
    expect(toE164('', '0501234567').ok).toBe(false);
  });
});

describe('E.164 back to a form', () => {
  it('prefers the longest matching dial code', () => {
    // +972 must not be read as +97 or +9.
    expect(fromE164('+972501234567').country.iso).toBe('IL');
    expect(fromE164('+972501234567').local).toBe('501234567');
  });

  it('round-trips every country in the list', () => {
    for (const c of COUNTRIES) {
      const e164 = toE164(c.code, c.example).e164!;
      expect(fromE164(e164).country.code, `${c.iso} round trip`).toBe(c.code);
    }
  });

  it('formats for display', () => {
    expect(formatE164('+94771234567')).toBe('+94 771234567');
  });
});
