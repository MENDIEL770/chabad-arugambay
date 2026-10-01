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

/**
 * Some migrations add no table at all — 0006 adds a column and two
 * functions, 0014 only rewrites one. Checking tables alone reported "every
 * migration has run" while place_order did not exist, which is how
 * restaurant ordering stayed broken without anyone noticing.
 */
const FUNCTIONS: Record<string, { name: string; args: Record<string, unknown> }[]> = {
  '0006_order_tracking': [
    { name: 'order_tracking', args: { p_token: 'probe' } },
    {
      name: 'place_order',
      args: {
        p_tenant: '00000000-0000-0000-0000-000000000001', p_channel: 'web',
        p_fulfillment: 'pickup', p_name: 'probe', p_phone: '+10000000',
        p_lang: 'he', p_address: null, p_address_notes: null, p_table_no: null,
        p_pay_method: 'cash_lkr_at_counter', p_lines: [], p_delivery_fee: 0,
      },
    },
  ],
  '0007_events': [
    { name: 'registration_tracking', args: { p_token: 'probe' } },
  ],
  '0020_rate_limit': [
    { name: 'bump_rate_limit', args: { p_tenant: '00000000-0000-0000-0000-000000000001', p_bucket: 'probe', p_key: '', p_limit: 1, p_window_sec: 60 } },
  ],
  '0021_reports': [
    { name: 'report_summary', args: { p_tenant: '00000000-0000-0000-0000-000000000001', p_from: '2026-01-01', p_to: '2026-01-02' } },
    { name: 'report_by_dish', args: { p_tenant: '00000000-0000-0000-0000-000000000001', p_from: '2026-01-01', p_to: '2026-01-02' } },
  ],
  '0011_printing': [
    { name: 'claim_print_job', args: { p_token: 'probe' } },
  ],
};

const COLUMNS: Record<string, { table: string; column: string }[]> = {
  '0006_order_tracking': [{ table: 'orders', column: 'track_token' }],
  '0013_receipt_media': [{ table: 'receipt_template', column: 'logo_path' }],
  // 0019 adds no table. Listed with an empty table array it printed a tick
  // while checking nothing at all — the same vacuous pass this script was
  // written to stop.
  '0019_happening_days': [
    { table: 'happenings', column: 'weekdays' },
    { table: 'happenings', column: 'image_path' },
  ],
  '0016_travel': [{ table: 'tips', column: 'image_path' }],
  '0022_meal_choices': [
    { table: 'event_template', column: 'meal_choices' },
    { table: 'event_meals', column: 'meal_choices' },
  ],
  '0018_messages': [{ table: 'message_templates', column: 'delay_min' }],
};

/**
 * A migration must give this script something to look for. An entry with no
 * tables, no columns and no functions prints a tick that means nothing.
 */
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
  '0016_travel':        ['stays', 'tips'],
  '0017_event_template':['event_template'],
  '0018_messages':      ['message_templates', 'message_log'],
  '0020_rate_limit':    ['rate_limit_hits'],
};

/** A function that exists raises its own error; a missing one says so. */
async function functionExists(name: string, args: Record<string, unknown>) {
  const { error } = await sb.rpc(name, args);
  if (!error) return true;
  return !/could not find the function|schema cache/i.test(error.message);
}

async function columnExists(table: string, column: string) {
  const { error } = await sb.from(table).select(column).limit(1);
  return !error;
}

const ALL = new Set([
  ...Object.keys(BY_MIGRATION),
  ...Object.keys(FUNCTIONS),
  ...Object.keys(COLUMNS),
]);

let missing = 0;
for (const migration of [...ALL].sort()) {
  const tables = BY_MIGRATION[migration] ?? [];
  const fns = FUNCTIONS[migration] ?? [];
  const cols = COLUMNS[migration] ?? [];
  const gaps: string[] = [];

  for (const f of fns) {
    if (!(await functionExists(f.name, f.args))) gaps.push(`${f.name}()`);
  }
  for (const c of cols) {
    if (!(await columnExists(c.table, c.column))) gaps.push(`${c.table}.${c.column}`);
  }
  if (tables.length === 0) {
    if (gaps.length === 0) console.log(`  ✓ ${migration}`);
    else { missing++; console.log(`  ✗ ${migration.padEnd(26)} missing: ${gaps.join(', ')}`); }
    continue;
  }
  const results = await Promise.all(
    tables.map(async (t) => {
      const { error } = await sb.from(t).select('*').limit(1);
      return { t, ok: !error, code: error?.code };
    }),
  );
  const bad = results.filter((r) => !r.ok).map((b) => b.t).concat(gaps);
  if (bad.length === 0) {
    console.log(`  ✓ ${migration}`);
  } else {
    missing++;
    console.log(`  ✗ ${migration.padEnd(26)} missing: ${bad.join(', ')}`);
  }
}

console.log(
  missing === 0
    ? '\n✓ every migration has run'
    : `\n✗ ${missing} migration(s) still need running — see supabase/all.sql`,
);
