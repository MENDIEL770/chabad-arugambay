'use client';

import { useEffect, useRef } from 'react';

/**
 * A drawn horizon behind the hero, not a photograph.
 *
 * Deliberate: there is no real photo of the house yet, and stock imagery of
 * "a beach" would read as exactly that. This is quiet enough to sit under
 * text and repaints with the theme.
 */
export function HeroSky() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;

    const paint = () => {
      const r = cv.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      cv.width = r.width * dpr;
      cv.height = r.height * dpr;
      const x = cv.getContext('2d');
      if (!x) return;
      x.scale(dpr, dpr);

      const explicit = document.documentElement.dataset.theme;
      const dark =
        explicit === 'dark' ||
        (!explicit && matchMedia('(prefers-color-scheme: dark)').matches);

      const g = x.createLinearGradient(0, 0, 0, r.height);
      if (dark) {
        g.addColorStop(0, '#17161a');
        g.addColorStop(0.62, '#2a2230');
        g.addColorStop(1, '#4a3520');
      } else {
        g.addColorStop(0, '#ffffff');
        g.addColorStop(0.55, '#fff8ec');
        g.addColorStop(1, '#ffe6bd');
      }
      x.fillStyle = g;
      x.fillRect(0, 0, r.width, r.height);

      // Sun sits toward the start of the line — the page is RTL, so left.
      const cx = r.width * 0.18;
      const cy = r.height * 0.72;
      const rad = Math.min(r.width, r.height) * 0.3;
      const s = x.createRadialGradient(cx, cy, 0, cx, cy, rad);
      s.addColorStop(0, dark ? 'rgba(253,185,64,.30)' : 'rgba(253,185,64,.52)');
      s.addColorStop(1, 'rgba(253,185,64,0)');
      x.fillStyle = s;
      x.beginPath();
      x.arc(cx, cy, rad, 0, Math.PI * 2);
      x.fill();
    };

    paint();
    const ro = new ResizeObserver(paint);
    ro.observe(cv);
    const mq = matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', paint);
    // The toggle stamps data-theme on <html>; repaint when it changes.
    const mo = new MutationObserver(paint);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    return () => {
      ro.disconnect();
      mo.disconnect();
      mq.removeEventListener('change', paint);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      className="hero-sky absolute inset-0 size-full"
    />
  );
}
