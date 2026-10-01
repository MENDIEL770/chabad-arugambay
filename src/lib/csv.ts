/**
 * CSV that Excel opens correctly, including Hebrew.
 *
 * Two things break this in practice and both are handled here:
 *
 *  1. Excel assumes the system codepage unless the file starts with a UTF-8
 *     byte-order mark. Without it, every Hebrew name opens as mojibake —
 *     the same class of failure that already corrupted this project's
 *     database once.
 *  2. Excel on Windows needs CRLF line endings to split rows reliably.
 */
const BOM = '﻿';

function cell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  // A leading =, + or - makes Excel treat the cell as a formula. A name
  // beginning with one is unlikely but a phone number starting with + is
  // not, and "+972…" silently becomes a broken formula.
  const guarded = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return /[",\r\n]/.test(guarded) ? `"${guarded.replace(/"/g, '""')}"` : guarded;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.map(cell).join(','), ...rows.map((r) => r.map(cell).join(','))];
  return BOM + lines.join('\r\n') + '\r\n';
}

/** A filename that survives being saved on any of the three platforms. */
export function csvFilename(base: string, date?: string): string {
  const safe = base.replace(/[^\p{L}\p{N}\-_ ]/gu, '').trim().replace(/\s+/g, '-');
  return `${safe}${date ? `-${date}` : ''}.csv`;
}
