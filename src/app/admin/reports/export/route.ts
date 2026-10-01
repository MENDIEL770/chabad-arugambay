import { NextResponse } from 'next/server';
import { NotAuthorized, requireRole } from '@/lib/auth';
import { getReport, CHANNEL_LABEL, FULFILLMENT_LABEL, PAYMENT_LABEL } from '@/lib/data/reports';
import { toCsv, csvFilename } from '@/lib/csv';

export const dynamic = 'force-dynamic';

/**
 * The whole report as one spreadsheet.
 *
 * Several tables stacked in one file with blank lines between, rather than
 * one sheet per section: a CSV has no sheets, and splitting it into four
 * downloads is worse than scrolling.
 */
export async function GET(req: Request) {
  try {
    await requireRole('staff');
  } catch (e) {
    if (e instanceof NotAuthorized) {
      return NextResponse.redirect(new URL('/admin/login', req.url));
    }
    throw e;
  }

  const url = new URL(req.url);
  const from = url.searchParams.get('from') ?? '';
  const to = url.searchParams.get('to') ?? '';

  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return new NextResponse('טווח תאריכים לא תקין', { status: 400 });
  }

  const r = await getReport(from, to);
  if (r.unavailable) {
    return new NextResponse('הדוחות עוד לא מותקנים — הריצו 0021_reports.sql', { status: 503 });
  }

  const rows: unknown[][] = [];

  rows.push(['סיכום', `${from} עד ${to}`]);
  rows.push(['הכנסות LKR', r.summary.revenueLkr]);
  rows.push(['הזמנות', r.summary.orders]);
  rows.push(['ממוצע להזמנה LKR', r.summary.avgOrderLkr]);
  rows.push(['מנות שנמכרו', r.summary.itemsSold]);
  rows.push(['דמי משלוח LKR', r.summary.deliveryLkr]);
  rows.push(['טרם שולם LKR', r.summary.unpaidLkr]);
  rows.push(['בוטלו או נדחו', r.summary.cancelled]);

  rows.push([]);
  rows.push(['לפי יום', 'הזמנות', 'הכנסה LKR']);
  for (const d of r.byDay) rows.push([d.day, d.orders, d.revenueLkr]);

  rows.push([]);
  rows.push(['מנה', 'כמות', 'הזמנות', 'הכנסה LKR']);
  for (const d of r.byDish) rows.push([d.dish, d.qty, d.orders, d.revenueLkr]);

  const labels: Record<string, Record<string, string>> = {
    fulfillment: FULFILLMENT_LABEL,
    payment: PAYMENT_LABEL,
    channel: CHANNEL_LABEL,
  };
  const kindTitle: Record<string, string> = {
    fulfillment: 'איך קיבלו',
    payment: 'איך שילמו',
    channel: 'מאיפה הגיעה',
  };

  for (const kind of ['fulfillment', 'payment', 'channel']) {
    const block = r.splits.filter((s) => s.kind === kind);
    if (!block.length) continue;
    rows.push([]);
    rows.push([kindTitle[kind], 'הזמנות', 'הכנסה LKR']);
    for (const s of block) {
      rows.push([labels[kind][s.label] ?? s.label, s.orders, s.revenueLkr]);
    }
  }

  rows.push([]);
  rows.push(['שעה', 'הזמנות', 'הכנסה LKR']);
  for (const h of r.byHour.filter((x) => x.orders > 0)) {
    rows.push([`${String(h.hour).padStart(2, '0')}:00`, h.orders, h.revenueLkr]);
  }

  const name = csvFilename('דוח מכירות', `${from}_${to}`);

  return new NextResponse(toCsv([], rows).replace(/^﻿\r\n/, '﻿'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition':
        `attachment; filename="report-${from}_${to}.csv"; ` +
        `filename*=UTF-8''${encodeURIComponent(name)}`,
      'Cache-Control': 'no-store',
    },
  });
}
