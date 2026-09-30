import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Guards against a mistake made three times while building this UI.
 *
 * `.money` and `.clock` set `direction: ltr; unicode-bidi: isolate` so a
 * currency run like "2,400 LKR" is not reordered by the surrounding Hebrew.
 * Wrapping Hebrew words in the same element applies that LTR context to them
 * too, which flips their position: "$48 / לילה" puts the price to the LEFT of
 * the unit, the opposite of what a Hebrew reader expects.
 *
 * The rule: those classes wrap digits and Latin currency codes ONLY. Hebrew
 * stays outside them.
 */

const HEBREW = /[֐-׿]/;
const ELEMENT =
  /<(\w+)([^>]*className="[^"]*\b(?:money|clock)\b[^"]*"[^>]*)>([\s\S]*?)<\/\1>/g;

function tsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return tsxFiles(full);
    return full.endsWith('.tsx') ? [full] : [];
  });
}

describe('RTL: LTR-isolated elements never wrap Hebrew', () => {
  it('has no .money or .clock element containing Hebrew letters', () => {
    const offenders: string[] = [];

    for (const file of tsxFiles('src')) {
      const source = readFileSync(file, 'utf8');
      for (const match of source.matchAll(ELEMENT)) {
        const inner = match[3];
        // Ignore interpolations — only literal Hebrew in the markup is checked.
        const literal = inner.replace(/\{[^}]*\}/g, '');
        if (HEBREW.test(literal)) {
          const line = source.slice(0, match.index).split('\n').length;
          offenders.push(`${file}:${line} → ${inner.replace(/\s+/g, ' ').trim().slice(0, 60)}`);
        }
      }
    }

    expect(
      offenders,
      `Hebrew inside an LTR-isolated element reverses its reading order.\n` +
        `Keep the class on the number only:\n` +
        `  <span className="money">{price}</span> ללילה\n\n` +
        offenders.join('\n'),
    ).toEqual([]);
  });
});
