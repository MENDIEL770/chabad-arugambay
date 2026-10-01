import { DateTime } from 'luxon';
import { TENANT } from '@/lib/config';
import { getOpeningHours } from './hours';
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

export interface DayWindow {
  weekday: number;
  opens: string;
  closes: string;
  isClosed: boolean;
}

export interface HomeCalendar {
  today: CalendarDay;
  next: Occasion | null;
  status: StoreStatus;
  /** Serialisable closure windows, for the client to keep the pill live. */
  closures: { from: string; to: string; why: string }[];
  /** The weekly hours, so the client pill agrees with the server. */
  week: DayWindow[];
}

const REOPEN_BUFFER_MIN = 30;

/** Used when no row exists for a day — the same hours the code assumed
 *  before opening hours were configurable. */
const FALLBACK_DAY = { opens: '11:00', closes: '21:30', isClosed: false };

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function hhmm(d: DateTime) {
  return d.toFormat('HH:mm');
}

export async function getHomeCalendar(
  now = DateTime.now().setZone(TENANT.point.timezone),
): Promise<HomeCalendar> {
  // Loaded here rather than passed in, so every page gets the configured
  // hours without having to know they are configurable.
  const week: DayWindow[] = (await getOpeningHours()).map((d) => ({
    weekday: d.weekday,
    opens: d.opens,
    closes: d.closes,
    isClosed: d.isClosed,
  }));
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
    // Luxon counts Monday as 1 and Sunday as 7; the table uses 0 for Sunday.
    const today = week.find((d) => d.weekday === now.weekday % 7) ?? {
      weekday: now.weekday % 7,
      ...FALLBACK_DAY,
    };
    const openMin = toMinutes(today.opens);
    const closeMin = toMinutes(today.closes);

    if (today.isClosed) {
      status = { isOpen: false, label: 'סגור היום', occasion: null };
    } else if (minutes < openMin) {
      status = { isOpen: false, label: `נפתח ב-${today.opens}`, occasion: null };
    } else if (minutes >= closeMin) {
      status = { isOpen: false, label: 'סגור · נפתח מחר', occasion: null };
    } else if (upcoming && upcoming.from.diff(now, 'hours').hours < 6) {
      status = { isOpen: true, label: `נסגר היום ב-${hhmm(upcoming.from)}`, occasion: null };
    } else {
      status = { isOpen: true, label: `פתוח · הזמנות עד ${today.closes}`, occasion: null };
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
    week: week.length === 7
      ? week
      : Array.from({ length: 7 }, (_, weekday) => ({ weekday, ...FALLBACK_DAY })),
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
