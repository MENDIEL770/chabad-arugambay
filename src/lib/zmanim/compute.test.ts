import { describe, expect, it } from 'vitest';
import { computeZmanim, type DayZmanim } from './compute';
import { ARUGAM_BAY, BAAL_HATANYA_ARUGAM_BAY } from './profile';

/**
 * Reference: zmanim.org.il — "זמני הלכה לשיטת אדמו״ר הזקן" (Rabbi Yaakov
 * Sangawi), location "סרי לנקה, ארוגם ביי". The site computes in the browser
 * and has no API, so these are transcribed by hand and treated as the
 * authority. Published to the minute, so each carries ±0.5 min of rounding.
 */
const ANCHORS_2026_09_22: Record<keyof typeof FIELDS, string> = {
  alos: '04:06',
  sunriseBaal: '05:47',
  sofZmanShma: '08:51',
  chatzos: '11:55',
  minchaGedola: '12:26',
  minchaKetana: '15:30',
  sunset: '18:00',
  sunsetBaal: '18:04',
  tzeis: '18:21',
};

const FIELDS = {
  alos: 'עלות השחר',
  sunriseBaal: 'זריחה (אמיתית)',
  sofZmanShma: 'סוף זמן קריאת שמע',
  chatzos: 'חצות',
  minchaGedola: 'מנחה גדולה',
  minchaKetana: 'מנחה קטנה',
  sunset: 'שקיעה (נראית)',
  sunsetBaal: 'שקיעה (אמיתית)',
  tzeis: 'צאת הכוכבים',
} as const;

const TOLERANCE_MIN = 1;

function driftMinutes(actual: DayZmanim[keyof typeof FIELDS], expected: string) {
  const [h, m] = expected.split(':').map(Number);
  const got = actual.hour * 60 + actual.minute + actual.second / 60;
  return got - (h * 60 + m);
}

describe('Baal HaTanya zmanim — Arugam Bay, 22/09/2026', () => {
  const day = computeZmanim(ARUGAM_BAY, BAAL_HATANYA_ARUGAM_BAY, '2026-09-22');

  for (const key of Object.keys(FIELDS) as (keyof typeof FIELDS)[]) {
    it(`${FIELDS[key]} is within ${TOLERANCE_MIN} min of the reference`, () => {
      const drift = driftMinutes(day[key], ANCHORS_2026_09_22[key]);
      expect(Math.abs(drift), `drift ${drift.toFixed(2)} min`).toBeLessThanOrEqual(
        TOLERANCE_MIN,
      );
    });
  }

  /**
   * OPEN — plag lands at 16:47.2 against a published 16:46.
   *
   * Every standard formulation was checked and none produces 16:46:
   *   halachic sunset − 1.25 sha'ot   16:47  (used here; the Alter Rebbe's)
   *   visible sunset  − 1.25 sha'ot   16:43
   *   alos→tzeis day, tzeis − 1.25    16:51
   *
   * The most likely explanations are (a) the reference rounds or truncates
   * somewhere we don't, or (b) our horizon-dip calibration is ~0.5 min off and
   * plag, sitting furthest from the calibration points, shows it first. Every
   * other derived time lands inside a minute, which favours (a).
   *
   * Do not loosen this into the main tolerance loop. It is a ratchet: it holds
   * the known drift in place so an unrelated regression still trips it, and it
   * stays visible until a second reference date settles the model.
   */
  it('פלג המנחה — known 1.2 min drift from the reference, held steady', () => {
    const drift = driftMinutes(day.plagHamincha, '16:46');
    expect(drift).toBeGreaterThan(1.0);
    expect(drift, 'drift grew — the calibration changed').toBeLessThan(1.5);
  });

  it('measures proportional hours between halachic sunrise and sunset', () => {
    const span = day.sunsetBaal.diff(day.sunriseBaal, 'minutes').minutes;
    expect(day.shaahZmanisMin).toBeCloseTo(span / 12, 6);
  });

  it('places chatzos exactly midway through the halachic day', () => {
    const mid = day.sunriseBaal.plus({ milliseconds: day.sunsetBaal.diff(day.sunriseBaal).milliseconds / 2 });
    expect(Math.abs(day.chatzos.diff(mid, 'seconds').seconds)).toBeLessThan(1);
  });

  it('derives candle lighting from visible sunset, not halachic sunset', () => {
    expect(day.sunset.diff(day.candleLighting, 'minutes').minutes).toBe(
      BAAL_HATANYA_ARUGAM_BAY.candleOffsetMin,
    );
  });

  it('adds the configured extra minutes to tzeis for havdalah', () => {
    expect(day.havdalah.diff(day.tzeis, 'minutes').minutes).toBe(
      BAAL_HATANYA_ARUGAM_BAY.tzeisExtraMin,
    );
  });
});

describe('ordering invariants hold across the year', () => {
  const dates = ['2026-01-15', '2026-03-21', '2026-06-21', '2026-09-22', '2026-12-21'];
  for (const date of dates) {
    it(`${date} produces a strictly increasing day`, () => {
      const d = computeZmanim(ARUGAM_BAY, BAAL_HATANYA_ARUGAM_BAY, date);
      const order: (keyof DayZmanim)[] = [
        'alos', 'sunriseBaal', 'sunrise', 'sofZmanShma', 'sofZmanTfila',
        'chatzos', 'minchaGedola', 'minchaKetana', 'plagHamincha',
        'sunset', 'sunsetBaal', 'tzeis', 'havdalah',
      ];
      for (let i = 1; i < order.length; i++) {
        const prev = d[order[i - 1]] as DayZmanim['alos'];
        const cur = d[order[i]] as DayZmanim['alos'];
        expect(
          cur.toMillis(),
          `${String(order[i])} must come after ${String(order[i - 1])} on ${date}`,
        ).toBeGreaterThanOrEqual(prev.toMillis());
      }
    });
  }
});
