import { describe, it, expect } from 'vitest';
import { renderTemplate, tokensIn, unknownTokens } from '@/lib/whatsapp/template';
import { MESSAGES, placeholdersFor, sampleValues, eventForOrderStatus } from '@/lib/whatsapp/catalogue';

describe('message templates', () => {
  it('substitutes values', () => {
    expect(renderTemplate('שלום {{name}}', { name: 'מנדי' })).toBe('שלום מנדי');
  });

  it('tolerates spaces in the braces', () => {
    expect(renderTemplate('{{ name }}', { name: 'מנדי' })).toBe('מנדי');
  });

  it('drops a line that was only an empty placeholder', () => {
    const out = renderTemplate('שורה\n{{driver}}\nשורה אחרונה', { driver: null });
    expect(out).toBe('שורה\nשורה אחרונה');
  });

  it('removes the whole line when every placeholder on it is empty', () => {
    // Better than "מוכן בעוד דקות", which reads as broken software.
    expect(renderTemplate('מוכן בעוד {{eta}} דקות', { eta: null })).toBe('');
    expect(renderTemplate('שלום\nהנהג: {{driver}} · {{driver_phone}}', {}))
      .toBe('שלום');
  });

  it('keeps a line that still has a value, and tidies the stranded separator', () => {
    expect(renderTemplate('הנהג: {{driver}} · {{driver_phone}}', { driver: 'Suresh' }))
      .toBe('הנהג: Suresh');
  });

  it('leaves deliberate blank lines between paragraphs alone', () => {
    expect(renderTemplate('ראשונה\n\nשנייה', {})).toBe('ראשונה\n\nשנייה');
  });

  it('keeps the token visible in a preview', () => {
    expect(renderTemplate('{{eta}}', {}, { onMissing: 'keep' })).toBe('{{eta}}');
  });

  it('never sends a literal placeholder to a customer', () => {
    for (const m of MESSAGES) {
      const out = renderTemplate(m.defaultBody, {}, { onMissing: 'blank' });
      expect(out, m.event).not.toMatch(/\{\{/);
    }
  });

  // The failure this guards against is a template that renders with a hole
  // in it because somebody typed a placeholder the event cannot supply.
  it('every default template only uses placeholders its own event offers', () => {
    for (const m of MESSAGES) {
      const allowed = placeholdersFor(m.event).map((p) => p.key);
      expect(unknownTokens(m.defaultBody, allowed), m.event).toEqual([]);
    }
  });

  it('every default template renders to real text from the samples', () => {
    for (const m of MESSAGES) {
      const out = renderTemplate(m.defaultBody, sampleValues(m.event));
      expect(out.length, m.event).toBeGreaterThan(10);
      expect(out, m.event).not.toMatch(/\{\{/);
      // No stray blank runs left behind by substitution.
      expect(out, m.event).not.toMatch(/\n{3,}/);
    }
  });

  it('maps the order statuses that should message onto events', () => {
    for (const s of ['received', 'accepted', 'ready', 'dispatched', 'delivered', 'rejected']) {
      expect(eventForOrderStatus(s), s).toBe(`order_${s}`);
    }
    // Internal bookkeeping must stay silent.
    for (const s of ['preparing', 'completed', 'nonsense']) {
      expect(eventForOrderStatus(s), s).toBeNull();
    }
  });

  it('finds the tokens in a body', () => {
    expect(tokensIn('{{a}} and {{B}} and {{a}}')).toEqual(['a', 'b', 'a']);
  });
});
