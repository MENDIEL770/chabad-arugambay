import { describe, expect, it } from 'vitest';
import { buildDays, buildOccasions, nextOccasion, closureWindows } from './occasions';
import { ARUGAM_BAY, BAAL_HATANYA_ARUGAM_BAY as P } from '@/lib/zmanim/profile';
import { DateTime } from 'luxon';

const days = buildDays(ARUGAM_BAY, P, '2026-09-28', '2026-10-25');
const occasions = buildOccasions(days);
const fmt = (d: DateTime) => d.toFormat('yyyy-MM-dd HH:mm');

describe('Hebrew is rendered unpointed for display', () => {
  it('strips nikud from holiday names and the hebrew date', () => {
    const day = days.find((d) => d.date === '2026-10-03')!;
    expect(day.holiday!.he).toBe('שמיני עצרת');
    // ...but keeps the gershayim that make the year readable.
    expect(day.hebrewDate.he).toContain('״');
    expect(day.hebrewDate.he).not.toMatch(/[\u0591-\u05BD]/);
  });
});

describe('dates are bucketed in the tenant timezone, not UTC', () => {
  /**
   * Regression guard. Hebcal hands back a JS Date at local midnight; reading
   * it with toISOString() reports the previous calendar day anywhere east of
   * Greenwich. At Asia/Colombo (+05:30) that shifted every chag back by one,
   * which is invisible in code review and catastrophic in a candle-lighting
   * time. 22 Tishrei 5787 is Saturday 3 October 2026.
   */
  it('places Shmini Atzeret on 3/10, not 2/10', () => {
    expect(days.find((d) => d.date === '2026-10-03')?.isYomTov).toBe(true);
    expect(days.find((d) => d.date === '2026-10-02')?.isYomTov).toBe(false);
  });

  it('keeps the second day of yom tov', () => {
    // Shmini Atzeret and Simchat Torah are separate days outside Israel.
    const shmini = days.find((d) => d.date === '2026-10-03');
    const simchat = days.find((d) => d.date === '2026-10-04');
    expect(shmini?.isYomTov).toBe(true);
    expect(simchat?.isYomTov).toBe(true);
    expect(shmini?.holiday?.en).toMatch(/Shmini Atzeret/i);
    expect(simchat?.holiday?.en).toMatch(/Simchat Torah/i);
  });
});

describe('occasions join contiguous rest days', () => {
  const combined = occasions.find((o) => o.startDate === '2026-10-03');

  it('treats Shabbat/Shmini Atzeret + Simchat Torah as ONE block', () => {
    expect(combined).toBeDefined();
    expect(combined!.endDate).toBe('2026-10-04');
    expect(combined!.days).toHaveLength(2);
    expect(combined!.kind).toBe('combined');
  });

  it('opens with a single candle lighting on the erev, not one per day', () => {
    expect(combined!.erevDate).toBe('2026-10-02');
    expect(fmt(combined!.candleLighting)).toBe('2026-10-02 17:36');
  });

  it('closes with a single havdalah at the end of the last day', () => {
    expect(fmt(combined!.havdalah)).toBe('2026-10-04 18:18');
  });

  it('flags the second night as lit from an existing flame', () => {
    // Simchat Torah night follows a yom tov day: candles are lit after
    // nightfall from a flame kindled before the chag, never struck fresh.
    expect(combined!.hasExistingFlameNight).toBe(true);
    expect(days.find((d) => d.date === '2026-10-03')?.fromExistingFlame).toBe(true);
    // ...and the final day has no further lighting.
    expect(days.find((d) => d.date === '2026-10-04')?.fromExistingFlame).toBe(false);
    expect(days.find((d) => d.date === '2026-10-04')?.restEnds).toBe(true);
  });
});

describe('ordinary shabbatot', () => {
  it('produces a one-day block with its parsha', () => {
    const bereshit = occasions.find((o) => o.startDate === '2026-10-10');
    expect(bereshit).toBeDefined();
    expect(bereshit!.days).toHaveLength(1);
    expect(bereshit!.kind).toBe('shabbat');
    expect(bereshit!.title.he).toContain('בראשית');
    expect(bereshit!.erevDate).toBe('2026-10-09');
  });

  it('never emits a block whose erev falls outside the window', () => {
    for (const o of occasions) {
      expect(o.erevDate < o.startDate).toBe(true);
      expect(o.candleLighting < o.havdalah).toBe(true);
    }
  });
});

describe('derived outputs', () => {
  it('picks the next occasion that has not yet ended', () => {
    const now = DateTime.fromISO('2026-09-30T12:00', { zone: 'Asia/Colombo' });
    expect(nextOccasion(occasions, now)?.startDate).toBe('2026-10-03');
  });

  it('still returns the current block mid-chag, not the following one', () => {
    const during = DateTime.fromISO('2026-10-04T10:00', { zone: 'Asia/Colombo' });
    expect(nextOccasion(occasions, during)?.startDate).toBe('2026-10-03');
  });

  it('builds closure windows that span the whole block plus a buffer', () => {
    const w = closureWindows(occasions, 30).find((c) => fmt(c.from).startsWith('2026-10-02'));
    expect(fmt(w!.from)).toBe('2026-10-02 17:36');
    expect(fmt(w!.to)).toBe('2026-10-04 18:48');
  });
});
