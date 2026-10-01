import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

/**
 * A module marked `use server` may only export async functions.
 *
 * Next.js turns every export of such a file into a callable RPC reference.
 * A constant exported from one does not become a constant on the client —
 * it arrives as `undefined`, and the failure surfaces far from its cause:
 * the opening-hours screen rendered seven nameless rows and its save button
 * threw a redacted React #441, while the menu screen died on
 * `Cannot read properties of undefined (reading 'join')`. Both were one
 * exported array and one exported object.
 *
 * Types and interfaces are erased at compile time, so they are fine.
 */
describe('use server modules', () => {
  const files = execSync('grep -rl "^\'use server\'" src --include=*.ts --include=*.tsx || true')
    .toString().trim().split('\n').filter(Boolean);

  it('finds the action modules at all', () => {
    expect(files.length).toBeGreaterThan(5);
  });

  for (const file of files) {
    it(`${file} exports only async functions`, () => {
      const src = readFileSync(file, 'utf8');

      const offenders: string[] = [];
      for (const line of src.split('\n')) {
        const m = line.match(/^export\s+(const|let|var|class|enum)\s+(\w+)/);
        if (!m) continue;
        // `export const x = async () => {}` is a legitimate action.
        if (m[1] === 'const' && /=\s*async\s*(\(|function)/.test(line)) continue;
        offenders.push(`${m[1]} ${m[2]}`);
      }

      expect(
        offenders,
        `${file} exports ${offenders.join(', ')} — move it to a plain module ` +
        `(see src/lib/days.ts or src/lib/spec/). A 'use server' file may only ` +
        `export async functions; anything else reaches the client as undefined.`,
      ).toEqual([]);

      // `export default` of a non-function has the same problem.
      expect(/^export default (?!async)/m.test(src), `${file} has a non-async default export`)
        .toBe(false);
    });
  }
});
