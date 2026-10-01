import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TEMPLATE, PAPER_COLS, SAMPLE_ORDER,
  renderKitchenTicket, renderReceipt,
} from './receipt';

const t80 = DEFAULT_TEMPLATE;
const t58 = { ...DEFAULT_TEMPLATE, paperWidth: 58 };

/** Rendered lines as one string, for content assertions. */
const text = (ls: { text: string }[]) => ls.map((l) => l.text).join('\n');

describe('receipt fits the paper', () => {
  it('never emits a line wider than 80mm paper', () => {
    const cols = PAPER_COLS[80];
    // Centred prose carries no padding — the browser and the printer each
    // centre it — so only the grid kinds are measured.
    for (const line of renderReceipt(t80, SAMPLE_ORDER)) {
      if (line.kind === 'centre') continue;
      expect(line.text.length, `too wide: ${line.text}`).toBeLessThanOrEqual(cols);
    }
  });

  it('never emits a line wider than 58mm paper', () => {
    const cols = PAPER_COLS[58];
    for (const line of renderReceipt(t58, SAMPLE_ORDER)) {
      if (line.kind === 'centre') continue;
      expect(line.text.length, `too wide: ${line.text}`).toBeLessThanOrEqual(cols);
    }
  });

  it('keeps the kitchen ticket inside the paper too', () => {
    for (const line of renderKitchenTicket(t58, SAMPLE_ORDER)) {
      if (line.kind === 'centre') continue;
      expect(line.text.length).toBeLessThanOrEqual(PAPER_COLS[58]);
    }
  });
});

describe('what each ticket shows', () => {
  const customer = text(renderReceipt(t80, SAMPLE_ORDER));
  const kitchen = text(renderKitchenTicket(t80, SAMPLE_ORDER));

  it('puts the total on the customer receipt', () => {
    expect(customer).toContain('TOTAL');
    expect(customer).toContain('11,900 LKR');
  });

  it('keeps money off the kitchen ticket by default', () => {
    expect(kitchen).not.toContain('LKR');
    expect(kitchen).not.toContain('TOTAL');
  });

  it('shows money on the kitchen ticket when asked', () => {
    const withPrices = renderKitchenTicket({ ...t80, kitchenShowPrices: true }, SAMPLE_ORDER);
    expect(withPrices.map((l) => l.text).join('\n')).toContain('11,900 LKR');
  });

  it('carries every exception through to the cook', () => {
    expect(kitchen).toContain('NO ONION');
    expect(kitchen).toContain('TAHINI ON SIDE');
    expect(kitchen).toContain('+ EGG');
    expect(kitchen).toContain('extra spicy');
  });

  it('drops prices from the customer receipt when switched off', () => {
    const noPrices = text(renderReceipt({ ...t80, showPrices: false }, SAMPLE_ORDER));
    expect(noPrices).not.toContain('TOTAL');
    // ...but the dishes are still listed.
    expect(noPrices).toContain('Shawarma in laffa');
  });
});

describe('totals line up in the right column', () => {
  it('right-aligns the amount against the paper edge', () => {
    const cols = PAPER_COLS[80];
    const line = renderReceipt(t80, SAMPLE_ORDER).find((l) => l.text.startsWith('TOTAL'))!;
    // The amount must end exactly at the last column, or columns drift.
    expect(line.text.length).toBe(cols);
    expect(line.text.endsWith('11,900 LKR')).toBe(true);
  });
});

describe('header and footer', () => {
  it('uses the configured lines', () => {
    const custom = text(
      renderReceipt({ ...t80, headerLines: ['ONE', 'TWO'], footerLines: ['BYE'] }, SAMPLE_ORDER),
    );
    expect(custom).toContain('ONE');
    expect(custom).toContain('TWO');
    expect(custom).toContain('BYE');
  });

  it('accepts an empty header as a deliberate choice', () => {
    const bare = renderReceipt({ ...t80, headerLines: [] }, SAMPLE_ORDER);
    expect(bare[0].text).toMatch(/^=+$/);
  });
});

describe('Hebrew', () => {
  it('flags lines the printer must draw rather than send as text', () => {
    const lines = renderReceipt(
      { ...t80, headerLines: ['בית חב״ד ארוגם ביי', 'Main Street'] },
      SAMPLE_ORDER,
    );
    expect(lines[0].hasHebrew).toBe(true);
    expect(lines[1].hasHebrew).toBe(false);
  });

  it('does not pad a centred Hebrew line, which would misplace the spaces', () => {
    const [first] = renderReceipt({ ...t80, headerLines: ['שלום'] }, SAMPLE_ORDER);
    expect(first.kind).toBe('centre');
    expect(first.text).toBe('שלום');
  });
});
