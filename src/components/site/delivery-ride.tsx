'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * A scooter that rides across the restaurant band as the page scrolls.
 *
 * Travels right-to-left, the direction Hebrew reads, so it moves "forward"
 * rather than backwards. Progress is tied to the band's position in the
 * viewport rather than to time: scrolling up reverses it, which is what a
 * person expects from something anchored to their own movement.
 *
 * If a real photograph is preferred, drop a transparent PNG at
 * public/scooter.png and set `photo` — the motion is unchanged.
 */
export function DeliveryRide({ photo = false }: { photo?: boolean }) {
  const track = useRef<HTMLDivElement>(null);
  // Parked mid-track until the first measurement, which is also where
  // reduced-motion leaves it.
  const [progress, setProgress] = useState(0.5);

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    // Someone who asked for less motion keeps the parked starting position;
    // nothing is set during the effect, so there is no cascading render.
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let frame = 0;
    const measure = () => {
      frame = 0;
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      // 0 when the band's top reaches the bottom of the screen, 1 when its
      // bottom reaches the top: the whole ride happens while it is visible.
      const raw = (vh - r.top) / (vh + r.height);
      setProgress(Math.min(1, Math.max(0, raw)));
    };

    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  // Starts off-screen right, exits off-screen left.
  const x = 110 - progress * 130;
  const wheel = progress * 1440; // rolls rather than slides
  const bob = Math.sin(progress * Math.PI * 6) * 2;

  return (
    <div ref={track} className="relative mt-8 h-[92px] overflow-hidden" aria-hidden="true">
      {/* Road */}
      <div className="absolute inset-x-0 bottom-[18px] border-t-2 border-dashed border-line-strong" />

      <div
        className="absolute bottom-[10px]"
        style={{
          right: `${x}%`,
          transform: `translateY(${bob}px)`,
          // No CSS transition: the position already follows the scroll, and
          // easing it would make the scooter lag the finger.
        }}
      >
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src="/scooter.png" alt="" className="h-[72px] w-auto" />
        ) : (
          <Scooter wheelRotation={wheel} />
        )}
      </div>
    </div>
  );
}

/** Drawn in the same stroke language as the rest of the icons. */
function Scooter({ wheelRotation }: { wheelRotation: number }) {
  const spin = { transform: `rotate(${wheelRotation}deg)`, transformOrigin: 'center' };

  return (
    <svg
      width="118"
      height="72"
      viewBox="0 0 118 72"
      fill="none"
      className="text-accent-strong"
      role="presentation"
    >
      {/* Delivery box */}
      <rect x="74" y="12" width="30" height="24" rx="3"
            fill="currentColor" stroke="var(--fg)" strokeWidth="2" />
      <path d="M74 21h30" stroke="var(--fg)" strokeWidth="1.6" />
      <rect x="86" y="24" width="7" height="5" rx="1" fill="var(--bg)" />

      {/* Body */}
      <path
        d="M34 52c-2-10 2-18 10-20l16-3 8-13h9"
        stroke="var(--fg)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"
      />
      <path
        d="M60 29h20c5 0 8 4 8 9v14H60c-6 0-10-5-10-11s4-12 10-12Z"
        fill="currentColor" stroke="var(--fg)" strokeWidth="2.4" strokeLinejoin="round"
      />
      {/* Seat */}
      <path d="M58 30h22c2 0 3 1 3 3H58Z" fill="var(--fg)" />
      {/* Handlebar */}
      <path d="M72 16h12" stroke="var(--fg)" strokeWidth="2.6" strokeLinecap="round" />
      {/* Headlight */}
      <circle cx="33" cy="33" r="5" fill="currentColor" stroke="var(--fg)" strokeWidth="2" />

      {/* Wheels — the spokes are what make it read as rolling */}
      <g style={spin}>
        <circle cx="34" cy="56" r="12" fill="var(--bg)" stroke="var(--fg)" strokeWidth="2.6" />
        <path d="M34 46v20M24 56h20M27 49l14 14M41 49 27 63"
              stroke="var(--fg)" strokeWidth="1.4" />
      </g>
      <g style={spin}>
        <circle cx="92" cy="56" r="12" fill="var(--bg)" stroke="var(--fg)" strokeWidth="2.6" />
        <path d="M92 46v20M82 56h20M85 49l14 14M99 49 85 63"
              stroke="var(--fg)" strokeWidth="1.4" />
      </g>

      {/* Speed lines, trailing behind the direction of travel */}
      <path d="M108 30h9M110 38h7M106 46h11"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity=".5" />
    </svg>
  );
}
