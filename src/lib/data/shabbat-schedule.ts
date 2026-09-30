import { DateTime } from 'luxon';
import type { Occasion } from '@/lib/calendar/occasions';

/**
 * The full schedule for one shabbat or chag.
 *
 * Halachic times are computed; meal and prayer times are house decisions
 * with sensible defaults derived from the zmanim, so a new shabbat always
 * has a complete schedule even before anyone edits it. Once an event exists
 * its own meal times win.
 */

export interface ScheduleRow {
  label: string;
  time: DateTime;
  /** The four a guest actually plans around. */
  headline?: boolean;
  note?: string;
  kind: 'halachic' | 'meal' | 'prayer';
}

/** Round to the nearest five minutes — nobody announces mincha at 17:23. */
function round5(d: DateTime): DateTime {
  const m = Math.round(d.minute / 5) * 5;
  return d.set({ minute: m % 60, second: 0, millisecond: 0 }).plus({ hours: m >= 60 ? 1 : 0 });
}

export interface ScheduleOptions {
  /** From event_meals once the event exists. */
  fridayDinnerAt?: DateTime | null;
  shabbatLunchAt?: DateTime | null;
}

export function buildSchedule(o: Occasion, opts: ScheduleOptions = {}): ScheduleRow[] {
  const first = o.days[0];
  const last = o.days[o.days.length - 1];
  const isChag = o.kind !== 'shabbat';

  /**
   * Everything on the erev is derived from candle lighting, NOT from
   * days[0]. For a shabbat block days[0] is Saturday, so using its sunset
   * put Friday's dinner on Saturday evening — the schedule looked fine and
   * was a day out.
   *
   * Sunset is exact rather than approximate: candle lighting is defined as
   * sunset minus the tenant's offset, so adding it back recovers it.
   */
  const erevSunset = o.candleLighting.plus({ minutes: 18 });
  // Candles first, then mincha and kabbalat shabbat — the order it happens in.
  const minchaErev = round5(o.candleLighting.plus({ minutes: 10 }));
  const dinner =
    opts.fridayDinnerAt ?? round5(erevSunset.plus({ hours: 1, minutes: 15 }));

  const shacharit = first.zmanim.sunrise.set({ hour: 9, minute: 0, second: 0, millisecond: 0 });
  const lunch = opts.shabbatLunchAt ?? shacharit.set({ hour: 12, minute: 30 });

  const minchaDay = round5(last.zmanim.minchaKetana.plus({ minutes: 30 }));

  const rows: ScheduleRow[] = [
    {
      label: isChag ? 'כניסת החג' : 'כניסת שבת',
      time: o.candleLighting,
      headline: true,
      note: 'הדלקת נרות',
      kind: 'halachic',
    },
    { label: 'מנחה וקבלת שבת', time: minchaErev, kind: 'prayer' },
    { label: 'שקיעה', time: erevSunset, kind: 'halachic' },
    {
      label: isChag ? 'סעודת ליל החג' : 'ארוחת שישי',
      time: dinner,
      headline: true,
      kind: 'meal',
    },
    { label: 'שחרית', time: shacharit, kind: 'prayer' },
    {
      label: isChag ? 'סעודת יום החג' : 'ארוחת שבת',
      time: lunch,
      headline: true,
      kind: 'meal',
    },
    { label: 'מנחה', time: minchaDay, kind: 'prayer' },
    {
      label: isChag ? 'צאת החג' : 'יציאת שבת',
      time: o.havdalah,
      headline: true,
      note: 'הבדלה',
      kind: 'halachic',
    },
  ];

  // A second night lit from an existing flame is the one thing people get
  // wrong, so it goes in the schedule rather than a footnote.
  for (const day of o.days) {
    if (day.fromExistingFlame) {
      rows.splice(rows.length - 1, 0, {
        label: 'הדלקת נרות ליום השני',
        time: day.zmanim.tzeis,
        note: 'מאש קיימת בלבד',
        kind: 'halachic',
      });
    }
  }

  return rows.sort((a, b) => a.time.toMillis() - b.time.toMillis());
}

export function headlineTimes(rows: ScheduleRow[]): ScheduleRow[] {
  return rows.filter((r) => r.headline);
}
