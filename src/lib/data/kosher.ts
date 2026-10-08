import { createServiceClient } from '@/lib/supabase/server';
import { hasSupabase, TENANT_ID } from '@/lib/config';
import type { I18n } from './types';
import type { IconName } from '@/components/ui/icon';

export type KosherStatus = 'kosher' | 'not_kosher' | 'check';

export interface KosherCategory {
  id: string;
  name: I18n;
  icon: IconName;
  sort: number;
  isActive: boolean;
  count: number;
}

export interface KosherProduct {
  id: string;
  categoryId: string | null;
  name: I18n;
  brand: string | null;
  status: KosherStatus;
  certification: string | null;
  kosherType: string | null;
  notes: I18n;
  whereToBuy: string | null;
  barcode: string | null;
  imageUrl: string | null;
  verifiedOn: string | null;
  sort: number;
  isActive: boolean;
}

function missing(msg: string): boolean {
  return /kosher_|schema cache|does not exist/i.test(msg);
}

export async function getKosherCategories(
  includeHidden = false,
): Promise<KosherCategory[]> {
  if (!hasSupabase()) return [];
  const sb = createServiceClient();

  let q = sb.from('kosher_categories').select('*').eq('tenant_id', TENANT_ID).order('sort');
  if (!includeHidden) q = q.eq('is_active', true);

  const { data, error } = await q;
  if (error) {
    if (missing(error.message)) return [];
    throw new Error(`Could not load kosher categories: ${error.message}`);
  }

  // Counted here rather than with a join: the page shows the number beside
  // each filter, and an empty category should be visibly empty rather than
  // look like a filter that is broken.
  const { data: counts } = await sb
    .from('kosher_products')
    .select('category_id')
    .eq('tenant_id', TENANT_ID)
    .eq('is_active', true);

  const byCat = new Map<string, number>();
  for (const row of counts ?? []) {
    const id = row.category_id as string | null;
    if (id) byCat.set(id, (byCat.get(id) ?? 0) + 1);
  }

  return (data ?? []).map((r) => ({
    id: r.id as string,
    name: r.name as I18n,
    icon: (r.icon as IconName) ?? 'dish',
    sort: (r.sort as number) ?? 0,
    isActive: r.is_active !== false,
    count: byCat.get(r.id as string) ?? 0,
  }));
}

export async function getKosherProducts(
  includeHidden = false,
): Promise<KosherProduct[]> {
  if (!hasSupabase()) return [];
  const sb = createServiceClient();

  let q = sb.from('kosher_products').select('*').eq('tenant_id', TENANT_ID)
    .order('sort').order('created_at');
  if (!includeHidden) q = q.eq('is_active', true);

  const { data, error } = await q;
  if (error) {
    if (missing(error.message)) return [];
    throw new Error(`Could not load kosher products: ${error.message}`);
  }

  return (data ?? []).map((r) => ({
    id: r.id as string,
    categoryId: (r.category_id as string | null) ?? null,
    name: r.name as I18n,
    brand: (r.brand as string | null) ?? null,
    status: (r.status as KosherStatus) ?? 'check',
    certification: (r.certification as string | null) ?? null,
    kosherType: (r.kosher_type as string | null) ?? null,
    notes: (r.notes ?? {}) as I18n,
    whereToBuy: (r.where_to_buy as string | null) ?? null,
    barcode: (r.barcode as string | null) ?? null,
    imageUrl: r.image_path
      ? sb.storage.from('content').getPublicUrl(r.image_path as string).data.publicUrl
      : null,
    verifiedOn: (r.verified_on as string | null) ?? null,
    sort: (r.sort as number) ?? 0,
    isActive: r.is_active !== false,
  }));
}
