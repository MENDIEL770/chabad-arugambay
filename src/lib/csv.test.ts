import { describe, expect, it } from 'vitest';
import { csvFilename, toCsv } from './csv';

describe('Excel compatibility', () => {
  /**
   * Without the BOM, Excel reads the file in the system codepage and every
   * Hebrew name opens as mojibake. This project has already lost Hebrew to
   * an encoding assumption once.
   */
  it('starts with a UTF-8 BOM', () => {
    expect(toCsv(['שם'], [['מנדי']]).charCodeAt(0)).toBe(0xfeff);
  });

  it('uses CRLF, which Excel on Windows needs to split rows', () => {
    const out = toCsv(['a', 'b'], [['1', '2']]);
    expect(out).toContain('a,b\r\n');
  });

  it('keeps Hebrew intact', () => {
    expect(toCsv(['שם'], [['ישראל ישראלי']])).toContain('ישראל ישראלי');
  });
});

describe('escaping', () => {
  it('quotes a value containing a comma', () => {
    expect(toCsv(['x'], [['a,b']])).toContain('"a,b"');
  });

  it('doubles an embedded quote', () => {
    expect(toCsv(['x'], [['say "hi"']])).toContain('"say ""hi"""');
  });

  it('quotes a value containing a newline', () => {
    expect(toCsv(['x'], [['line1\nline2']])).toContain('"line1\nline2"');
  });

  /**
   * A phone number is the realistic case: "+972…" in a bare cell is parsed
   * as a formula and shows as an error instead of a number.
   */
  it('neutralises a leading + so Excel does not treat it as a formula', () => {
    expect(toCsv(['phone'], [['+972501234567']])).toContain("'+972501234567");
  });

  it('neutralises the other formula triggers', () => {
    for (const ch of ['=', '-', '@']) {
      expect(toCsv(['x'], [[`${ch}CMD`]])).toContain(`'${ch}CMD`);
    }
  });

  it('renders null and undefined as empty, not as the words', () => {
    const out = toCsv(['a', 'b'], [[null, undefined]]);
    expect(out).toContain('\r\n,\r\n');
  });
});

describe('filenames', () => {
  it('keeps Hebrew and drops characters a filesystem rejects', () => {
    expect(csvFilename('שבת פרשת נח')).toBe('שבת-פרשת-נח.csv');
    expect(csvFilename('a/b\\c:d')).toBe('abcd.csv');
  });

  it('appends the date when given', () => {
    expect(csvFilename('שבת', '2026-10-10')).toBe('שבת-2026-10-10.csv');
  });
});
