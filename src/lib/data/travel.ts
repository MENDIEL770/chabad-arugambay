import { createServiceClient } from '@/lib/supabase/server';
import { hasSupabase, TENANT_ID } from '@/lib/config';
import type { I18n } from './types';
import type { IconName } from '@/components/ui/icon';
import { STAYS as SEED_STAYS, TIPS as SEED_TIPS, type TravelTier } from './content';

export interface Stay {
  id: string;
  name: string;
  blurb: I18n;
  tiers: TravelTier[];
  nightlyUsd: number | null;
  walkMinutes: number | null;
  bookingUrl: string | null;
  isAffiliate: boolean;
  imageUrl: string | null;
  icon: IconName;
  sort: number;
  isActive: boolean;
}

export interface Tip {
  id: string;
  title: I18n;
  body: I18n;
  tags: string[];
  icon: IconName;
  imageUrl: string | null;
  sort: number;
  isActive: boolean;
}

type Row = Record<string, unknown>;

/** A storage path becomes a public URL; anything else becomes null. */
function publicUrl(
  sb: ReturnType<typeof createServiceClient>,
  p: unknown,
): string | null {
  return typeof p === 'string' && p
    ? sb.storage.from('content').getPublicUrl(p).data.publicUrl
    : null;
}

function missing(msg: string) {
  return /schema cache|does not exist/i.test(msg);
}

/**
 * Stays from the database, falling back to the seed list.
 *
 * Until 0016 runs — or if the table is emptied — the page shows the
 * original hand-written recommendations rather than nothing. A travel page
 * with no content is worse than one that is slightly out of date.
 */
export async function getStays(includeInactive = false): Promise<Stay[]> {
  if (!hasSupabase()) return seedStays();

  const sb = createServiceClient();
  let q = sb.from('stays').select('*').eq('tenant_id', TENANT_ID).order('sort');
  if (!includeInactive) q = q.eq('is_active', true);

  const { data, error } = await q;
  if (error) {
    if (missing(error.message)) return includeInactive ? [] : seedStays();
    throw new Error(`Could not load stays: ${error.message}`);
  }
  if (!data?.length) return includeInactive ? [] : seedStays();

  return data.map((r: Row) => ({
    id: r.id as string,
    name: r.name as string,
    blurb: (r.blurb ?? { he: '', en: '' }) as I18n,
    tiers: (r.tiers ?? []) as TravelTier[],
    nightlyUsd: (r.nightly_usd as number | null) ?? null,
    walkMinutes: (r.walk_minutes as number | null) ?? null,
    bookingUrl: (r.booking_url as string | null) ?? null,
    isAffiliate: r.is_affiliate === true,
    imageUrl: publicUrl(sb, r.image_path),
    icon: (r.icon as IconName) ?? 'bed',
    sort: (r.sort as number) ?? 0,
    isActive: r.is_active !== false,
  }));
}

export async function getTips(includeInactive = false): Promise<Tip[]> {
  if (!hasSupabase()) return seedTips();

  const sb = createServiceClient();
  let q = sb.from('tips').select('*').eq('tenant_id', TENANT_ID).order('sort');
  if (!includeInactive) q = q.eq('is_active', true);

  const { data, error } = await q;
  if (error) {
    if (missing(error.message)) return includeInactive ? [] : seedTips();
    throw new Error(`Could not load tips: ${error.message}`);
  }
  if (!data?.length) return includeInactive ? [] : seedTips();

  return data.map((r: Row) => ({
    id: r.id as string,
    title: r.title as I18n,
    body: (r.body ?? { he: '', en: '' }) as I18n,
    tags: (r.tags ?? []) as string[],
    icon: (r.icon as IconName) ?? 'map',
    imageUrl: publicUrl(sb, r.image_path),
    sort: (r.sort as number) ?? 0,
    isActive: r.is_active !== false,
  }));
}

/** The hand-written list, shaped like a database row. */
function seedStays(): Stay[] {
  return SEED_STAYS.map((s, i) => ({
    id: s.id,
    name: s.name,
    blurb: s.blurb,
    tiers: [...s.tiers],
    nightlyUsd: s.nightlyUsd,
    walkMinutes: s.walkMinutes,
    bookingUrl: s.bookingUrl,
    isAffiliate: false,
    imageUrl: null,
    icon: s.icon,
    sort: i,
    isActive: true,
  }));
}

function seedTips(): Tip[] {
  return SEED_TIPS.map((t, i) => ({
    id: t.id,
    title: t.title,
    body: t.body,
    tags: [...t.tags],
    icon: t.icon,
    imageUrl: null,
    sort: i,
    isActive: true,
  }));
}
