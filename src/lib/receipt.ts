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

function centre(text: string, cols: number): string {
  const t = text.slice(0, cols);
  const pad = Math.max(0, Math.floor((cols - visualLength(t)) / 2));
  return ' '.repeat(pad) + t;
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
export function renderReceipt(t: ReceiptTemplate, d: ReceiptData): string[] {
  const cols = PAPER_COLS[t.paperWidth] ?? 48;
  const rule = '='.repeat(cols);
  const thin = '-'.repeat(cols);
  const out: string[] = [];

  for (const line of t.headerLines) out.push(centre(line, cols));
  out.push(rule);

  out.push(row(`#${d.code}`, d.placedAt, cols));
  out.push(
    row(
      d.fulfillment === 'dine_in'
        ? `TABLE ${d.tableNo ?? '?'}`
        : d.fulfillment === 'delivery'
          ? 'DELIVERY'
          : 'PICKUP',
      d.customerName,
      cols,
    ),
  );
  out.push(thin);

  for (const l of d.lines) {
    const label = `${l.qty} x ${l.name}`;
    out.push(t.showPrices ? row(label, money(l.lineTotal), cols) : label.slice(0, cols));
    // Exceptions are indented so they read as belonging to the line above.
    for (const c of l.changes) out.push(`   ${c}`.slice(0, cols));
    if (l.note) out.push(`   "${l.note}"`.slice(0, cols));
  }

  if (t.showPrices) {
    out.push(thin);
    out.push(row('Subtotal', money(d.subtotal), cols));
    if (d.deliveryFee > 0) out.push(row('Delivery', money(d.deliveryFee), cols));
    out.push(rule);
    out.push(row('TOTAL', money(d.total), cols));
    out.push(row('', d.payLabel, cols));
  }

  out.push(rule);
  for (const line of t.footerLines) out.push(centre(line, cols));

  return out;
}

/** Kitchen ticket: no money, bigger emphasis on what differs. */
export function renderKitchenTicket(t: ReceiptTemplate, d: ReceiptData): string[] {
  const cols = PAPER_COLS[t.paperWidth] ?? 48;
  const out: string[] = [];

  out.push(centre(`*** ${d.code} ***`, cols));
  out.push(
    centre(
      d.fulfillment === 'dine_in'
        ? `TABLE ${d.tableNo ?? '?'}`
        : d.fulfillment.toUpperCase(),
      cols,
    ),
  );
  out.push(centre(d.placedAt, cols));
  out.push('='.repeat(cols));

  for (const l of d.lines) {
    out.push(`${l.qty} x ${l.name}`.slice(0, cols));
    for (const c of l.changes) out.push(`   >> ${c}`.slice(0, cols));
    if (l.note) out.push(`   >> "${l.note}"`.slice(0, cols));
    out.push('');
  }

  if (t.kitchenShowPrices) {
    out.push('-'.repeat(cols));
    out.push(row('TOTAL', money(d.total), cols));
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
