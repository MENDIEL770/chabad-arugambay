/**
 * The parts of the noticeboard a browser may hold.
 *
 * Split from the loader because the admin screen is a client component
 * and needs describeWhen. Importing it from the module that also calls
 * createServiceClient drags next/headers into the client bundle, which
 * fails the build with an error that names neither file.
 */
import { DateTime } from 'luxon';
import { TENANT } from '@/lib/config';
import { buildDays } from '@/lib/calendar/occasions';
import type { I18n } from './types';

export type HappeningKind = 'class' | 'farbrengen' | 'notice' | 'event';
export type HappeningCycle = 'once' | 'weekly' | 'monthly';

export interface Happening {
  id: string;
  kind: HappeningKind;
  cycle: HappeningCycle;
  title: I18n;
  details: I18n;
  audience: I18n;
  location: I18n;
  weekday: number | null;
  weekOfMonth: number | null;
  onDate: string | null;
  startsAt: string | null;
  endsAt: string | null;
  anchor: string | null;
  anchorOffsetMin: number;
  pausedNote: I18n;
  sort: number;
  isActive: boolean;
}

export const KIND_LABEL: Record<HappeningKind, string> = {
  class: 'שיעור',
  farbrengen: 'התוועדות',
  notice: 'הודעה',
  event: 'אירוע',
};

export const WEEKDAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

/**
 * When the next occurrence actually is.
 *
 * A class anchored to a zman — "twenty minutes after mincha" — moves every
 * week, and in Sri Lanka sunset shifts by about half an hour across the
 * year. Resolving it against the calendar means the board stays right
 * without anyone remembering to edit it each season.
 */
export function nextOccurrence(h: Happening, from: DateTime): DateTime | null {
  const zone = TENANT.point.timezone;
  const base = from.setZone(zone).startOf('day');

  const candidateDays: DateTime[] = [];
  if (h.cycle === 'once' && h.onDate) {
    candidateDays.push(DateTime.fromISO(h.onDate, { zone }));
  } else if (h.cycle === 'weekly' && h.weekday !== null) {
    for (let i = 0; i < 8; i++) {
      const d = base.plus({ days: i });
      // Luxon: Monday=1 … Sunday=7. Our column is Sunday=0.
      if (d.weekday % 7 === h.weekday) candidateDays.push(d);
    }
  } else if (h.cycle === 'monthly' && h.weekday !== null && h.weekOfMonth !== null) {
    for (let m = 0; m < 3; m++) {
      const month = base.plus({ months: m }).startOf('month');
      let seen = 0;
      for (let d = month; d.month === month.month; d = d.plus({ days: 1 })) {
        if (d.weekday % 7 === h.weekday) {
          seen++;
          if (seen === h.weekOfMonth) { candidateDays.push(d); break; }
        }
      }
    }
  }

  for (const day of candidateDays) {
    let when: DateTime | null = null;

    if (h.anchor) {
      const [computed] = buildDays(TENANT.point, TENANT.zmanim, day.toISODate()!, day.toISODate()!);
      const z = computed?.zmanim;
      const anchorTime =
        h.anchor === 'candle_lighting' ? z?.candleLighting
        : h.anchor === 'sunset'        ? z?.sunset
        : h.anchor === 'tzeis'         ? z?.tzeis
        : null;
      if (anchorTime) when = anchorTime.plus({ minutes: h.anchorOffsetMin });
    } else if (h.startsAt) {
      const [hh, mm] = h.startsAt.split(':').map(Number);
      when = day.set({ hour: hh, minute: mm, second: 0, millisecond: 0 });
    }

    if (when && when > from) return when;
  }
  return null;
}

/** Human description of when it happens, for the card. */
export function describeWhen(h: Happening): string {
  const time = h.startsAt ? h.startsAt.slice(0, 5) : null;
  const anchorLabel =
    h.anchor === 'candle_lighting' ? 'הדלקת נרות'
    : h.anchor === 'sunset'        ? 'השקיעה'
    : h.anchor === 'tzeis'         ? 'צאת הכוכבים'
    : null;

  const when = anchorLabel
    ? h.anchorOffsetMin === 0
      ? `ב${anchorLabel}`
      : h.anchorOffsetMin > 0
        ? `${h.anchorOffsetMin} דק׳ אחרי ${anchorLabel}`
        : `${Math.abs(h.anchorOffsetMin)} דק׳ לפני ${anchorLabel}`
    : time;

  if (h.cycle === 'weekly' && h.weekday !== null) {
    return `כל יום ${WEEKDAYS[h.weekday]} · ${when}`;
  }
  if (h.cycle === 'monthly' && h.weekday !== null && h.weekOfMonth !== null) {
    return `יום ${WEEKDAYS[h.weekday]} ה-${h.weekOfMonth} בחודש · ${when}`;
  }
  if (h.cycle === 'once' && h.onDate) {
    return `${DateTime.fromISO(h.onDate).toFormat('dd/MM')} · ${when}`;
  }
  return when ?? '';
}
