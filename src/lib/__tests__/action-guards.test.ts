import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { canAct } from '@/lib/roles';

/**
 * Every exported Server Action that mutates must authorise first.
 *
 * A Server Action is a public HTTP endpoint. Being defined under /admin
 * protects nothing: the action can be POSTed to ANY route, including a
 * public one, so the proxy never sees it. And because these actions use the
 * service-role client — which bypasses RLS entirely — the in-action check is
 * the only access control there is.
 *
 * This test fails if someone adds an action without a guard.
 */

const MUTATING = /^(save|toggle|restock|upload|remove|create|delete|update|set|add)/i;

function actionFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return actionFiles(full);
    return entry === 'actions.ts' ? [full] : [];
  });
}

describe('server actions authorise before acting', () => {
  const files = actionFiles('src/app');

  it('finds the action modules', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files)('%s guards every mutating export', (file) => {
    const source = readFileSync(file, 'utf8');
    expect(source.trimStart().slice(0, 13)).toMatch(/^['"]use server['"]/);

    const exported = [
      ...source.matchAll(/export async function (\w+)\(([\s\S]*?)\)\s*:[^{]*\{([\s\S]*?)\n\}/g),
    ];
    expect(exported.length).toBeGreaterThan(0);

    const unguarded: string[] = [];
    for (const [, name, , body] of exported) {
      if (!MUTATING.test(name)) continue;
      // signIn/signOut are the authentication surface itself.
      if (name === 'signIn' || name === 'signOut') continue;
      // First STATEMENT, not first line — a leading comment is fine.
      const first = body
        .split('\n')
        .map((l) => l.trim())
        .find((l) => l && !l.startsWith('//') && !l.startsWith('*') && !l.startsWith('/*'));
      if (!first || !/^return guarded\(/.test(first)) {
        unguarded.push(`${name} → ${(first ?? '<empty>').slice(0, 60)}`);
      }
    }

    expect(
      unguarded,
      `These actions do not call guarded() as their first statement.\n` +
        `A Server Action can be POSTed to any route, so the proxy cannot ` +
        `protect it, and these use the service-role client which bypasses RLS.\n\n` +
        unguarded.join('\n'),
    ).toEqual([]);
  });

  it('guarded() authorises before it touches the database', () => {
    const source = readFileSync('src/app/admin/restaurant/menu/actions.ts', 'utf8');
    const guard = source.slice(source.indexOf('async function guarded'));
    const body = guard.slice(0, guard.indexOf('\n}'));
    expect(body.indexOf('requireRole')).toBeGreaterThan(-1);
    // requireRole must come before the callback runs.
    expect(body.indexOf('requireRole')).toBeLessThan(body.indexOf('return run()'));
  });
});

describe('role ranking', () => {
  it('lets an owner do anything staff can', () => {
    expect(canAct('owner', 'staff')).toBe(true);
    expect(canAct('admin', 'staff')).toBe(true);
  });

  it('stops kitchen from editing prices but lets it mark a dish sold out', () => {
    expect(canAct('kitchen', 'staff')).toBe(false);
    expect(canAct('kitchen', 'kitchen')).toBe(true);
  });

  it('gives viewer no write access at all', () => {
    expect(canAct('viewer', 'kitchen')).toBe(false);
    expect(canAct('viewer', 'staff')).toBe(false);
  });
});
