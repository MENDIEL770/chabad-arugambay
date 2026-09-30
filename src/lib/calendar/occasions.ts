import { HebrewCalendar, HDate, Location, flags as F } from '@hebcal/core';
import { DateTime } from 'luxon';
import { computeZmanim, type DayZmanim } from '@/lib/zmanim/compute';
import { type GeoPoint, type ZmanimProfile } from '@/lib/zmanim/profile';

export interface I18nText {
  he: string;
  en: string;
}

export interface CalendarDay {
  /** Civil date, yyyy-mm-dd, in the tenant's timezone. */
  date: string;
  hebrewDate: I18nText;
  parsha: I18nText | null;
  holiday: I18nText | null;

  isShabbat: boolean;
  isYomTov: boolean;
  isCholHamoed: boolean;
  isRoshChodesh: boolean;
  isFast: boolean;

  /** Candles are lit before sunset on this day (erev shabbat / erev yom tov). */
  lightsCandles: boolean;
  /**
   * Candles are lit after nightfall, from a flame kindled before the chag —
   * the second night of yom tov, or a yom tov that begins on motzaei shabbat.
   * The public site must say so, and must not print a "candle lighting" time
   * that would have people light at sunset.
   */
  fromExistingFlame: boolean;

  /** Yom tov or shabbat ends this evening. */
  restEnds: boolean;

  zmanim: DayZmanim;
}

/**
 * A contiguous block of rest days treated as one event for registration.
 *
 * This is the unit the public site, the shabbat generator and the restaurant's
 * automatic closing all reason about — not the individual day. It matters
 * because blocks join: Shmini Atzeret on a Friday runs straight into Simchat
 * Torah on Shabbat, and there is one candle lighting at the start, one
 * havdalah at the end, and no break in between.
 */
export interface Occasion {
  /** Stable slug, from the first day. */
  key: string;
  title: I18nText;
  days: CalendarDay[];
  /** First day of the block. */
  startDate: string;
  /** Last day of the block. */
  endDate: string;
  /** Candle lighting that opens the block (on the erev, before startDate). */
  candleLighting: DateTime;
  erevDate: string;
  /** Havdalah / end of the final day. */
  havdalah: DateTime;
  /** True when any night inside the block is lit from an existing flame. */
  hasExistingFlameNight: boolean;
  kind: 'shabbat' | 'yomtov' | 'combined';
}

function isoDate(d: Date, zone: string): string {
  return DateTime.fromJSDate(d).setZone(zone, { keepLocalTime: true }).toISODate()!;
}

function has(f: number, bit: number): boolean {
  return (f & bit) !== 0;
}

/**
 * Hebcal renders Hebrew vocalized. Nikud is correct but reads heavy at
 * display sizes, so the UI uses the unpointed forms. Events support the
 * `he-x-NoNikud` locale directly; renderGematriya does not, hence the strip.
 * Cantillation and points only — geresh (U+05F3) and gershayim (U+05F4) are
 * outside this range and must survive, they are what make ״תשפ״ז״ readable.
 */
const NIKUD = /[\u0591-\u05BD\u05BF\u05C1\u05C2\u05C4-\u05C7]/g;

function stripNikud(s: string): string {
  return s.replace(NIKUD, '');
}

const HE = 'he-x-NoNikud';

/**
 * Classify a range of civil dates using Hebcal, then attach computed zmanim.
 *
 * `il` is false for Sri Lanka: second day of yom tov, and the diaspora parsha
 * schedule (which diverges from Israel's for months after a yom tov that falls
 * on shabbat).
 */
