'use client';

import { useEffect, useState } from 'react';

export interface Closure { from: string; to: string; why: string }

const OPEN_MIN = 11 * 60;
const CLOSE_MIN = 21 * 60 + 30;

function decide(now: Date, closures: Closure[]) {
  for (const c of closures) {
    const from = new Date(c.from);
    const to = new Date(c.to);
    if (now >= from && now < to) return { open: false, label: `סגור · ${c.why}` };
    if (now < from && from.getTime() - now.getTime() < 6 * 3600_000) {
      const hh = String(from.getHours()).padStart(2, '0');
      const mm = String(from.getMinutes()).padStart(2, '0');
      return { open: true, label: `נסגר היום ב-${hh}:${mm}` };
    }
  }
  const mins = now.getHours() * 60 + now.getMinutes();
  if (mins < OPEN_MIN) return { open: false, label: 'נפתח ב-11:00' };
  if (mins >= CLOSE_MIN) return { open: false, label: 'סגור · נפתח מחר ב-11:00' };
  return { open: true, label: 'פתוח · הזמנות עד 21:30' };
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
}: {
  initialOpen: boolean;
  initialLabel: string;
  closures: Closure[];
}) {
  const [state, setState] = useState({ open: initialOpen, label: initialLabel });

  useEffect(() => {
    const tick = () => setState(decide(new Date(), closures));
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [closures]);

  return (
    <span
      className="inline-flex items-center gap-2 rounded-pill border border-line bg-surface px-3 py-1.5 text-xs font-medium"
      aria-live="polite"
    >
      <span
        className={`size-[7px] shrink-0 rounded-full ${state.open ? 'bg-ok' : 'bg-danger'}`}
        aria-hidden="true"
      />
      {state.label}
    </span>
  );
}
