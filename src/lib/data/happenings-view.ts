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
  /** 0 = Sunday. A shiur can meet on several days. */
  weekdays: number[];
  weekOfMonth: number | null;
  onDate: string | null;
  startsAt: string | null;
  endsAt: string | null;
  anchor: string | null;
  anchorOffsetMin: number;
  imageUrl: string | null;
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
  } else if (h.cycle === 'weekly' && h.weekdays.length) {
    for (let i = 0; i < 8; i++) {
      const d = base.plus({ days: i });
      // Luxon: Monday=1 … Sunday=7. Our column is Sunday=0.
      if (h.weekdays.includes(d.weekday % 7)) candidateDays.push(d);
    }
  } else if (h.cycle === 'monthly' && h.weekdays.length && h.weekOfMonth !== null) {
    for (let m = 0; m < 3; m++) {
      const month = base.plus({ months: m }).startOf('month');
      // Count each weekday separately: "the second Tuesday and the second
      // Thursday" are two different dates, and one running counter would
      // conflate them.
      for (const wd of h.weekdays) {
        let seen = 0;
        for (let d = month; d.month === month.month; d = d.plus({ days: 1 })) {
          if (d.weekday % 7 === wd) {
            seen++;
            if (seen === h.weekOfMonth) { candidateDays.push(d); break; }
          }
        }
      }
    }
  }

  // Several weekdays produce dates out of order; the caller wants the next
  // one, so they have to be sorted before the first match is taken.
  candidateDays.sort((a, b) => a.toMillis() - b.toMillis());

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

  const days = h.weekdays.map((d) => WEEKDAYS[d]).filter(Boolean);
  // "ראשון, שלישי וחמישי" — the list reads as a sentence rather than as
  // data, which is what a noticeboard should sound like.
  const dayList =
    days.length <= 1 ? days[0] ?? ''
    : `${days.slice(0, -1).join(', ')} ו${days[days.length - 1]}`;

  if (h.cycle === 'weekly' && days.length) {
    return days.length === 1
      ? `כל יום ${dayList} · ${when}`
      : `ימי ${dayList} · ${when}`;
  }
  if (h.cycle === 'monthly' && days.length && h.weekOfMonth !== null) {
    return `יום ${dayList} ה-${h.weekOfMonth} בחודש · ${when}`;
  }
  if (h.cycle === 'once' && h.onDate) {
    return `${DateTime.fromISO(h.onDate).toFormat('dd/MM')} · ${when}`;
  }
  return when ?? '';
}
