'use client';

import { useEffect, useState } from 'react';
import { LogoMark } from './logo';

/**
 * Covers the screen while a submission is in flight.
 *
 * Registration takes a couple of seconds — long enough that without this a
 * person presses the button, sees nothing change, and presses it again.
 * The overlay both reassures and blocks the second press.
 *
 * The reassuring line only appears after a moment: showing "this can take
 * a few seconds" instantly makes a fast response feel slow.
 */
export function SubmittingOverlay({
  show,
  label = 'שולח…',
  patience = 'עוד רגע — שומרים את הפרטים.',
}: {
  show: boolean;
  label?: string;
  patience?: string;
}) {
  if (!show) return null;
  return <Overlay label={label} patience={patience} />;
}

/**
 * Split out so the timer lives in a component that only exists while the
 * submission does. Resetting the flag on hide would mean setting state
 * inside an effect, and the delay is only meaningful while visible anyway.
 */
function Overlay({ label, patience }: { label: string; patience: string }) {
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setSlow(true), 1200);
    return () => clearTimeout(id);
  }, []);

  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center gap-4 bg-bg/92 backdrop-blur-sm"
      role="status"
      aria-live="polite"
    >
      <LogoMark size={76} animated />
      <p className="text-[1.05rem] font-medium">{label}</p>
      <p
        className={`max-w-[26ch] text-center text-[.85rem] text-fg-subtle transition-opacity duration-500 ${
          slow ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {patience}
      </p>
    </div>
  );
}
