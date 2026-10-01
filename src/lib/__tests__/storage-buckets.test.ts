import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';

/**
 * Every storage bucket the code reads from must be one a migration creates.
 *
 * Supabase does not error when you address a bucket that does not exist —
 * `getPublicUrl` cheerfully builds a URL for it, and the failure only shows
 * up as a broken image in someone's browser. The gallery pointed at a
 * 'gallery' bucket for weeks while the migration created one called
 * 'content'; nothing anywhere said so.
 */
describe('storage buckets', () => {
  const declared = new Set<string>();
  for (const f of readdirSync('supabase/migrations').filter((f) => f.endsWith('.sql'))) {
    const sql = readFileSync(`supabase/migrations/${f}`, 'utf8');
    for (const m of sql.matchAll(/insert into storage\.buckets[\s\S]*?values\s*\(\s*'([a-z0-9_-]+)'/gi)) {
      declared.add(m[1]);
    }
  }

  const referenced = new Set<string>();
  const hits = execSync(
    `grep -rhoE "storage\\.from\\('[a-z0-9_-]+'\\)" src || true`,
  ).toString();
  for (const m of hits.matchAll(/storage\.from\('([a-z0-9_-]+)'\)/g)) {
    referenced.add(m[1]);
  }

  it('finds buckets on both sides', () => {
    expect(declared.size).toBeGreaterThan(2);
    expect(referenced.size).toBeGreaterThan(2);
  });

  it('every referenced bucket is created by a migration', () => {
    const missing = [...referenced].filter((b) => !declared.has(b));
    expect(
      missing,
      `code reads from ${missing.join(', ')} but no migration creates ` +
      `${missing.length === 1 ? 'it' : 'them'}. Declared: ${[...declared].join(', ')}.`,
    ).toEqual([]);
  });
});
