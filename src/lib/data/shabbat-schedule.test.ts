import { describe, expect, it } from 'vitest';
import { buildSchedule, headlineTimes } from './shabbat-schedule';
import { buildDays, buildOccasions } from '@/lib/calendar/occasions';
import { ARUGAM_BAY, BAAL_HATANYA_ARUGAM_BAY as P } from '@/lib/zmanim/profile';

const days = buildDays(ARUGAM_BAY, P, '2026-10-07', '2026-10-13');
const shabbat = buildOccasions(days).find((o) => o.startDate === '2026-10-10')!;

describe('shabbat schedule', () => {
  it('headlines exactly the four a guest plans around', () => {
    const h = headlineTimes(buildSchedule(shabbat)).map((r) => r.label);
    expect(h).toEqual(['כניסת שבת', 'ארוחת שישי', 'ארוחת שבת', 'יציאת שבת']);
  });

  it('runs in chronological order', () => {
    const rows = buildSchedule(shabbat);
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i].time.toMillis()).toBeGreaterThanOrEqual(rows[i - 1].time.toMillis());
    }
  });

  it('opens at candle lighting and closes at havdalah', () => {
    const rows = buildSchedule(shabbat);
    // Candles are lit first, then mincha — the order it actually happens in.
    expect(rows[0].label).toBe('כניסת שבת');
    expect(rows[0].time.toMillis()).toBe(shabbat.candleLighting.toMillis());
    expect(rows[rows.length - 1].time.toMillis()).toBe(shabbat.havdalah.toMillis());
  });

  it('puts Friday dinner on the erev, not a day late', () => {
    // days[0] of a shabbat block is Saturday. Deriving dinner from its
    // sunset silently moved it to Saturday night.
    const rows = buildSchedule(shabbat);
    const dinner = rows.find((r) => r.label === 'ארוחת שישי')!;
    expect(dinner.time.toISODate()).toBe(shabbat.erevDate);
  });

  it('puts dinner after sunset, not before', () => {
    const rows = buildSchedule(shabbat);
    const sunset = rows.find((r) => r.label === 'שקיעה')!;
    const dinner = rows.find((r) => r.label === 'ארוחת שישי')!;
    expect(dinner.time.toMillis()).toBeGreaterThan(sunset.time.toMillis());
  });

  it('rounds announced times to five minutes', () => {
    for (const r of buildSchedule(shabbat)) {
      if (r.kind === 'halachic') continue; // computed, kept exact
      expect(r.time.minute % 5).toBe(0);
    }
  });

  it('uses the house meal times when the event sets them', () => {
    const custom = shabbat.candleLighting.set({ hour: 20, minute: 0 });
    const rows = buildSchedule(shabbat, { fridayDinnerAt: custom });
    expect(rows.find((r) => r.label === 'ארוחת שישי')!.time.hour).toBe(20);
  });

  it('names a chag differently from a shabbat', () => {
    const chag = buildOccasions(
      buildDays(ARUGAM_BAY, P, '2026-10-01', '2026-10-06'),
    ).find((o) => o.kind !== 'shabbat')!;
    const labels = headlineTimes(buildSchedule(chag)).map((r) => r.label);
    expect(labels[0]).toBe('כניסת החג');
    expect(labels[labels.length - 1]).toBe('צאת החג');
  });
});
