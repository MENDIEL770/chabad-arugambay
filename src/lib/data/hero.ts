import { createServiceClient } from '@/lib/supabase/server';
import { hasSupabase, TENANT_ID } from '@/lib/config';
import type { HeroSlide } from './hero-spec';
import type { I18n } from './types';

export { HERO_IMAGE_SPEC, HERO_INTERVAL_SECONDS } from './hero-spec';
export type { HeroSlide } from './hero-spec';

type Row = Record<string, unknown>;

function toSlide(r: Row, publicUrl: (p: string) => string): HeroSlide {
  const path = r.image_path as string;
  return {
    id: r.id as string,
    imagePath: path,
    imageUrl: publicUrl(path),
    focalX: (r.focal_x as number) ?? 50,
    focalY: (r.focal_y as number) ?? 50,
    headline: (r.headline as I18n | null) ?? null,
    subhead: (r.subhead as I18n | null) ?? null,
    ctaLabel: (r.cta_label as I18n | null) ?? null,
    ctaHref: (r.cta_href as string | null) ?? null,
    overlay: (r.overlay as number) ?? 35,
    sort: (r.sort as number) ?? 0,
    isActive: r.is_active !== false,
    widthPx: (r.width_px as number | null) ?? null,
    heightPx: (r.height_px as number | null) ?? null,
    bytes: (r.bytes as number | null) ?? null,
  };
}

/**
 * @param includeInactive admin listing wants everything; the public site
 *        must only ever receive slides that are switched on.
 */
export async function getHeroSlides(includeInactive = false): Promise<HeroSlide[]> {
  if (!hasSupabase()) return [];

  const sb = createServiceClient();
  let query = sb
    .from('hero_slides')
    .select('*')
    .eq('tenant_id', TENANT_ID)
    .order('sort');

  if (!includeInactive) query = query.eq('is_active', true);

  const { data, error } = await query;

  if (error) {
    /**
     * The hero backdrop is an enhancement: without it the page draws its own
     * horizon and looks fine. So a missing table — which is exactly the state
     * between deploying this code and running 0005_hero.sql — must not take
     * down the home page. Anything else is a real fault and still throws.
     */
    const missingTable =
      error.code === 'PGRST205' || /schema cache|does not exist/i.test(error.message);
    if (missingTable) {
      console.warn(
        '[hero] hero_slides is missing — run supabase/migrations/0005_hero.sql. ' +
          'Falling back to the drawn backdrop.',
      );
      return [];
    }
    throw new Error(`Could not load hero slides: ${error.message}`);
  }

  const publicUrl = (p: string) => sb.storage.from('hero').getPublicUrl(p).data.publicUrl;
  return (data ?? []).map((r) => toSlide(r as Row, publicUrl));
}
