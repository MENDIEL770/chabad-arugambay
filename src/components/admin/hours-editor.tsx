'use client';

import { useState, useTransition } from 'react';
import type { DayHours } from '@/lib/data/hours';
import { runAction } from '@/lib/run-action';
import { saveOpeningHours, type ActionResult } from '@/app/admin/settings/hours/actions';
import { DAY_NAMES } from '@/lib/days';

/**
 * Weekly opening hours.
 *
 * Shabbat and yom tov closing is NOT set here — it is computed from the
 * calendar and always wins, so a Friday row saying 21:30 still closes at
 * candle lighting. Saying so on screen prevents the obvious misreading.
 */
export function HoursEditor({ hours }: { hours: DayHours[] }) {
  const [rows, setRows] = useState(hours);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();

  const patch = (weekday: number, p: Partial<DayHours>) =>
    setRows((r) => r.map((d) => (d.weekday === weekday ? { ...d, ...p } : d)));

  /** Fill the rest of the week from the first open day. */
  const applyToAll = () => {
    const source = rows.find((r) => !r.isClosed) ?? rows[0];
    setRows((r) => r.map((d) => ({ ...d, opens: source.opens, closes: source.closes })));
  };

  return (
    <form
      className="flex flex-col gap-4"
      action={(fd) => start(async () => setResult(await runAction(() => saveOpeningHours(fd)) as ActionResult))}
    >
      <div className="overflow-hidden rounded-card border border-line bg-bg">
        {rows.map((d) => (
          <div
            key={d.weekday}
            className={`flex flex-wrap items-center gap-3 border-b border-line px-4 py-3 last:border-b-0 ${
              d.isClosed ? 'bg-surface' : ''
            }`}
          >
            <span className="w-16 shrink-0 font-medium">{DAY_NAMES[d.weekday]}</span>

            <label className="flex items-center gap-2">
              <span className="text-[.76rem] text-fg-subtle">פתיחה</span>
              <input
                type="time"
                name={`opens_${d.weekday}`}
                value={d.opens}
                disabled={d.isClosed}
                onChange={(e) => patch(d.weekday, { opens: e.target.value })}
                className="field clock !w-[7.5rem] !py-1.5 disabled:opacity-40"
              />
            </label>

            <label className="flex items-center gap-2">
              <span className="text-[.76rem] text-fg-subtle">סגירה</span>
              <input
                type="time"
                name={`closes_${d.weekday}`}
                value={d.closes}
                disabled={d.isClosed}
                onChange={(e) => patch(d.weekday, { closes: e.target.value })}
                className="field clock !w-[7.5rem] !py-1.5 disabled:opacity-40"
              />
            </label>

            <label className="ms-auto flex items-center gap-2 text-[.85rem]">
              <input
                type="checkbox"
                name={`closed_${d.weekday}`}
                checked={d.isClosed}
                onChange={(e) => patch(d.weekday, { isClosed: e.target.checked })}
                className="size-4 accent-[var(--accent)]"
              />
              סגור כל היום
            </label>
          </div>
        ))}
      </div>

      <p className="rounded-input bg-accent-soft px-4 py-3 text-[.84rem]">
        <b>שבת וחג נסגרים אוטומטית.</b> הזמנים האלה מחושבים מהלוח — מהדלקת
        נרות ועד חצי שעה אחרי הצאת — וגוברים על מה שמוגדר כאן. אין צורך
        לסמן את יום שישי כסגור.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="btn btn-accent" disabled={pending}>
          {pending ? 'שומר…' : 'שמירה'}
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={applyToAll}>
          החל על כל השבוע
        </button>
        {result?.message && (
          <span className={`text-[.84rem] ${result.ok ? 'text-ok' : 'text-danger'}`}>
            {result.message}
          </span>
        )}
      </div>
    </form>
  );
}
