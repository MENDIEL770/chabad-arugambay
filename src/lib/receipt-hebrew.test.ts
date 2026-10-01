import { describe, expect, it } from 'vitest';
import { DEFAULT_TEMPLATE, PAPER_COLS, SAMPLE_ORDER, renderReceipt } from './receipt';

/**
 * Hebrew on the receipt.
 *
 * The preview used to be one <pre dir="ltr">, which reverses Hebrew. These
 * cover the contract the new structured output has to keep so that a
 * Hebrew header reads correctly beside an English one.
 */
describe('Hebrew header and footer', () => {
  const t = {
    ...DEFAULT_TEMPLATE,
    headerLines: ['בית חב״ד ארוגם ביי', 'Main Street, Arugam Bay'],
    footerLines: ['תודה ובתיאבון!'],
  };
  const lines = renderReceipt(t, SAMPLE_ORDER);

  it('keeps Hebrew exactly as written, with no padding to misplace', () => {
    expect(lines[0].text).toBe('בית חב״ד ארוגם ביי');
    expect(lines[0].kind).toBe('centre');
  });

  it('marks Hebrew lines for raster printing and leaves Latin as text', () => {
    expect(lines[0].hasHebrew).toBe(true);
    expect(lines[1].hasHebrew).toBe(false);
  });

  it('carries the Hebrew footer through', () => {
    const footer = lines[lines.length - 1];
    expect(footer.text).toBe('תודה ובתיאבון!');
    expect(footer.hasHebrew).toBe(true);
  });

  /**
   * The money grid must survive regardless of what the header says — this
   * is what would break if centring were ever done by padding again.
   */
  it('leaves the money columns aligned to the paper edge', () => {
    const total = lines.find((l) => l.text.startsWith('TOTAL'))!;
    expect(total.kind).toBe('row');
    expect(total.text.length).toBe(PAPER_COLS[80]);
  });

  it('never marks a grid row as Hebrew, so columns are never rastered', () => {
    for (const l of lines.filter((x) => x.kind === 'row')) {
      expect(l.hasHebrew, l.text).toBe(false);
    }
  });
});
