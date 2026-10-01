'use client';

import { useEffect, useState } from 'react';

export interface Closure { from: string; to: string; why: string }

export interface DayWindow {
  weekday: number;
  opens: string;
  closes: string;
  isClosed: boolean;
}

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

function decide(now: Date, closures: Closure[], week: DayWindow[]) {
  for (const c of closures) {
    const from = new Date(c.from);
    const to = new Date(c.to);
    if (now >= from && now < to) {
      return { open: false, label: `סגור · ${c.why}`, short: 'סגור' };
    }
    if (now < from && from.getTime() - now.getTime() < 6 * 3600_000) {
      const hh = String(from.getHours()).padStart(2, '0');
      const mm = String(from.getMinutes()).padStart(2, '0');
      return { open: true, label: `נסגר היום ב-${hh}:${mm}`, short: `עד ${hh}:${mm}` };
    }
  }
  const mins = now.getHours() * 60 + now.getMinutes();
  // getDay() is already 0 for Sunday, matching the table.
  const today = week.find((d) => d.weekday === now.getDay());
  if (!today) return { open: true, label: 'פתוח', short: 'פתוח' };

  if (today.isClosed) return { open: false, label: 'סגור היום', short: 'סגור' };
  if (mins < toMinutes(today.opens)) {
    return { open: false, label: `נפתח ב-${today.opens}`, short: 'סגור' };
  }
  if (mins >= toMinutes(today.closes)) {
    return { open: false, label: 'סגור · נפתח מחר', short: 'סגור' };
  }
  return { open: true, label: `פתוח · הזמנות עד ${today.closes}`, short: 'פתוח' };
}

/**
 * Live open/closed indicator.
 *
 * Rendered on the server first with the value computed there, so it is correct
 * in the HTML and for crawlers, then kept current in the browser. The initial
 * props are used verbatim on the first client render to avoid a hydration
 * mismatch; only the interval that follows recomputes.
 */
export function StatusPill({
  initialOpen,
  initialLabel,
  closures,
  week,
}: {
  initialOpen: boolean;
  initialLabel: string;
  closures: Closure[];
  week: DayWindow[];
}) {
  const [state, setState] = useState({
    open: initialOpen,
    label: initialLabel,
    short: initialOpen ? 'פתוח' : 'סגור',
  });

  useEffect(() => {
    const tick = () => setState(decide(new Date(), closures, week));
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [closures, week]);

  return (
    <span
      className="inline-flex items-center gap-2 rounded-pill border border-line bg-surface px-3 py-1.5 text-xs font-medium"
      aria-live="polite"
    >
      <span
        className={`size-[7px] shrink-0 rounded-full ${state.open ? 'bg-ok' : 'bg-danger'}`}
        aria-hidden="true"
      />
      {/* The full sentence wrapped onto three lines in the bar on a phone.
          The dot already carries open/closed; the words are detail. */}
      <span className="max-[760px]:hidden">{state.label}</span>
      <span className="min-[760px]:hidden">{state.short}</span>
    </span>
  );
}
