import { createServiceClient } from '@/lib/supabase/server';
import { hasSupabase, TENANT_ID } from '@/lib/config';
import { SEED_MENU } from './seed';
import type { MenuCategory, MenuItem } from './types';
import type { ModifierGroup } from './modifiers';

type Row = Record<string, unknown>;

function toGroups(
  groupRows: Row[],
  optionRows: Row[],
  itemId: string,
): ModifierGroup[] {
  return groupRows
    .filter((g) => g.item_id === itemId)
    .map((g) => ({
      id: g.id as string,
      name: g.name as ModifierGroup['name'],
      kind: g.kind as ModifierGroup['kind'],
      minSelect: (g.min_select as number) ?? 0,
      maxSelect: (g.max_select as number) ?? 1,
      options: optionRows
        .filter((o) => o.group_id === g.id)
        .map((o) => ({
          id: o.id as string,
          name: o.name as ModifierGroup['options'][number]['name'],
          priceDeltaLkr: (o.price_delta_lkr as number) ?? 0,
          isDefault: Boolean(o.is_default),
          allowSide: o.allow_side !== false,
          isAvailable: o.is_available !== false,
        })),
    }));
}

function toItem(
  r: Row,
  publicUrl: (p: string) => string,
  groups: ModifierGroup[],
): MenuItem {
  const path = (r.image_path as string | null) ?? null;
  return {
    id: r.id as string,
    categoryId: r.category_id as string,
    name: r.name as MenuItem['name'],
    description: (r.description ?? { he: '', en: '' }) as MenuItem['description'],
    priceLkr: r.price_lkr as number,
    imagePath: path,
    imageUrl: path ? publicUrl(path) : null,
    kosher: r.kosher as MenuItem['kosher'],
    tags: (r.tags ?? []) as string[],
    prepMinutes: r.prep_minutes as number,
    station: r.station as MenuItem['station'],
    isAvailable: r.is_available as boolean,
    stock: r.stock as MenuItem['stock'],
    stockQty: (r.stock_qty as number | null) ?? null,
    dailyLimit: (r.daily_limit as number | null) ?? null,
    soldToday: (r.sold_today as number) ?? 0,
    sort: (r.sort as number) ?? 0,
    modifierGroups: groups,
  };
}

/**
 * Read the menu for the public site and the admin.
 *
 * Falls back to the local seed when Supabase is not configured, so the site
 * renders on a fresh clone with no environment at all.
 */
export async function getMenu(): Promise<MenuCategory[]> {
  if (!hasSupabase()) return SEED_MENU;

  const sb = createServiceClient();
  const { data: cats, error: catErr } = await sb
    .from('menu_categories')
    .select('id, name, sort, is_active')
    .eq('tenant_id', TENANT_ID)
    .order('sort');

  if (catErr) throw new Error(`Could not load menu categories: ${catErr.message}`);

  const { data: items, error: itemErr } = await sb
    .from('menu_items')
    .select('*')
    .eq('tenant_id', TENANT_ID)
    .order('sort');

  if (itemErr) throw new Error(`Could not load menu items: ${itemErr.message}`);

  const { data: groups, error: gErr } = await sb
    .from('item_modifier_groups')
    .select('id, item_id, name, kind, min_select, max_select, sort')
    .eq('tenant_id', TENANT_ID)
    .order('sort');

  if (gErr) throw new Error(`Could not load modifier groups: ${gErr.message}`);

  const { data: options, error: oErr } = await sb
    .from('item_modifier_options')
    .select('id, group_id, name, price_delta_lkr, is_default, allow_side, is_available, sort')
    .eq('tenant_id', TENANT_ID)
    .order('sort');

  if (oErr) throw new Error(`Could not load modifier options: ${oErr.message}`);

  const publicUrl = (p: string) => sb.storage.from('menu').getPublicUrl(p).data.publicUrl;

  return (cats ?? []).map((c) => ({
    id: c.id as string,
    name: c.name as MenuCategory['name'],
    sort: c.sort as number,
    isActive: c.is_active as boolean,
    items: (items ?? [])
      .filter((i) => i.category_id === c.id)
      .map((i) =>
        toItem(
          i as Row,
          publicUrl,
          toGroups((groups ?? []) as Row[], (options ?? []) as Row[], i.id as string),
        ),
      ),
  }));
}
