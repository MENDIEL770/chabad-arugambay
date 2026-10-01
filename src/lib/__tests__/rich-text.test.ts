import { describe, it, expect } from 'vitest';
import { parseRichText, richTextToPlain, hasRichText } from '@/lib/rich-text';

describe('rich text', () => {
  it('splits paragraphs on a blank line and joins soft wraps', () => {
    const b = parseRichText('שורה אחת\nהמשך אותה פסקה\n\nפסקה שנייה');
    expect(b).toHaveLength(2);
    expect(richTextToPlain('שורה אחת\nהמשך אותה פסקה\n\nפסקה שנייה'))
      .toBe('שורה אחת המשך אותה פסקה\n\nפסקה שנייה');
  });

  it('handles CRLF, which is what pasting from Word produces', () => {
    expect(parseRichText('א\r\n\r\nב')).toHaveLength(2);
  });

  it('reads bold before italic so ** is not two italics', () => {
    const [p] = parseRichText('**חשוב**');
    expect(p).toEqual({ t: 'p', v: [{ t: 'b', v: [{ t: 'text', v: 'חשוב' }] }] });
  });

  it('nests marks', () => {
    const [p] = parseRichText('**מודגש *וגם נטוי***');
    expect(JSON.stringify(p)).toContain('"t":"i"');
  });

  it('leaves an unclosed mark as literal text', () => {
    expect(richTextToPlain('2 * 3 = 6')).toBe('2 * 3 = 6');
    expect(richTextToPlain('**לא נסגר')).toBe('**לא נסגר');
  });

  it('makes bullets from dashes', () => {
    const [b] = parseRichText('- ראשון\n- שני');
    expect(b).toMatchObject({ t: 'ul' });
    expect((b as { items: unknown[] }).items).toHaveLength(2);
  });

  // The security boundary. These are the schemes that turn stored text into
  // code if they ever reach an href.
  it.each([
    'javascript:alert(1)',
    'JaVaScRiPt:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'vbscript:msgbox',
    'file:///etc/passwd',
  ])('refuses %s as a link target, keeping the words', (href) => {
    const out = JSON.stringify(parseRichText(`[לחצו](${href})`));
    expect(out).not.toContain('"t":"a"');
    expect(out).toContain('לחצו');
  });

  it.each(['https://x.com', 'http://x.com', 'mailto:a@b.c', 'tel:+94771234567', '/menu'])(
    'allows %s',
    (href) => {
      const out = JSON.stringify(parseRichText(`[כאן](${href})`));
      expect(out).toContain('"t":"a"');
      expect(out).toContain(href);
    },
  );

  it('never produces anything but the known node kinds', () => {
    // Belt and braces: whatever the input, the tree can only contain tags
    // the renderer knows, so no input can introduce a new element.
    const wild = '<script>alert(1)</script> **[x](javascript:1)** <img onerror=1>';
    const kinds = new Set<string>();
    const walk = (n: unknown): void => {
      if (Array.isArray(n)) return n.forEach(walk);
      if (n && typeof n === 'object') {
        const o = n as Record<string, unknown>;
        if (typeof o.t === 'string') kinds.add(o.t);
        Object.values(o).forEach(walk);
      }
    };
    walk(parseRichText(wild));
    expect([...kinds].sort()).toEqual(expect.arrayContaining(['p', 'text']));
    for (const k of kinds) expect(['p', 'ul', 'text', 'b', 'i', 'a']).toContain(k);
  });

  it('treats angle brackets as literal characters, not markup', () => {
    expect(richTextToPlain('<b>לא תגית</b>')).toBe('<b>לא תגית</b>');
  });

  it('knows when there is nothing to show', () => {
    expect(hasRichText('')).toBe(false);
    expect(hasRichText('   \n\n  ')).toBe(false);
    expect(hasRichText(null)).toBe(false);
    expect(hasRichText('טקסט')).toBe(true);
  });
});
