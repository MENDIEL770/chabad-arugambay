/**
 * Filling a template in.
 *
 * Pure and synchronous, so the admin preview and the real send run the
 * same code — a preview that renders differently from what goes out is
 * worse than no preview.
 */

/** `{{key}}`, tolerating spaces inside the braces. */
const TOKEN = /\{\{\s*([a-z_]+)\s*\}\}/gi;

export interface RenderOptions {
  /**
   * What to do with a placeholder that has no value. In a preview the token
   * is left visible so the editor can see the gap; in a real send it is
   * removed, because a customer receiving a literal `{{eta}}` is worse than
   * a sentence with a hole in it.
   */
  onMissing: 'keep' | 'blank';
}

export function renderTemplate(
  body: string,
  values: Record<string, string | number | null | undefined>,
  opts: RenderOptions = { onMissing: 'blank' },
): string {
  const keep = opts.onMissing === 'keep';

  const lines = body.split('\n').map((line) => {
    let had = 0;
    let filled = 0;

    const rendered = line.replace(TOKEN, (match, key: string) => {
      had += 1;
      const v = values[key.toLowerCase()];
      if (v === null || v === undefined || String(v) === '') {
        return keep ? match : '';
      }
      filled += 1;
      return String(v);
    });

    // A line whose placeholders ALL came back empty is removed entirely,
    // not merely blanked. "הנהג: ·" and "מוכן בעוד דקות" are worse than
    // the line not being there: they read as broken software. A line with
    // no placeholders at all is never touched, so deliberate blank lines
    // between paragraphs survive.
    if (had > 0 && filled === 0 && !keep) return null;

    return tidyLine(rendered);
  });

  return lines
    .filter((l): l is string => l !== null)
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Clean up one line after substitution.
 *
 * When a line holds two placeholders and only one has a value, the
 * separator between them is left stranded — "הנהג: Suresh ·" with no
 * phone number. Removing the debris is the difference between a message
 * that looks written and one that looks generated.
 */
function tidyLine(s: string): string {
  return s
    .replace(/[ \t]{2,}/g, ' ')
    // Two separators that ended up adjacent.
    .replace(/\s*([·—|])\s*(?=[·—|])/g, '')
    // A separator left at either end of the line.
    .replace(/\s*[·—|]\s*$/, '')
    .replace(/^\s*[·—|]\s*/, '')
    // "label:" with nothing after it.
    .replace(/^(.*\S)\s*:\s*$/, (m, lead) => (/\s/.test(lead) ? m : lead + ':'))
    .trimEnd();
}

/** Every placeholder actually used in a template. */
export function tokensIn(body: string): string[] {
  return [...body.matchAll(TOKEN)].map((m) => m[1].toLowerCase());
}

/**
 * Placeholders the editor typed that this message cannot supply.
 *
 * Caught at save time rather than at send time, when the only evidence
 * would be a customer receiving a sentence with a word missing.
 */
export function unknownTokens(body: string, allowed: string[]): string[] {
  const ok = new Set(allowed.map((a) => a.toLowerCase()));
  return [...new Set(tokensIn(body))].filter((t) => !ok.has(t));
}
