/**
 * Halachic-time profile — every knob the Baal HaTanya (Alter Rebbe) calculation
 * depends on, in one place.
 *
 * Why a profile instead of hardcoded calls into kosher-zmanim:
 * the authoritative reference for this Chabad house is zmanim.org.il
 * ("זמני הלכה לשיטת אדמו״ר הזקן", Rabbi Yaakov Sangawi). That site computes
 * client-side and exposes no API, so we cannot call it — we have to reproduce
 * it. Reproducing it means calibrating against published times, and calibration
 * constants belong in data, not scattered through code.
 *
 * Calibration status (see compute.test.ts):
 *   Fitted against Arugam Bay, 22/09/2026 — 9 of 10 published times land
 *   within one minute. `alos` and `tzeis` each have TWO models that fit that
 *   single date equally well (degrees vs fixed minutes); they diverge by a few
 *   minutes at the solstices. Resolving that needs one more reference date.
 *   Until then the degree-based model is used, which is the one the Alter
 *   Rebbe's shita is normally expressed in.
 */

export type SunAnchor =
  | { kind: 'degrees'; value: number }
  | { kind: 'fixedMinutes'; value: number };

export interface ZmanimProfile {
  method: 'baal_hatanya';

  /**
   * Horizon-dip calibration, expressed as the elevation in metres that
   * reproduces the reference site's sunrise/sunset.
   *
   * This is NOT the physical elevation of Arugam Bay (a beach town, ~3 m).
   * It is the value that makes our visible sunrise/sunset agree with the
   * authority — the reference applies a larger horizon dip than a sea-level
   * standard-refraction model does. Naming it honestly keeps the next
   * developer from "correcting" it to 3 and silently breaking every time.
   */
  horizonDipMeters: number;

  /**
   * Minutes between visible sunrise/sunset and halachic ("true") sunrise and
   * sunset. The Alter Rebbe's shita is usually stated as 1.583° below the
   * horizon; at Arugam Bay's tropical latitude that angle yields ~3 min, while
   * the reference publishes a clean 4. The reference uses the minutes, so we do.
   * All proportional hours are measured between these two instants.
   */
  halachicSunOffsetMin: number;

  /** Dawn. 27.13° fits the reference; the nearest named shita is 26°. */
  alos: SunAnchor;

  /** Nightfall (three stars). 6.34° fits; the named shita is 6°. */
  tzeis: SunAnchor;

  /** Candle lighting, minutes before *visible* sunset. */
  candleOffsetMin: number;

  /** Added to tzeis for the end of Shabbat / Yom Tov. */
  tzeisExtraMin: number;
}

export const BAAL_HATANYA_ARUGAM_BAY: ZmanimProfile = {
  method: 'baal_hatanya',
  horizonDipMeters: 80.5,
  halachicSunOffsetMin: 4,
  alos: { kind: 'degrees', value: 27.13 },
  tzeis: { kind: 'degrees', value: 6.34 },
  candleOffsetMin: 18,
  tzeisExtraMin: 4,
};

/** The alternative models that fit 22/09/2026 equally well. Kept so the
 *  ambiguity is visible in code, and so a second reference date can be
 *  decided by running the test suite against both. */
export const ALTERNATE_FITS = {
  alosFixed: { kind: 'fixedMinutes', value: 104 } as SunAnchor,
  tzeisFixed: { kind: 'fixedMinutes', value: 21 } as SunAnchor,
  alosNamedShita: { kind: 'degrees', value: 26 } as SunAnchor,
  tzeisNamedShita: { kind: 'degrees', value: 6 } as SunAnchor,
};

export interface GeoPoint {
  name: string;
  latitude: number;
  longitude: number;
  timezone: string;
}

export const ARUGAM_BAY: GeoPoint = {
  name: 'Arugam Bay',
  latitude: 6.8404,
  longitude: 81.8353,
  timezone: 'Asia/Colombo',
};
