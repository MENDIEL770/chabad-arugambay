import type { I18n } from './types';

/**
 * Hero types and constants, free of server imports.
 *
 * Kept apart from hero.ts because the admin UI is a Client Component: any
 * module it imports is bundled for the browser, and hero.ts reaches for the
 * service-role Supabase client. Splitting them is what keeps that key out of
 * the client bundle — the build fails loudly if this is ever merged back.
 */

export const HERO_IMAGE_SPEC = {
  recommendedWidth: 2400,
  recommendedHeight: 1200,
  aspect: '2:1',
  minWidth: 1600,
  minHeight: 800,
  maxBytes: 5 * 1024 * 1024,
  /** Above this the page feels slow on a Sri Lankan mobile connection. */
  warnBytes: 900 * 1024,
  formats: ['image/jpeg', 'image/webp', 'image/avif', 'image/png'],
  formatLabel: 'JPEG · WebP · AVIF',
} as const;

/** Seconds each slide holds before the crossfade. */
export const HERO_INTERVAL_SECONDS = 7;

export interface HeroSlide {
  id: string;
  imageUrl: string;
  imagePath: string;
  focalX: number;
  focalY: number;
  /** When present, replaces the page's default hero copy while showing. */
  headline: I18n | null;
  subhead: I18n | null;
  ctaLabel: I18n | null;
  ctaHref: string | null;
  overlay: number;
  sort: number;
  isActive: boolean;
  widthPx: number | null;
  heightPx: number | null;
  bytes: number | null;
}
