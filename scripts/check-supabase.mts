/**
 * Verify the Supabase connection from the app's own point of view.
 *
 * Run before `npm run dev` so a wrong key surfaces here, with a clear
 * message, rather than as an empty page later. Never prints key material.
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

function loadEnv(): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
      if (m) out[m[1]] = m[2].trim();
    }
  } catch {
    fail('.env.local לא נמצא. הריצו: cp .env.example .env.local');
  }
  return out;
}

function fail(msg: string): never {
  console.error(`\n✗ ${msg}\n`);
  process.exit(1);
}

const env = loadEnv();
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service = env.SUPABASE_SERVICE_ROLE_KEY;
const tenant = env.TENANT_ID;

if (!url) fail('חסר NEXT_PUBLIC_SUPABASE_URL');
if (!anon) fail('חסר NEXT_PUBLIC_SUPABASE_ANON_KEY — Project Settings → API → anon public');
if (!service) fail('חסר SUPABASE_SERVICE_ROLE_KEY — Project Settings → API → service_role');
if (anon === service) fail('anon ו-service_role זהים. הועתק אותו מפתח פעמיים.');

console.log(`\nבודק ${url}\n`);

const pub = createClient(url, anon, { auth: { persistSession: false } });
const svc = createClient(url, service, { auth: { persistSession: false } });

let failures = 0;
async function check(label: string, fn: () => Promise<string>) {
  try {
    console.log(`  ✓ ${label.padEnd(34)} ${await fn()}`);
  } catch (e) {
    failures++;
    console.log(`  ✗ ${label.padEnd(34)} ${(e as Error).message}`);
  }
}

// The anon key must see the public menu — this is what a guest gets.
await check('תפריט ציבורי (anon)', async () => {
  const { data, error } = await pub.from('menu_items').select('id').limit(50);
  if (error) throw new Error(error.message);
  if (!data?.length) throw new Error('0 מנות — RLS חוסם או שה-seed לא רץ');
  return `${data.length} מנות`;
});

await check('תוספות (anon)', async () => {
  const { data, error } = await pub.from('item_modifier_options').select('id');
  if (error) throw new Error(error.message);
  return `${data?.length ?? 0} אפשרויות`;
});

/**
 * The anon key must NOT see orders.
 *
 * Reading an empty table proves nothing — it returns zero rows whether RLS
 * blocks it or the table is simply empty. So plant one row with the service
 * key, try to read it as a guest, and remove it either way. Without this the
 * check passes vacuously until the first real order, which is exactly when a
 * leak would start mattering.
 */
await check('הזמנות חסומות ל-anon', async () => {
  const probe = {
    tenant_id: tenant,
    code: 'RLS-PROBE',
    fulfillment: 'pickup',
    customer_name: 'RLS probe',
    customer_phone: '+000000000',
    items: [],
    pay_method: 'cash_lkr_at_counter',
  };

  const { data: made, error: insErr } = await svc
    .from('orders').insert(probe).select('id').single();
  if (insErr) throw new Error(`לא ניתן לשתול שורת בדיקה: ${insErr.message}`);

  try {
    const { data, error } = await pub.from('orders').select('id').eq('id', made.id);
    if (!error && data && data.length > 0) {
      throw new Error('נחשף! anon קורא הזמנות — בדקו את 0004_rls.sql');
    }
    return 'אומת מול שורה אמיתית';
  } finally {
    await svc.from('orders').delete().eq('id', made.id);
  }
});

await check('כתיבה עם service_role', async () => {
  const { error } = await svc.from('tenants').select('id').eq('id', tenant).single();
  if (error) throw new Error(error.message);
  return 'הדייר נמצא';
});

await check('bucket התמונות', async () => {
  const { data, error } = await svc.storage.getBucket('menu');
  if (error) throw new Error(error.message);
  return data?.public ? 'קיים, ציבורי לקריאה' : 'קיים אך לא ציבורי';
});

console.log(
  failures === 0
    ? '\n✓ החיבור תקין. אפשר להריץ npm run dev\n'
    : `\n✗ ${failures} בדיקות נכשלו\n`,
);
process.exit(failures === 0 ? 0 : 1);
