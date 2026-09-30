/**
 * Report which migrations are actually applied to the connected database.
 *
 * The app degrades when a table is missing rather than crashing, which is
 * the right behaviour but makes it easy not to notice. This says plainly
 * what is there and what is not.
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const env: Record<string, string> = {};
for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].trim();
}

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});

const MIGRATIONS: { file: string; tables: string[]; functions: string[]; buckets: string[] }[] = [
  { file: '0001_core.sql', tables: ['tenants', 'memberships', 'tenant_settings'], functions: ['app_can'], buckets: [] },
  { file: '0002_calendar.sql', tables: ['tenant_zmanim'], functions: [], buckets: [] },
  { file: '0003_restaurant.sql', tables: ['menu_categories', 'menu_items', 'item_modifier_groups', 'item_modifier_options', 'orders', 'order_events', 'opening_hours'], functions: [], buckets: [] },
  { file: '0004_rls.sql', tables: [], functions: [], buckets: ['menu'] },
  { file: '0005_hero.sql', tables: ['hero_slides'], functions: [], buckets: ['hero'] },
  { file: '0006_order_tracking.sql', tables: [], functions: ['place_order', 'order_tracking'], buckets: [] },
  { file: '0007_events.sql', tables: ['events', 'event_meals', 'registrant_types', 'registrations'], functions: ['place_registration', 'meal_seats_left'], buckets: [] },
];

async function tableExists(name: string): Promise<boolean> {
  const { error } = await sb.from(name).select('*', { head: true, count: 'exact' }).limit(0);
  if (!error) return true;
  return !/schema cache|does not exist|Could not find the table/i.test(error.message);
}

async function functionExists(name: string): Promise<boolean> {
  // Call with no args: a missing function reports differently from one that
  // exists but rejects the arguments.
  const { error } = await sb.rpc(name, {});
  if (!error) return true;
  return !/Could not find the function|does not exist|schema cache/i.test(error.message);
}

async function bucketExists(id: string): Promise<boolean> {
  const { error } = await sb.storage.getBucket(id);
  return !error;
}

let missing = 0;
console.log(`\n${env.NEXT_PUBLIC_SUPABASE_URL}\n`);

for (const m of MIGRATIONS) {
  const checks: string[] = [];
  let ok = true;

  for (const t of m.tables) {
    const has = await tableExists(t);
    if (!has) { ok = false; checks.push(`table ${t}`); }
  }
  for (const f of m.functions) {
    const has = await functionExists(f);
    if (!has) { ok = false; checks.push(`function ${f}()`); }
  }
  for (const b of m.buckets) {
    const has = await bucketExists(b);
    if (!has) { ok = false; checks.push(`bucket '${b}'`); }
  }

  if (ok) {
    console.log(`  ✓ ${m.file}`);
  } else {
    missing++;
    console.log(`  ✗ ${m.file}  — missing: ${checks.join(', ')}`);
  }
}

console.log(
  missing === 0
    ? '\n✓ every migration is applied\n'
    : `\n✗ ${missing} migration(s) not applied. Run the missing files from supabase/migrations/ in order.\n`,
);
process.exit(missing === 0 ? 0 : 1);
