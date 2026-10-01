/**
 * Receipt layout, shared by the admin preview and the print renderer.
 *
 * A thermal printer lays out in fixed-width columns, not pixels: 80mm paper
 * fits 48 monospace characters, 58mm fits 32. Everything here works in
 * characters so the preview on screen is the same shape as the paper.
 */
export const PAPER_COLS: Record<number, number> = { 80: 48, 58: 32 };

export interface ReceiptTemplate {
  headerLines: string[];
  footerLines: string[];
  logoUrl?: string | null;
  headerImageUrl?: string | null;
  footerImageUrl?: string | null;
  showLogo: boolean;
  showQr: boolean;
  showPrices: boolean;
  kitchenShowPrices: boolean;
  paperWidth: number;
}

export const DEFAULT_TEMPLATE: ReceiptTemplate = {
  logoUrl: null,
  headerImageUrl: null,
  footerImageUrl: null,
  headerLines: ['בית חב״ד ארוגם ביי', 'Main Street, Arugam Bay', 'Kosher under Chabad supervision'],
  footerLines: ['תודה ובתיאבון!', 'Thank you — see you again'],
  showLogo: true,
  showQr: true,
  showPrices: true,
  kitchenShowPrices: false,
  paperWidth: 80,
};

export interface ReceiptLine {
  name: string;
  qty: number;
  unit: number;
  lineTotal: number;
  changes: string[];
  note?: string | null;
}

