'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Fade-and-rise as the element enters the viewport.
 *
 * The hidden state is expressed in CSS, not set from an effect, so there is
 * no cascading render and no flash of content that then hides itself. Two
 * escape hatches live in globals.css rather than here:
 *
 *   - prefers-reduced-motion shows everything immediately
 *   - <noscript> shows everything, so the page is readable without JS
 *
 * The only state change is in response to the observer firing, which is an
 * external event rather than something happening during the effect itself.
 */
export function Reveal({
  children,
  delay = 0,
  className = '',
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // No observer means nothing will ever reveal it. Write the attribute
    // straight to the DOM rather than through state: synchronising an
    // external system is what an effect is for, and routing it through a
    // render would be a cascading update for no benefit.
    if (typeof IntersectionObserver === 'undefined') {
      el.dataset.reveal = 'in';
      return;
    }

    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setShown(true);
        io.disconnect(); // one-way: it must not fade out again on scroll up
      },
      { rootMargin: '0px 0px -12% 0px', threshold: 0.1 },
    );

    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      data-reveal={shown ? 'in' : 'out'}
      className={className}
      style={{ transitionDelay: shown ? `${delay}ms` : '0ms' }}
    >
      {children}
    </div>
  );
}
