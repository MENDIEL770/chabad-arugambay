import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';

/**
 * No client component may reach a server-only module.
 *
 * Importing one value from a module that also calls createServiceClient
 * pulls the whole module into the browser bundle and drags next/headers
 * with it. The build fails with "You're importing a module that depends on
 * next/headers" and names neither the client file nor the server one, so
 * the only way to find it is to bisect imports by hand. This test names
 * both ends of the chain.
 *
 * Type-only imports are erased by the compiler and are not followed.
 */

const SERVER_MARKERS = [/^import 'server-only'/m, /@\/lib\/supabase\/server/];

function resolve(spec: string): string | null {
  if (!spec.startsWith('@/')) return null;
  const base = `src/${spec.slice(2)}`;
  for (const p of [`${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`]) {
    if (existsSync(p)) return p;
  }
  return null;
}

/** Value imports only — `import type` and inline `type` specifiers are erased. */
function valueImports(src: string): string[] {
  const out: string[] = [];
  for (const m of src.matchAll(/import\s+(type\s+)?([\s\S]*?)\s*from\s*['"]([^'"]+)['"]/g)) {
    if (m[1]) continue;
    const clause = m[2].trim();
    // `import { type A, B }` still loads the module for B, but
    // `import { type A }` alone does not.
    if (clause.startsWith('{')) {
      const names = clause.slice(1, -1).split(',').map((s) => s.trim()).filter(Boolean);
      if (names.length && names.every((n) => n.startsWith('type '))) continue;
    }
    out.push(m[3]);
  }
  return out;
}

function isServerModule(file: string): boolean {
  const src = readFileSync(file, 'utf8');
  return SERVER_MARKERS.some((re) => re.test(src));
}

describe('client/server split', () => {
  const clients = execSync(`grep -rl "^'use client'" src --include=*.tsx --include=*.ts || true`)
    .toString().trim().split('\n').filter(Boolean);

  it('finds the client components', () => {
    expect(clients.length).toBeGreaterThan(5);
  });

  for (const entry of clients) {
    it(`${entry} stays out of server-only code`, () => {
      const seen = new Set<string>();
      const stack: { file: string; path: string[] }[] = [{ file: entry, path: [entry] }];

      while (stack.length) {
        const { file, path } = stack.pop()!;
        if (seen.has(file)) continue;
        seen.add(file);

        const src = readFileSync(file, 'utf8');

        // A 'use server' module is an RPC boundary, not a bundled import:
        // Next replaces its exports with network stubs, so a client
        // component importing one is correct and nothing behind it is
        // bundled. Checked before the server-only test, because every
        // action module legitimately touches the database.
        if (/^'use server'/m.test(src) && file !== entry) continue;

        if (file !== entry && isServerModule(file)) {
          expect.fail(
            `client component reaches a server-only module:\n  ${path.join('\n  → ')}\n` +
            `Split the pure part into its own file (see src/lib/data/happenings-view.ts).`,
          );
        }

        for (const spec of valueImports(src)) {
          const next = resolve(spec);
          if (next) stack.push({ file: next, path: [...path, next] });
        }
      }
    });
  }
});
