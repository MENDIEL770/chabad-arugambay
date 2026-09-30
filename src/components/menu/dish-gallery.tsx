'use client';

import Image from 'next/image';
import { useState } from 'react';
import type { DishImage } from '@/lib/data/types';
import { Icon } from '@/components/ui/icon';

/**
 * The photos of one dish, swipeable.
 *
 * People order food with their eyes. A 68px thumbnail told them nothing, so
 * the card now leads with a real photo and tapping it opens the rest.
 */
export function DishGallery({
  images,
  alt,
  className = '',
}: {
  images: DishImage[];
  alt: string;
  className?: string;
}) {
  const [index, setIndex] = useState(0);

  if (images.length === 0) {
    return (
      <div className={`grid aspect-[4/3] place-items-center bg-accent-soft text-accent-strong ${className}`}>
        <Icon name="dish" size={44} strokeWidth={1.2} />
      </div>
    );
  }

  const current = images[Math.min(index, images.length - 1)];

  return (
    <div className={`relative overflow-hidden bg-surface-sunk ${className}`}>
      <div className="relative aspect-[4/3]">
        <Image
          src={current.url}
          alt={current.alt.he || alt}
          fill
          sizes="(max-width: 680px) 100vw, 420px"
          className="object-cover"
        />
      </div>

      {images.length > 1 && (
        <>
          {/* Tap zones rather than arrows: bigger targets, and they do not
              cover the food. */}
          <button
            type="button"
            aria-label="התמונה הקודמת"
            onClick={(e) => { e.stopPropagation(); setIndex((i) => (i - 1 + images.length) % images.length); }}
            className="absolute inset-y-0 start-0 w-1/3"
          />
          <button
            type="button"
            aria-label="התמונה הבאה"
            onClick={(e) => { e.stopPropagation(); setIndex((i) => (i + 1) % images.length); }}
            className="absolute inset-y-0 end-0 w-1/3"
          />

          <div className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center gap-1.5">
            {images.map((img, i) => (
              <span
                key={img.id}
                className={`h-1.5 rounded-pill transition-all ${
                  i === index ? 'w-5 bg-white' : 'w-1.5 bg-white/55'
                }`}
              />
            ))}
          </div>

          <span className="absolute end-2 top-2 rounded-pill bg-black/45 px-2 py-0.5 text-[.7rem] font-medium text-white">
            <span className="money">{index + 1}/{images.length}</span>
          </span>
        </>
      )}
    </div>
  );
}
