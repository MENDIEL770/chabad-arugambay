/**
 * A deliberately small rich-text format: bold, italic, links, paragraphs
 * and bullets. Nothing else.
 *
 * It parses to a tree of plain objects which the renderer turns into React
 * elements. That is the point of doing it this way rather than storing HTML
 * and using dangerouslySetInnerHTML: text typed by an editor — or injected
 * by anyone who ever gets hold of a staff login — can never become markup.
 * There is no sanitiser to get wrong, because there is no HTML path at all.
 *
 * The syntax is the Markdown subset people already type by habit:
 *
 *   **bold**      *italic*      [text](https://example.com)
 *   - bullet
 *
 * A blank line starts a new paragraph.
 */

export type Inline =
  | { t: 'text'; v: string }
  | { t: 'b'; v: Inline[] }
  | { t: 'i'; v: Inline[] }
  | { t: 'a'; href: string; v: Inline[] };

export type Block =
  | { t: 'p'; v: Inline[] }
  | { t: 'ul'; items: Inline[][] };

/**
 * Only these schemes are allowed through. `javascript:` is the obvious one
 * to keep out, but `data:` is just as dangerous and is the one people
 * forget. Anything unrecognised renders as plain text rather than silently
 * becoming a dead or hostile link.
 */
const SAFE_URL = /^(https?:\/\/|mailto:|tel:|\/)/i;

function parseInline(src: string): Inline[] {
  const out: Inline[] = [];
  let buf = '';

  const flush = () => {
    if (buf) out.push({ t: 'text', v: buf });
    buf = '';
  };

  let i = 0;
  while (i < src.length) {
    // Bold before italic: `**` would otherwise be read as two italics.
    if (src.startsWith('**', i)) {
      const end = src.indexOf('**', i + 2);
      if (end > i + 2) {
        flush();
        out.push({ t: 'b', v: parseInline(src.slice(i + 2, end)) });
        i = end + 2;
        continue;
      }
    }

    if (src[i] === '*') {
      const end = src.indexOf('*', i + 1);
      if (end > i + 1) {
        flush();
        out.push({ t: 'i', v: parseInline(src.slice(i + 1, end)) });
        i = end + 1;
        continue;
      }
    }

    if (src[i] === '[') {
      const close = src.indexOf(']', i);
      if (close > i && src[close + 1] === '(') {
        const paren = src.indexOf(')', close + 2);
        if (paren > close) {
          const href = src.slice(close + 2, paren).trim();
          const label = src.slice(i + 1, close);
          if (SAFE_URL.test(href)) {
            flush();
            out.push({ t: 'a', href, v: parseInline(label) });
            i = paren + 1;
            continue;
          }
          // Unsafe scheme: keep the words, drop the link.
          flush();
          out.push(...parseInline(label));
          i = paren + 1;
          continue;
        }
      }
    }

    buf += src[i];
    i += 1;
  }

  flush();
  return out;
}

export function parseRichText(src: string): Block[] {
  if (!src?.trim()) return [];

  const blocks: Block[] = [];
  // Normalise line endings first — text pasted from Word arrives as CRLF
  // and would otherwise never match a blank-line split.
  const paragraphs = src.replace(/\r\n?/g, '\n').split(/\n{2,}/);

  for (const para of paragraphs) {
    const lines = para.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) continue;

    if (lines.every((l) => /^[-*•]\s+/.test(l))) {
      blocks.push({
        t: 'ul',
        items: lines.map((l) => parseInline(l.replace(/^[-*•]\s+/, ''))),
      });
      continue;
    }

    // A single newline inside a paragraph is a soft wrap, not a break —
    // the same way every text box the editor has used behaves.
    blocks.push({ t: 'p', v: parseInline(lines.join(' ')) });
  }

  return blocks;
}

/** The text with all marks removed — for previews, meta tags and search. */
export function richTextToPlain(src: string): string {
  return parseRichText(src)
    .map((b) =>
      b.t === 'p' ? inlineToPlain(b.v) : b.items.map((it) => `• ${inlineToPlain(it)}`).join('\n'),
    )
    .join('\n\n');
}

function inlineToPlain(nodes: Inline[]): string {
  return nodes
    .map((n) => (n.t === 'text' ? n.v : inlineToPlain(n.v)))
    .join('');
}

/** True if anything would actually render — used to hide empty sections. */
export function hasRichText(src: string | null | undefined): boolean {
  return !!src && parseRichText(src).length > 0;
}
