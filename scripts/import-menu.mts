/**
 * Apply the real menu to the database.
 *
 * Goes through the API rather than a .sql file so the Hebrew never passes
 * through the clipboard — which corrupted it on this project once — and so
 * the result can be read back and verified in the same run.
 *
 * Re-runnable: it clears the tenant's menu first. Order history is
 * unaffected, because every order stores a snapshot of its lines rather
 * than pointing at these rows.
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { REAL_MENU } from '../src/lib/data/real-menu';

const env: Record<string, string> = {};
for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].trim();
}

const TENANT = env.TENANT_ID || '00000000-0000-0000-0000-000000000001';
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});

function die(where: string, error: { message: string } | null): asserts error is null {
  if (error) {
    console.error(`✗ ${where}: ${error.message}`);
    process.exit(1);
  }
}

console.log('clearing the existing menu…');
die('delete items', (await sb.from('menu_items').delete().eq('tenant_id', TENANT)).error);
die('delete categories', (await sb.from('menu_categories').delete().eq('tenant_id', TENANT)).error);

let items = 0;
let groups = 0;
let options = 0;

for (const [ci, cat] of REAL_MENU.entries()) {
  const { data: category, error: ce } = await sb
    .from('menu_categories')
    .insert({ tenant_id: TENANT, name: { he: cat.he, en: cat.en }, sort: ci + 1 })
    .select('id')
    .single();
  die(`category ${cat.he}`, ce);

  for (const [ii, item] of cat.items.entries()) {
    const { data: row, error: ie } = await sb
      .from('menu_items')
      .insert({
        tenant_id: TENANT,
        category_id: category!.id,
        name: { he: item.he, en: item.en },
        description: { he: item.descHe ?? '', en: item.descEn ?? '' },
        price_lkr: item.price,
        kosher: item.kosher,
        station: item.station ?? 'grill',
        prep_minutes: item.prep ?? 12,
        tags: item.tags ?? [],
        sort: ii + 1,
      })
      .select('id')
      .single();
    die(`item ${item.he}`, ie);
    items++;

    for (const [gi, group] of (item.groups ?? []).entries()) {
      const { data: g, error: ge } = await sb
        .from('item_modifier_groups')
        .insert({
          tenant_id: TENANT,
          item_id: row!.id,
          name: { he: group.he, en: group.en },
          kind: group.kind,
          min_select: group.min ?? 0,
          max_select: group.max ?? 1,
          sort: gi + 1,
        })
        .select('id')
        .single();
      die(`group ${group.he} on ${item.he}`, ge);
      groups++;

      const { error: oe } = await sb.from('item_modifier_options').insert(
        group.options.map((o, oi) => ({
          tenant_id: TENANT,
          group_id: g!.id,
          name: { he: o.he, en: o.en },
          price_delta_lkr: o.price ?? 0,
          is_default: o.isDefault ?? false,
          allow_side: o.allowSide ?? true,
          sort: oi + 1,
        })),
      );
      die(`options for ${group.he}`, oe);
      options += group.options.length;
    }
  }
}

// Read it back: an import that reports success without being checked is
// how a half-written menu goes unnoticed.
const { data: check } = await sb
  .from('menu_items')
  .select('name, price_lkr')
  .eq('tenant_id', TENANT)
  .order('price_lkr', { ascending: false })
  .limit(3);

console.log(`\n✓ ${REAL_MENU.length} categories · ${items} dishes · ${groups} option groups · ${options} options`);
console.log('  most expensive:', (check ?? []).map((r) => `${(r.name as { he: string }).he} ${r.price_lkr}`).join(' · '));

const { data: hebrew } = await sb
  .from('menu_items').select('name').eq('tenant_id', TENANT).limit(1).single();
const sample = (hebrew!.name as { he: string }).he;
console.log('  encoding check:', /[֐-׿]/.test(sample) && !sample.includes('◊')
  ? `ok — "${sample}"`
  : `SUSPECT — "${sample}"`);
