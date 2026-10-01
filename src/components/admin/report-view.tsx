'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Icon } from '@/components/ui/icon';
import {
  CHANNEL_LABEL, FULFILLMENT_LABEL, PAYMENT_LABEL, type Report, type Preset,
} from '@/lib/data/reports-view';

const PRESETS: { key: Preset; label: string }[] = [
  { key: 'today', label: 'היום' },
  { key: 'week', label: 'השבוע' },
  { key: 'month', label: 'החודש' },
  { key: 'quarter', label: '3 חודשים' },
  { key: 'year', label: 'השנה' },
  { key: 'custom', label: 'טווח אחר' },
];

const lkr = (n: number) => `LKR ${n.toLocaleString('en-US')}`;

function Bars({ rows }: { rows: { label: string; value: number; sub?: string }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="flex flex-col gap-1.5">
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-2 text-[.8rem]">
          <span className="w-16 shrink-0 text-fg-muted">{r.label}</span>
          <div className="h-5 flex-1 overflow-hidden rounded-[4px] bg-line/40">
            <div
              className="h-full rounded-[4px] bg-accent"
              style={{ width: `${Math.round((r.value / max) * 100)}%` }}
            />
          </div>
          <span className="clock w-24 shrink-0 text-end">{r.sub ?? r.value}</span>
        </div>
      ))}
    </div>
  );
}

