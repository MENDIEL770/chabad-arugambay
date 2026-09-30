import { ComplexZmanimCalendar, GeoLocation } from 'kosher-zmanim';
import { DateTime } from 'luxon';
import {
  type GeoPoint,
  type SunAnchor,
  type ZmanimProfile,
} from './profile';

export interface DayZmanim {
  /** Civil date in the location's timezone, ISO yyyy-mm-dd. */
  date: string;
  alos: DateTime;
  sunrise: DateTime;        // visible
  sunriseBaal: DateTime;    // halachic / "true"
  sofZmanShma: DateTime;
  sofZmanTfila: DateTime;
  chatzos: DateTime;
  minchaGedola: DateTime;
  minchaKetana: DateTime;
  plagHamincha: DateTime;
  sunset: DateTime;         // visible
  sunsetBaal: DateTime;     // halachic / "true"
  tzeis: DateTime;
  /** Visible sunset minus candleOffsetMin. Meaningful on erev shabbat/yom tov. */
  candleLighting: DateTime;
  /** tzeis + tzeisExtraMin. Meaningful at the end of shabbat/yom tov. */
  havdalah: DateTime;
  /** Length of one proportional hour, in minutes. */
  shaahZmanisMin: number;
}

function calendarFor(point: GeoPoint, profile: ZmanimProfile, date: string) {
  const location = new GeoLocation(
    point.name,
    point.latitude,
    point.longitude,
    profile.horizonDipMeters,
    point.timezone,
  );
  const cal = new ComplexZmanimCalendar(location);
  cal.setDate(DateTime.fromISO(date, { zone: point.timezone }));
  return cal;
}

/** Resolve a dawn/nightfall anchor, which may be an angle or a fixed offset. */
function resolveAnchor(
  anchor: SunAnchor,
  cal: ComplexZmanimCalendar,
  side: 'morning' | 'evening',
  visible: DateTime,
): DateTime {
  if (anchor.kind === 'fixedMinutes') {
    return side === 'morning'
      ? visible.minus({ minutes: anchor.value })
      : visible.plus({ minutes: anchor.value });
  }
  const zenith = 90 + anchor.value;
  const raw =
    side === 'morning'
      ? cal.getSunriseOffsetByDegrees(zenith)
      : cal.getSunsetOffsetByDegrees(zenith);
  if (!raw) {
    throw new Error(
      `No solution for ${side} anchor at ${anchor.value}° — the sun does not ` +
        `reach that depression at this latitude on this date.`,
    );
  }
  return raw;
}

/**
 * Compute a full day of halachic times.
 *
 * Proportional hours are measured between *halachic* sunrise and sunset
 * (visible ∓ halachicSunOffsetMin), which is what the Alter Rebbe's shita
 * requires and what the reference publishes.
 */
export function computeZmanim(
  point: GeoPoint,
  profile: ZmanimProfile,
  date: string,
): DayZmanim {
  const cal = calendarFor(point, profile, date);
  const zone = point.timezone;

  const visibleSunrise = cal.getSunrise();
  const visibleSunset = cal.getSunset();
  if (!visibleSunrise || !visibleSunset) {
    throw new Error(`No sunrise/sunset at ${point.name} on ${date}.`);
  }

  const sunrise = visibleSunrise.setZone(zone);
  const sunset = visibleSunset.setZone(zone);

  const off = profile.halachicSunOffsetMin;
  const sunriseBaal = sunrise.minus({ minutes: off });
  const sunsetBaal = sunset.plus({ minutes: off });

  const dayMin = sunsetBaal.diff(sunriseBaal, 'minutes').minutes;
  const shaah = dayMin / 12;
  const at = (hours: number) => sunriseBaal.plus({ minutes: hours * shaah });

  const chatzos = at(6);

  return {
    date,
    alos: resolveAnchor(profile.alos, cal, 'morning', sunrise).setZone(zone),
    sunrise,
    sunriseBaal,
    sofZmanShma: at(3),
    sofZmanTfila: at(4),
    chatzos,
    minchaGedola: chatzos.plus({ minutes: 0.5 * shaah }),
    minchaKetana: at(9.5),
    plagHamincha: at(10.75),
    sunset,
    sunsetBaal,
    tzeis: resolveAnchor(profile.tzeis, cal, 'evening', sunset).setZone(zone),
    candleLighting: sunset.minus({ minutes: profile.candleOffsetMin }),
    havdalah: resolveAnchor(profile.tzeis, cal, 'evening', sunset)
      .setZone(zone)
      .plus({ minutes: profile.tzeisExtraMin }),
    shaahZmanisMin: shaah,
  };
}
