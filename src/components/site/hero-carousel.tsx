'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { HERO_INTERVAL_SECONDS, type HeroSlide } from '@/lib/data/hero-spec';

/**
 * Rotating background for the hero, with the page's own copy as the default.
 *
 * A slide may carry its own headline. While that slide is showing, its text
 * replaces the default — so a photo of the sukkah can say something about
 * the sukkah instead of repeating the week's parsha. Slides without text
 * leave the default alone rather than blanking the hero.
 */
export function HeroCarousel({
  slides,
  children,
}: {
  slides: HeroSlide[];
  /** Default hero copy, shown whenever the active slide carries none. */
  children: React.ReactNode;
}) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (slides.length < 2 || paused) return;
    // Someone who asked for less motion gets the first slide and no cycling.
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    timer.current = setInterval(
      () => setIndex((i) => (i + 1) % slides.length),
      HERO_INTERVAL_SECONDS * 1000,
    );
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [slides.length, paused]);

  const active = slides[index];
  const override = active?.headline?.he ? active : null;

  return (
    <section
      className="relative isolate overflow-hidden border-b border-line"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {slides.map((s, i) => (
        <div
          key={s.id}
          aria-hidden={i !== index}
          className="pointer-events-none absolute inset-0 -z-10 transition-opacity duration-1000 ease-in-out"
          style={{ opacity: i === index ? 1 : 0 }}
        >
          <Image
            src={s.imageUrl}
            alt=""
            fill
            // The first slide is the largest paint on the page.
            priority={i === 0}
            sizes="100vw"
            className="object-cover"
            style={{ objectPosition: `${s.focalX}% ${s.focalY}%` }}
          />
          {/* Scrim, per slide: a bright midday shot needs more than a dusk one. */}
          <div
            className="absolute inset-0 bg-ink-panel"
            style={{ opacity: s.overlay / 100 }}
          />
        </div>
      ))}

      <div className="wrap relative py-24 max-[900px]:py-16">
        {override ? (
          <div className="max-w-[46ch] text-white drop-shadow-[0_2px_18px_rgb(0_0_0/.45)]">
            <h1 className="text-balance text-[clamp(2.3rem,5.1vw,3.7rem)] font-bold leading-[1.1] tracking-[-.02em]">
              {override.headline!.he}
            </h1>
            {override.subhead?.he && (
              <p className="mt-4 text-[1.1rem] text-white/85">{override.subhead.he}</p>
            )}
            {override.ctaHref && override.ctaLabel?.he && (
              <Link href={override.ctaHref} className="btn btn-accent btn-lg mt-7">
                {override.ctaLabel.he}
              </Link>
            )}
          </div>
        ) : (
          children
        )}

        {slides.length > 1 && (
          <div
            className="mt-9 flex gap-2"
            role="tablist"
            aria-label="תמונות רקע"
          >
            {slides.map((s, i) => (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={i === index}
                aria-label={`תמונה ${i + 1} מתוך ${slides.length}`}
                onClick={() => setIndex(i)}
                className={`h-1.5 rounded-pill transition-all ${
                  i === index ? 'w-7 bg-accent' : 'w-3 bg-fg/25 hover:bg-fg/45'
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