export function buildDays(
  point: GeoPoint,
  profile: ZmanimProfile,
  fromISO: string,
  toISO: string,
): CalendarDay[] {
  const zone = point.timezone;
  const start = DateTime.fromISO(fromISO, { zone });
  const end = DateTime.fromISO(toISO, { zone });

  const location = new Location(
    point.latitude,
    point.longitude,
    false,
    zone,
    point.name,
    'LK',
  );

  const events = HebrewCalendar.calendar({
    start: start.toJSDate(),
    end: end.toJSDate(),
    location,
    il: false,
    sedrot: true,
    candlelighting: false,
    noMinorFast: false,
  });

  // Bucket events by civil date so each day sees everything that applies to it.
  const byDate = new Map<string, typeof events>();
  for (const ev of events) {
    const key = isoDate(ev.getDate().greg(), zone);
    const list = byDate.get(key);
    if (list) list.push(ev);
    else byDate.set(key, [ev]);
  }

  const days: CalendarDay[] = [];
  for (let d = start; d <= end; d = d.plus({ days: 1 })) {
    const date = d.toISODate()!;
    const evs = byDate.get(date) ?? [];
    const hd = new HDate(d.toJSDate());

    let parsha: I18nText | null = null;
    let holiday: I18nText | null = null;
    let isYomTov = false;
    let isCholHamoed = false;
    let isRoshChodesh = false;
    let isFast = false;
    let lightsCandles = false;
    let fromExistingFlame = false;
    let restEnds = false;

    for (const ev of evs) {
      const f = ev.getFlags();
      if (has(f, F.PARSHA_HASHAVUA)) {
        parsha = { he: ev.render(HE), en: ev.render('en') };
        continue;
      }
      if (has(f, F.ROSH_CHODESH)) {
        isRoshChodesh = true;
        if (!holiday) holiday = { he: ev.render(HE), en: ev.render('en') };
        continue;
      }
      if (has(f, F.MINOR_FAST) || has(f, F.MAJOR_FAST)) isFast = true;
      if (has(f, F.CHAG)) isYomTov = true;
      if (has(f, F.CHOL_HAMOED)) isCholHamoed = true;
      if (has(f, F.LIGHT_CANDLES)) lightsCandles = true;
      if (has(f, F.LIGHT_CANDLES_TZEIS)) {
        lightsCandles = true;
        fromExistingFlame = true;
      }
      if (has(f, F.YOM_TOV_ENDS)) restEnds = true;
      if (!holiday && !has(f, F.PARSHA_HASHAVUA)) {
        holiday = { he: ev.render(HE), en: ev.render('en') };
      }
    }

    const isShabbat = d.weekday === 6; // luxon: Saturday
    // Friday always lights, and shabbat always ends at havdalah, even when
    // Hebcal emits no event for an ordinary week.
    if (d.weekday === 5) lightsCandles = true;
    if (isShabbat) restEnds = true;

    days.push({
      date,
      hebrewDate: { he: stripNikud(hd.renderGematriya()), en: hd.render('en') },
      parsha,
      holiday,
      isShabbat,
      isYomTov,
      isCholHamoed,
      isRoshChodesh,
      isFast,
      lightsCandles,
      fromExistingFlame,
      restEnds,
      zmanim: computeZmanim(point, profile, date),
    });
  }

  return days;
}

/** Group contiguous rest days (shabbat / yom tov) into registration blocks. */
export function buildOccasions(days: CalendarDay[]): Occasion[] {
  const isRest = (d: CalendarDay) => d.isShabbat || d.isYomTov;
  const out: Occasion[] = [];

  let i = 0;
  while (i < days.length) {
    if (!isRest(days[i])) {
      i++;
      continue;
    }
    let j = i;
    while (j + 1 < days.length && isRest(days[j + 1])) j++;
    const block = days.slice(i, j + 1);

    // The erev sits one day before the block and carries its candle lighting.
    const erevIndex = i - 1;
    const erev = erevIndex >= 0 ? days[erevIndex] : null;
    if (!erev) {
      // Block opens before our window — we cannot state its candle time.
      i = j + 1;
      continue;
    }

    const last = block[block.length - 1];
    const anyYomTov = block.some((d) => d.isYomTov);
    const anyShabbat = block.some((d) => d.isShabbat);

    const titleParts = block
      .map((d) => d.holiday ?? d.parsha)
      .filter((t): t is I18nText => Boolean(t));
    const uniqueHe = [...new Set(titleParts.map((t) => t.he))];
    const uniqueEn = [...new Set(titleParts.map((t) => t.en))];

    out.push({
      key: block[0].date,
      title: {
        he: uniqueHe.join(' · ') || 'שבת',
        en: uniqueEn.join(' · ') || 'Shabbat',
      },
      days: block,
      startDate: block[0].date,
      endDate: last.date,
      erevDate: erev.date,
      candleLighting: erev.zmanim.candleLighting,
      havdalah: last.zmanim.havdalah,
      hasExistingFlameNight: block.some((d) => d.fromExistingFlame),
      kind: anyYomTov && anyShabbat ? 'combined' : anyYomTov ? 'yomtov' : 'shabbat',
    });

    i = j + 1;
  }

  return out;
}

/** The next occasion that has not yet ended, relative to `now`. */
export function nextOccasion(occasions: Occasion[], now: DateTime): Occasion | null {
  return occasions.find((o) => o.havdalah > now) ?? null;
}

/**
 * Windows during which the restaurant must be closed: from candle lighting
 * until havdalah plus a buffer for reopening. Feeds both the public status
 * indicator and the cron that closes the store.
 */
export function closureWindows(
  occasions: Occasion[],
  reopenBufferMin: number,
): { from: DateTime; to: DateTime; why: I18nText }[] {
  return occasions.map((o) => ({
    from: o.candleLighting,
    to: o.havdalah.plus({ minutes: reopenBufferMin }),
    why: o.title,
  }));
}
