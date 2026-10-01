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

/**
 * Every exported action must EITHER call guarded() first, OR carry an
 * explicit PUBLIC ACTION marker in the module explaining why it is open.
 *
 * An earlier version of this test matched a list of verbs instead, and
 * `placeOrder` slipped straight through it — a mutating endpoint passing the
 * security test on a naming technicality. Opt-out beats guesswork.
 */
const PUBLIC_MARKER = /PUBLIC ACTION/;

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

    // A module may declare itself public; the marker must say why.
    const isPublicModule = PUBLIC_MARKER.test(source);

    const unguarded: string[] = [];
    for (const [, name, , body] of exported) {
      if (isPublicModule) continue;
      // signIn/signOut are the authentication surface itself.
      if (name === 'signIn' || name === 'signOut') continue;
      // First STATEMENT, not first line — a leading comment is fine.
      const first = body
        .split('\n')
        .map((l) => l.trim())
        .find((l) => l && !l.startsWith('//') && !l.startsWith('*') && !l.startsWith('/*'));
      /**
       * Two acceptable shapes, both of which authorise before anything else:
       *   return guarded(role, …)      — the shared wrapper calls requireRole
       *   await requireRole(role)      — called directly, inline or in a try
       * Anything else reaches the service-role client unauthorised.
       */
      const viaWrapper = /^return guarded\(/.test(first ?? '');
      const viaDirect =
        /^(try \{|await requireRole\()/.test(first ?? '') && /await requireRole\(/.test(body);
      if (!first || !(viaWrapper || viaDirect)) {
        unguarded.push(`${name} → ${(first ?? '<empty>').slice(0, 60)}`);
      }
    }

    expect(
      unguarded,
      `These actions do not call guarded() as their first statement.\n` +
        `A Server Action can be POSTed to any route, so the proxy cannot ` +
        `protect it, and these use the service-role client which bypasses RLS.\n` +
        `If an action is deliberately open, add a "PUBLIC ACTION" comment to ` +
        `the module saying what protects it instead.\n\n` +
        unguarded.join('\n'),
    ).toEqual([]);
  });

  it('a public action module states what protects it instead', () => {
    const source = readFileSync('src/app/menu/actions.ts', 'utf8');
    expect(source).toMatch(/PUBLIC ACTION/);
    // The three properties that stand in for authorisation.
    expect(source).toMatch(/[Pp]rices are never taken from the client/);
    expect(source).toMatch(/[Ss]ellability is re-checked/);
    expect(source).toMatch(/rate limit/i);
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
