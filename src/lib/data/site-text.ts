import { createServiceClient } from '@/lib/supabase/server';
import { hasSupabase, TENANT_ID } from '@/lib/config';
import type { TextKey, TextOverrides } from '@/lib/site-text';

/**
 * Load the overrides for a request.
 *
 * Any failure returns an empty object rather than throwing: the caller then
 * renders the code defaults, which is always a working page. Copy editing
 * must never be able to take the site down.
 */
export async function getSiteText(): Promise<TextOverrides> {
  if (!hasSupabase()) return {};

  const { data, error } = await createServiceClient()
    .from('site_text')
    .select('key, value')
    .eq('tenant_id', TENANT_ID);

  if (error || !data) return {};

  const out: TextOverrides = {};
  for (const row of data) {
    const v = row.value as { he?: string; en?: string } | null;
    if (!v) continue;
    out[row.key as TextKey] = { he: v.he ?? '', en: v.en ?? '' };
  }
  return out;
}