export interface ReceiptData {
  code: string;
  placedAt: string;
  fulfillment: string;
  customerName: string;
  tableNo?: string | null;
  lines: ReceiptLine[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  payLabel: string;
  trackUrl?: string | null;
}

/**
 * How a line is laid out.
 *
 * A two-column money row has to keep its character grid, so it stays
 * left-to-right and is padded with spaces. A centred line is prose that may
 * be Hebrew, so it carries no padding and the direction is decided from its
 * own content — padding it would place the spaces on the wrong side once
 * the browser reorders it.
 *
 * The printer consumes the same list. A line containing Hebrew has to be
 * drawn as a raster image, because thermal printers have no Hebrew font;
 * `hasHebrew` is what tells the print path which ones.
 */
export type LineKind = 'centre' | 'row' | 'plain' | 'rule';

export interface RenderedLine {
  text: string;
  kind: LineKind;
  hasHebrew: boolean;
}

const HEBREW_RE = /[\u0590-\u05FF]/;

function mk(text: string, kind: LineKind): RenderedLine {
  return { text, kind, hasHebrew: HEBREW_RE.test(text) };
}

/**
 * Hebrew and Latin both occupy one cell on a thermal printer, so a plain
 * length is right — but only after stripping the bidi marks a copy-paste
 * can leave behind, which would otherwise push the column out by one.
 */
function visualLength(s: string): number {
  return s.replace(/[‎‏‪-‮]/g, '').length;
}

/** `left ....... right`, filling the gap so columns line up on paper. */
function row(left: string, right: string, cols: number): string {
  const r = right.slice(0, cols);
  const space = cols - visualLength(r);
  const l = left.slice(0, Math.max(0, space - 1));
  return l + ' '.repeat(Math.max(1, space - visualLength(l))) + r;
}

const money = (n: number) => `${n.toLocaleString('en-US')} LKR`;

/**
 * Render the customer receipt as plain character rows.
 *
 * Returned as an array so the preview and the printer consume exactly the
 * same thing; the only difference downstream is whether it is drawn to a
 * canvas or sent as ESC/POS.
 */
export function renderReceipt(t: ReceiptTemplate, d: ReceiptData): RenderedLine[] {
  const cols = PAPER_COLS[t.paperWidth] ?? 48;
  const rule = '='.repeat(cols);
  const thin = '-'.repeat(cols);
  const out: RenderedLine[] = [];

  // Centred prose is not padded — see RenderedLine.
  for (const line of t.headerLines) out.push(mk(line, 'centre'));
  out.push(mk(rule, 'rule'));

  out.push(mk(row(`#${d.code}`, d.placedAt, cols), 'row'));
  out.push(
    mk(
      row(
        d.fulfillment === 'dine_in'
          ? `TABLE ${d.tableNo ?? '?'}`
          : d.fulfillment === 'delivery'
            ? 'DELIVERY'
            : 'PICKUP',
        d.customerName,
        cols,
      ),
      'row',
    ),
  );
  out.push(mk(thin, 'rule'));

  for (const l of d.lines) {
    const label = `${l.qty} x ${l.name}`;
    out.push(
      t.showPrices
        ? mk(row(label, money(l.lineTotal), cols), 'row')
        : mk(label.slice(0, cols), 'plain'),
    );
    // Exceptions are indented so they read as belonging to the line above.
    for (const c of l.changes) out.push(mk(`   ${c}`.slice(0, cols), 'plain'));
    if (l.note) out.push(mk(`   "${l.note}"`.slice(0, cols), 'plain'));
  }

  if (t.showPrices) {
    out.push(mk(thin, 'rule'));
    out.push(mk(row('Subtotal', money(d.subtotal), cols), 'row'));
    if (d.deliveryFee > 0) out.push(mk(row('Delivery', money(d.deliveryFee), cols), 'row'));
    out.push(mk(rule, 'rule'));
    out.push(mk(row('TOTAL', money(d.total), cols), 'row'));
    out.push(mk(row('', d.payLabel, cols), 'row'));
  }

  out.push(mk(rule, 'rule'));
  for (const line of t.footerLines) out.push(mk(line, 'centre'));

  return out;
}

/** Kitchen ticket: no money, bigger emphasis on what differs. */
export function renderKitchenTicket(t: ReceiptTemplate, d: ReceiptData): RenderedLine[] {
  const cols = PAPER_COLS[t.paperWidth] ?? 48;
  const out: RenderedLine[] = [];

  out.push(mk(`*** ${d.code} ***`, 'centre'));
  out.push(
    mk(
      d.fulfillment === 'dine_in' ? `TABLE ${d.tableNo ?? '?'}` : d.fulfillment.toUpperCase(),
      'centre',
    ),
  );
  out.push(mk(d.placedAt, 'centre'));
  out.push(mk('='.repeat(cols), 'rule'));

  for (const l of d.lines) {
    out.push(mk(`${l.qty} x ${l.name}`.slice(0, cols), 'plain'));
    for (const c of l.changes) out.push(mk(`   >> ${c}`.slice(0, cols), 'plain'));
    if (l.note) out.push(mk(`   >> "${l.note}"`.slice(0, cols), 'plain'));
    out.push(mk('', 'plain'));
  }

  if (t.kitchenShowPrices) {
    out.push(mk('-'.repeat(cols), 'rule'));
    out.push(mk(row('TOTAL', money(d.total), cols), 'row'));
  }

  return out;
}

/** A believable order for the designer preview. */
export const SAMPLE_ORDER: ReceiptData = {
  code: 'A-042',
  placedAt: '01/10 19:42',
  fulfillment: 'delivery',
  customerName: 'Mendi',
  lines: [
    {
      name: 'Shawarma in laffa',
      qty: 2,
      unit: 3900,
      lineTotal: 7800,
      changes: ['NO ONION', 'TAHINI ON SIDE'],
      note: null,
    },
    { name: 'Falafel in pita', qty: 1, unit: 1800, lineTotal: 1800, changes: ['+ EGG'], note: 'extra spicy' },
    { name: 'Mint lemonade', qty: 2, unit: 900, lineTotal: 1800, changes: [], note: null },
  ],
  subtotal: 11400,
  deliveryFee: 500,
  total: 11900,
  payLabel: 'CASH TO DRIVER',
  trackUrl: 'https://chabad-arugambay.vercel.app/order/…',
};
