import type { Metadata } from 'next';
import Image from 'next/image';
import { getAlbums, getGallery } from '@/lib/data/gallery';
import { getHomeCalendar } from '@/lib/data/calendar';
import { SiteHeader } from '@/components/site/site-header';
import { SiteFooter } from '@/components/site/site-footer';
import { Reveal } from '@/components/site/reveal';
import Link from 'next/link';

export const revalidate = 300;

export const metadata: Metadata = {
  title: 'גלריה',
  description: 'תמונות וסרטונים מבית חב״ד ארוגם ביי.',
};

const ALBUM_LABEL: Record<string, string> = {
  general: 'הכול',
  shabbat: 'שבתות וחגים',
  food: 'המסעדה',
  beach: 'החוף',
  people: 'אנשים',
};

export default async function GalleryPage({ searchParams }: PageProps<'/gallery'>) {
  const params = await searchParams; // Next 16: searchParams is a Promise
  const album = typeof params.album === 'string' ? params.album : 'all';

  const [items, albums, cal] = await Promise.all([
    getGallery({ album }),
    getAlbums(),
    Promise.resolve(getHomeCalendar()),
  ]);

  return (
    <>
      <SiteHeader statusOpen={cal.status.isOpen} statusLabel={cal.status.label} closures={cal.closures} />

      <main className="wrap flex-1 py-12">
        <div className="mb-7 max-w-[60ch]">
          <span className="eyebrow">גלריה</span>
          <h1 className="mt-2 mb-2.5 text-balance text-[clamp(1.9rem,4vw,2.6rem)] font-bold tracking-[-.02em]">
            איך זה נראה כאן
          </h1>
          <p className="text-fg-muted">
            תמונות מהשבתות, מהמסעדה ומהחוף. יש לכם תמונה טובה? שלחו לנו בוואטסאפ.
          </p>
        </div>

        {albums.length > 1 && (
          <div className="mb-7 flex flex-wrap gap-2">
            {['all', ...albums].map((a) => {
              const on = album === a;
              return (
                <Link
                  key={a}
                  href={a === 'all' ? '/gallery' : `/gallery?album=${encodeURIComponent(a)}`}
                  className={`rounded-pill border px-4 py-2 text-[.86rem] font-medium transition-colors ${
                    on
                      ? 'border-accent bg-accent text-fg-on-accent'
                      : 'border-line-strong bg-bg text-fg-muted hover:bg-surface hover:text-fg'
                  }`}
                >
                  {a === 'all' ? 'הכול' : (ALBUM_LABEL[a] ?? a)}
                </Link>
              );
            })}
          </div>
        )}

        {items.length === 0 ? (
          <p className="card text-sm text-fg-muted">
            עוד אין תמונות כאן. הן נוספות מממשק הניהול.
          </p>
        ) : (
          /* Masonry via CSS columns: photos here are portrait and landscape
             mixed, and a fixed grid would crop half of them. */
          <div className="columns-2 gap-4 min-[700px]:columns-3 min-[1100px]:columns-4 [&>*]:mb-4">
            {items.map((m, i) => (
              <Reveal key={m.id} delay={Math.min(i, 8) * 40} className="break-inside-avoid">
                <figure className="overflow-hidden rounded-card border border-line bg-surface">
                  {m.kind === 'photo' ? (
                    <Image
                      src={m.url}
                      alt={m.caption?.he ?? ''}
                      width={m.widthPx ?? 800}
                      height={m.heightPx ?? 600}
                      sizes="(max-width:700px) 50vw, (max-width:1100px) 33vw, 25vw"
                      className="h-auto w-full"
                    />
                  ) : (
                    <div className="relative aspect-video">
                      <iframe
                        src={m.url}
                        title={m.caption?.he ?? 'video'}
                        allow="accelerometer; clipboard-write; encrypted-media; picture-in-picture"
                        allowFullScreen
                        loading="lazy"
                        className="absolute inset-0 size-full"
                      />
                    </div>
                  )}
                  {m.caption?.he && (
                    <figcaption className="px-3.5 py-2.5 text-[.82rem] text-fg-muted">
                      {m.caption.he}
                    </figcaption>
                  )}
                </figure>
              </Reveal>
            ))}
          </div>
        )}
      </main>

      <SiteFooter />
    </>
  );
}
