import { DateTime } from 'luxon';
import { TENANT } from '@/lib/config';
import {
  buildDays, buildOccasions, closureWindows, nextOccasion,
  type CalendarDay, type Occasion,
} from '@/lib/calendar/occasions';

export interface StoreStatus {
  isOpen: boolean;
  /** Short line for the header pill. */
  label: string;
  /** Set when closed for shabbat / yom tov rather than ordinary hours. */
  occasion: string | null;
}

export interface HomeCalendar {
  today: CalendarDay;
  next: Occasion | null;
  status: StoreStatus;
  /** Serialisable closure windows, for the client to keep the pill live. */
  closures: { from: string; to: string; why: string }[];
}

const OPEN_MIN = 11 * 60;
const CLOSE_MIN = 21 * 60 + 30;
const REOPEN_BUFFER_MIN = 30;

function hhmm(d: DateTime) {
  return d.toFormat('HH:mm');
}

export function getHomeCalendar(now = DateTime.now().setZone(TENANT.point.timezone)): HomeCalendar {
  const from = now.minus({ days: 2 }).toISODate()!;
  const to = now.plus({ days: 45 }).toISODate()!;

  const days = buildDays(TENANT.point, TENANT.zmanim, from, to);
  const occasions = buildOccasions(days);
  const today = days.find((d) => d.date === now.toISODate()) ?? days[0];
  const next = nextOccasion(occasions, now);
  const windows = closureWindows(occasions, REOPEN_BUFFER_MIN);

  let status: StoreStatus;
  const inClosure = windows.find((w) => now >= w.from && now < w.to);

  if (inClosure) {
    status = {
      isOpen: false,
      label: `סגור · ${inClosure.why.he}`,
      occasion: inClosure.why.he,
    };
  } else {
    const upcoming = windows.find((w) => w.from > now);
    const minutes = now.hour * 60 + now.minute;
    if (minutes < OPEN_MIN) {
      status = { isOpen: false, label: 'נפתח ב-11:00', occasion: null };
    } else if (minutes >= CLOSE_MIN) {
      status = { isOpen: false, label: 'סגור · נפתח מחר ב-11:00', occasion: null };
    } else if (upcoming && upcoming.from.diff(now, 'hours').hours < 6) {
      status = { isOpen: true, label: `נסגר היום ב-${hhmm(upcoming.from)}`, occasion: null };
    } else {
      status = { isOpen: true, label: 'פתוח · הזמנות עד 21:30', occasion: null };
    }
  }

  return {
    today,
    next,
    status,
    closures: windows.map((w) => ({
      from: w.from.toISO()!,
      to: w.to.toISO()!,
      why: w.why.he,
    })),
  };
}

/**
 * Upcoming shabbat and yom tov blocks, for the listing page and (later) the
 * generator that keeps N registration forms open ahead of time.
 */
export function getUpcomingOccasions(count = 24, now = DateTime.now().setZone(TENANT.point.timezone)) {
  // A week per occasion plus slack for chag clusters, so we always have
  // enough candidates to return `count` of them.
  const to = now.plus({ weeks: count + 4 }).toISODate()!;
  const days = buildDays(TENANT.point, TENANT.zmanim, now.minus({ days: 2 }).toISODate()!, to);
  return buildOccasions(days)
    .filter((o) => o.havdalah > now)
    .slice(0, count);
}
