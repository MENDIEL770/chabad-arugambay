import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * Any font stack that can receive Hebrew must end in a family that has it.
 *
 * The monospace face on this site is loaded with the Latin subset only. A
 * stack of just that font renders Hebrew as nothing — not as a fallback
 * glyph, not as a box, as blank. The WhatsApp template editor and the
 * receipt header both looked empty while the Latin placeholders beside
 * them were fine, which is a hard failure to even describe, let alone find.
 */
describe('font stacks', () => {
  const css = readFileSync('src/app/globals.css', 'utf8');

  const stacks = [...css.matchAll(/font-family:\s*([^;]+);/g)].map((m) => m[1].trim());

  it('finds the font declarations', () => {
    expect(stacks.length).toBeGreaterThan(0);
  });

  it('every stack naming the Latin-only mono face has a fallback after it', () => {
    for (const stack of stacks.filter((s) => s.includes('--font-mono-ui'))) {
      const after = stack.slice(stack.indexOf('--font-mono-ui'));
      expect(
        /,\s*(ui-monospace|monospace|SFMono|Menlo|system-ui)/.test(after),
        `"${stack}" ends at the Latin-only mono face. Hebrew in a field using ` +
        `it renders blank. Add ui-monospace, monospace after it.`,
      ).toBe(true);
    }
  });

  it('the Tailwind --font-mono token carries the fallback too', () => {
    const token = css.match(/--font-mono:\s*([^;]+);/)?.[1] ?? '';
    expect(token).toContain('--font-mono-ui');
    expect(
      /monospace/.test(token),
      `--font-mono is "${token}" — utilities built on it (font-mono) would ` +
      `render Hebrew blank.`,
    ).toBe(true);
  });
});
