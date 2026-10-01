import { NextResponse } from 'next/server';
import { requireRole, NotAuthorized } from '@/lib/auth';
import { getEventRegistrations } from '@/lib/data/registrations';
import { toCsv, csvFilename } from '@/lib/csv';

export const dynamic = 'force-dynamic';

/**
 * The registration list as a spreadsheet.
 *
 * A route handler rather than a server action because the browser has to
 * receive a file: an action returns a value to React, which cannot start a
 * download. This is also why the button is a plain link.
 *
 * One row per registration with the meals spread across columns, because
 * that is the shape someone actually works with — ticking names off at the
 * door, or filtering by meal to get a headcount.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireRole('staff');
  } catch (e) {
    if (e instanceof NotAuthorized) {
      return NextResponse.redirect(new URL('/admin/login', _req.url));
    }
    throw e;
  }

  const { id } = await params;
  const data = await getEventRegistrations(id);
  if (!data) return new NextResponse('לא נמצא', { status: 404 });

  // A column per meal, in the order they are served. Filling the grid from
  // the same tallies the screen uses is what keeps the two in agreement.
  const mealNames = data.meals.map((m) => m.mealName);

  const headers = [
    'קוד', 'שם מלא', 'טלפון', 'אימייל', 'מדינה',
    ...mealNames,
    'משתתפים', 'סה״כ ₪', 'תרומה ₪', 'שולם', 'הערות', 'נרשם בתאריך',
  ];

  const rows = data.rows.map((r) => {
    const perMeal = new Map<string, string[]>();
    for (const m of r.perMeal) {
      if (!m.qty) continue;
      const list = perMeal.get(m.mealName) ?? [];
      list.push(`${m.qty}× ${m.typeName}`);
      perMeal.set(m.mealName, list);
    }

    return [
      r.code,
      r.fullName,
      // Excel strips a leading zero from a number-looking cell and Sri
      // Lankan and Israeli numbers both start with one. toCsv's guard only
      // covers =+-@, so force text here.
      `‎${r.phone}`,
      r.email ?? '',
      r.nationality ?? '',
      ...mealNames.map((n) => (perMeal.get(n) ?? []).join(' + ')),
      r.participants.map((p) => p.name).join(' · '),
      r.totalIls,
      r.donationIls,
      r.paidAt ? 'כן' : 'לא',
      r.notes ?? '',
      new Date(r.createdAt).toLocaleString('he-IL', { timeZone: 'Asia/Colombo' }),
    ];
  });

  // A summary under the table, blank line between, so the headcount travels
  // with the file instead of having to be recomputed by whoever opens it.
  rows.push([]);
  rows.push(['סיכום']);
  for (const m of data.meals) {
    rows.push([
      m.mealName,
      `${m.seats} מקומות`,
      m.capacity ? `מתוך ${m.capacity}` : '',
      ...m.byType.map((t) => `${t.typeName}: ${t.seats}`),
    ]);
  }
  rows.push(['הרשמות', data.totals.registrations]);
  rows.push(['הכנסות ₪', data.totals.revenueIls]);
  rows.push(['תרומות ₪', data.totals.donationsIls]);
  rows.push(['טרם שולם', data.totals.unpaid]);

  const filename = csvFilename(data.title, data.startsOn);

  return new NextResponse(toCsv(headers, rows), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      // RFC 5987 so the Hebrew filename survives; the plain fallback is for
      // anything that does not understand it.
      'Content-Disposition':
        `attachment; filename="registrations-${data.startsOn}.csv"; ` +
        `filename*=UTF-8''${encodeURIComponent(filename)}`,
      'Cache-Control': 'no-store',
    },
  });
}