export function ReportView({ report, preset }: { report: Report; preset: Preset }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function go(next: Partial<{ preset: string; from: string; to: string }>) {
    const q = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v) q.set(k, v); else q.delete(k);
    }
    router.push(`${pathname}?${q.toString()}`);
  }

  const { summary: s } = report;

  const fulfillment = report.splits.filter((x) => x.kind === 'fulfillment');
  const payment = report.splits.filter((x) => x.kind === 'payment');
  const channel = report.splits.filter((x) => x.kind === 'channel');

  // A short date for the chart; the full ISO string is hard to scan.
  const dayLabel = (iso: string) =>
    new Date(iso).toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' });

  if (report.unavailable) {
    return (
      <div className="card">
        <p className="font-medium">הדוחות עוד לא מותקנים.</p>
        <p className="mt-1 text-[.85rem] text-fg-muted">
          הריצו את <code className="ltr">0021_reports.sql</code> ב-SQL Editor
          ורעננו את העמוד.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              type="button"
              className={`btn btn-sm ${preset === p.key ? 'btn-accent' : 'btn-ghost'}`}
              onClick={() => go({ preset: p.key, from: '', to: '' })}
            >
              {p.label}
            </button>
          ))}
        </div>

        <a
          href={`/admin/reports/export?from=${report.from}&to=${report.to}`}
          className="btn btn-ghost btn-sm"
        >
          <Icon name="arrow" size={15} />
          ייצוא לאקסל
        </a>
      </div>

      {preset === 'custom' && (
        <div className="card flex flex-wrap items-end gap-3 !py-3">
          <label>
            <span className="label !mb-1">מתאריך</span>
            <input
              className="field" type="date" defaultValue={report.from}
              onChange={(e) => go({ preset: 'custom', from: e.target.value, to: report.to })}
            />
          </label>
          <label>
            <span className="label !mb-1">עד תאריך</span>
            <input
              className="field" type="date" defaultValue={report.to}
              onChange={(e) => go({ preset: 'custom', from: report.from, to: e.target.value })}
            />
          </label>
        </div>
      )}

      <div className="grid grid-cols-4 gap-3 max-[900px]:grid-cols-2">
        {[
          { label: 'הכנסות', value: lkr(s.revenueLkr) },
          { label: 'הזמנות', value: String(s.orders) },
          { label: 'ממוצע להזמנה', value: lkr(s.avgOrderLkr) },
          { label: 'מנות שנמכרו', value: String(s.itemsSold) },
        ].map((k) => (
          <div key={k.label} className="card !p-4">
            <p className="eyebrow">{k.label}</p>
            <p className="clock mt-1.5 text-[1.5rem] font-bold leading-none">{k.value}</p>
          </div>
        ))}
      </div>

      {(s.unpaidLkr > 0 || s.cancelled > 0) && (
        <div className="flex flex-wrap gap-3 text-[.84rem]">
          {s.unpaidLkr > 0 && (
            <span className="chip chip-out">
              טרם שולם: <b className="clock">{lkr(s.unpaidLkr)}</b>
            </span>
          )}
          {s.cancelled > 0 && (
            <span className="chip">
              בוטלו או נדחו: <b className="clock">{s.cancelled}</b>
              <span className="text-fg-subtle"> — לא נספרים בהכנסות</span>
            </span>
          )}
        </div>
      )}

      {report.byDay.length > 1 && (
        <section className="card">
          <h2 className="mb-3 font-bold">לפי יום</h2>
          <Bars
            rows={report.byDay.map((d) => ({
              label: dayLabel(d.day),
              value: d.revenueLkr,
              sub: d.orders ? lkr(d.revenueLkr) : '—',
            }))}
          />
        </section>
      )}

      <section className="card">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className="font-bold">מה נמכר</h2>
          <span className="text-[.78rem] text-fg-subtle">לפי הכנסה</span>
        </div>
        {report.byDish.length === 0 ? (
          <p className="text-sm text-fg-muted">אין מכירות בטווח הזה.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-line text-[.78rem] text-fg-subtle">
                  <th className="p-2 text-start font-medium">מנה</th>
                  <th className="p-2 text-start font-medium">כמות</th>
                  <th className="p-2 text-start font-medium">הזמנות</th>
                  <th className="p-2 text-start font-medium">הכנסה</th>
                </tr>
              </thead>
              <tbody>
                {report.byDish.map((d) => (
                  <tr key={d.dish} className="border-b border-line last:border-b-0">
                    <td className="p-2 font-medium">{d.dish}</td>
                    <td className="clock p-2">{d.qty}</td>
                    <td className="clock p-2 text-fg-muted">{d.orders}</td>
                    <td className="clock p-2 font-medium">{lkr(d.revenueLkr)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="grid grid-cols-2 gap-4 max-[900px]:grid-cols-1">
        {[
          { title: 'איך קיבלו את ההזמנה', rows: fulfillment, labels: FULFILLMENT_LABEL },
          { title: 'איך שילמו', rows: payment, labels: PAYMENT_LABEL },
          { title: 'מאיפה הגיעה ההזמנה', rows: channel, labels: CHANNEL_LABEL },
        ].map((block) => (
          <section key={block.title} className="card">
            <h2 className="mb-3 font-bold">{block.title}</h2>
            {block.rows.length === 0 ? (
              <p className="text-sm text-fg-muted">אין נתונים.</p>
            ) : (
              <Bars
                rows={block.rows.map((r) => ({
                  label: block.labels[r.label] ?? r.label,
                  value: r.revenueLkr,
                  sub: `${r.orders} · ${lkr(r.revenueLkr)}`,
                }))}
              />
            )}
          </section>
        ))}

        <section className="card">
          <h2 className="mb-1 font-bold">שעות עומס</h2>
          <p className="mb-3 text-[.78rem] text-fg-subtle">
            מתי ההזמנות נכנסות — שימושי לשיבוץ.
          </p>
          {report.byHour.every((h) => h.orders === 0) ? (
            <p className="text-sm text-fg-muted">אין נתונים.</p>
          ) : (
            <Bars
              rows={report.byHour
                .filter((h) => h.orders > 0)
                .map((h) => ({
                  label: `${String(h.hour).padStart(2, '0')}:00`,
                  value: h.orders,
                  sub: `${h.orders} הזמנות`,
                }))}
            />
          )}
        </section>
      </div>

      <p className="text-[.78rem] text-fg-subtle">
        הטווח: <span className="clock">{report.from}</span> עד{' '}
        <span className="clock">{report.to}</span>. הזמנות שבוטלו או נדחו אינן
        נספרות בהכנסות. התאריכים לפי שעון סרי לנקה.{' '}
        <Link href="/admin/orders" className="underline">לוח ההזמנות</Link>
      </p>
    </div>
  );
}
