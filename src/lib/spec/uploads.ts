import { DISH_IMAGE_SPEC } from './dish-image';
import { RECEIPT_IMAGE_SPEC } from './receipt-image';
import { GALLERY_IMAGE_SPEC } from './gallery-image';
import { HERO_IMAGE_SPEC } from '@/lib/data/hero-spec';

/**
 * Every place the site accepts a file, in one table.
 *
 * Bytes go straight from the browser to Storage with a one-shot token. They
 * must not travel through a server action: Next caps an action body at 1MB
 * by default and Vercel caps a serverless request body at 4.5MB regardless,
 * so an 8MB dish photo could never arrive that way. It failed as a redacted
 * React #441 with no mention of size.
 */
export interface UploadKindSpec {
  bucket: string;
  /** Folder under the tenant id. A scope (a dish id) is appended when given. */
  folder: string;
  maxBytes: number;
  formats: readonly string[];
  formatLabel: string;
  /** Whether the caller must pass a scope, such as which dish. */
  needsScope: boolean;
}

export const UPLOAD_KINDS = {
  gallery: {
    bucket: 'content',
    folder: 'gallery',
    maxBytes: GALLERY_IMAGE_SPEC.maxBytes,
    formats: GALLERY_IMAGE_SPEC.formats,
    formatLabel: GALLERY_IMAGE_SPEC.formatLabel,
    needsScope: false,
  },
  dish: {
    bucket: 'menu',
    folder: '',
    maxBytes: DISH_IMAGE_SPEC.maxBytes,
    formats: DISH_IMAGE_SPEC.formats,
    formatLabel: DISH_IMAGE_SPEC.formatLabel,
    needsScope: true,
  },
  hero: {
    bucket: 'hero',
    folder: 'slides',
    maxBytes: HERO_IMAGE_SPEC.maxBytes,
    formats: HERO_IMAGE_SPEC.formats,
    formatLabel: HERO_IMAGE_SPEC.formatLabel,
    needsScope: false,
  },
  receipt: {
    bucket: 'receipt',
    folder: 'logo',
    maxBytes: RECEIPT_IMAGE_SPEC.maxBytes,
    formats: RECEIPT_IMAGE_SPEC.formats,
    formatLabel: RECEIPT_IMAGE_SPEC.formatLabel,
    needsScope: false,
  },
  happening: {
    bucket: 'content',
    folder: 'happenings',
    maxBytes: GALLERY_IMAGE_SPEC.maxBytes,
    formats: GALLERY_IMAGE_SPEC.formats,
    formatLabel: GALLERY_IMAGE_SPEC.formatLabel,
    needsScope: false,
  },
  stay: {
    bucket: 'content',
    folder: 'stays',
    maxBytes: GALLERY_IMAGE_SPEC.maxBytes,
    formats: GALLERY_IMAGE_SPEC.formats,
    formatLabel: GALLERY_IMAGE_SPEC.formatLabel,
    needsScope: false,
  },
} satisfies Record<string, UploadKindSpec>;

export type UploadKind = keyof typeof UPLOAD_KINDS;
