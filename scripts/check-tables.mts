/**
 * Which migrations have actually run.
 *
 * Uses a plain select rather than a head+count probe: with `head: true` a
 * missing table comes back as {error: null, count: null}, which reads as
 * success and is how this check lied the first time it was written.
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const env: Record<string, string> = {};
for (const l of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = l.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].trim();
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});

const BY_MIGRATION: Record<string, string[]> = {
  '0001_core':          ['tenants', 'memberships', 'tenant_settings'],
  '0002_calendar':      ['tenant_zmanim'],
  '0003_restaurant':    ['menu_items', 'orders', 'item_modifier_groups'],
  '0005_hero':          ['hero_slides'],
  '0007_events':        ['events', 'registrations'],
  '0008_content':       ['media_items', 'site_about', 'articles'],
  '0009_dish_photos':   ['menu_item_images'],
  '0010_happenings':    ['happenings'],
  '0011_printing':      ['printers', 'print_jobs', 'receipt_template'],
  '0012_site_text':     ['site_text'],
  '0013_receipt_media': [],
};

let missing = 0;
for (const [migration, tables] of Object.entries(BY_MIGRATION)) {
  if (tables.length === 0) continue;
  const results = await Promise.all(
    tables.map(async (t) => {
      const { error } = await sb.from(t).select('*').limit(1);
      return { t, ok: !error, code: error?.code };
    }),
  );
  const bad = results.filter((r) => !r.ok);
  if (bad.length === 0) {
    console.log(`  ✓ ${migration}`);
  } else {
    missing++;
    console.log(`  ✗ ${migration.padEnd(20)} missing: ${bad.map((b) => b.t).join(', ')}`);
  }
}

console.log(
  missing === 0
    ? '\n✓ every migration has run'
    : `\n✗ ${missing} migration(s) still need running — see supabase/all.sql`,
);
