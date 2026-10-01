import Image from 'next/image';
import Link from 'next/link';
import type { MediaItem } from '@/lib/data/gallery';
import { Icon } from '@/components/ui/icon';
import { Reveal } from './reveal';

/**
 * A peek at the gallery on the home page.
 *
 * Scroll-snap rail at every width, not just on a phone: a row of photos is
 * one of the few things that reads better as a rail than a grid, because
 * the cut-off edge invites the swipe.
 */
export function GalleryStrip({ items }: { items: MediaItem[] }) {
  return (
    <section className="py-18">
      <div className="wrap">
        <Reveal>
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <span className="eyebrow">גלריה</span>
              <h2 className="mt-2 text-balance text-[clamp(1.6rem,3vw,2.1rem)] font-bold tracking-[-.015em]">
                איך זה נראה כאן
              </h2>
            </div>
            <Link href="/gallery" className="btn btn-ghost btn-sm">
              לכל התמונות
              <Icon name="arrow" size={15} />
            </Link>
          </div>
        </Reveal>
      </div>

      <div className="wrap">
        <ul
          className="
            -mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-2
            [scrollbar-width:none] [&::-webkit-scrollbar]:hidden
          "
        >
          {items.map((m, i) => (
            <li
              key={m.id}
              className="w-[70vw] max-w-[320px] shrink-0 snap-start sm:w-[280px]"
            >
              <Reveal delay={i * 50}>
                <figure className="overflow-hidden rounded-card border border-line bg-surface">
                  <div className="relative aspect-[4/3]">
                    {m.kind === 'photo' ? (
                      <Image src={m.url} alt={m.caption?.he ?? ''} fill sizes="320px" className="object-cover" />
                    ) : (
                      <>
                        {m.posterUrl ? (
                          <Image src={m.posterUrl} alt={m.caption?.he ?? ''} fill sizes="320px" className="object-cover" />
                        ) : (
                          <span className="absolute inset-0 bg-ink-panel" />
                        )}
                        <span className="absolute inset-0 grid place-items-center">
                          <span className="grid size-12 place-items-center rounded-full bg-black/55 text-white backdrop-blur-sm">
                            ▶
                          </span>
                        </span>
                      </>
                    )}
                  </div>
                  {m.caption?.he && (
                    <figcaption className="px-3.5 py-2.5 text-[.82rem] text-fg-muted">
                      {m.caption.he}
                    </figcaption>
                  )}
                </figure>
              </Reveal>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
