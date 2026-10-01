import Link from 'next/link';
import { getHomeCalendar, type HomeCalendar } from '@/lib/data/calendar';
import { getMenu } from '@/lib/data/menu';
import { getHeroSlides } from '@/lib/data/hero';
import { isSellable } from '@/lib/data/types';
import { formatLkr, TENANT } from '@/lib/config';
import { getSiteText } from '@/lib/data/site-text';
import { text, type TextOverrides } from '@/lib/site-text';
import { SiteHeader } from '@/components/site/site-header';
import { SiteFooter } from '@/components/site/site-footer';
import { HeroSky } from '@/components/site/hero-sky';
import { HeroCarousel } from '@/components/site/hero-carousel';
import { ServiceCards } from '@/components/site/service-cards';
import { DishThumb } from '@/components/menu/dish-thumb';
import { AboutSection } from '@/components/site/about-section';
import { ContactSection } from '@/components/site/contact-section';
import { GalleryStrip } from '@/components/site/gallery-strip';
import { getAbout, getGallery } from '@/lib/data/gallery';
import { Icon } from '@/components/ui/icon';

export const revalidate = 3600;

/**
 * The page's own hero copy.
 *
 * Shown on the drawn backdrop when there are no photos, and as the default
 * inside the carousel — a slide that carries its own headline replaces it
 * while that slide is on screen.
 */
function HeroCopy({
  cal, copy, onImage = false,
}: {
  cal: HomeCalendar;
  copy: TextOverrides;
  onImage?: boolean;
}) {
  // Over a photograph the text needs its own contrast; on the plain backdrop
  // it should use the normal palette so dark mode still works.
  const tone = onImage
    ? { title: 'text-white', lede: 'text-white/85', meta: 'text-white/70', rule: 'border-white/25' }
    : { title: '', lede: 'text-fg-muted', meta: 'text-fg-subtle', rule: 'border-line' };

  return (
    <div className={onImage ? 'max-w-[52ch] drop-shadow-[0_2px_18px_rgb(0_0_0/.45)]' : undefined}>
      <p className={`eyebrow ${onImage ? '!text-white/70' : ''}`}>
        {cal.today.hebrewDate.he}
        {cal.today.holiday && ` · ${cal.today.holiday.he}`}
      </p>

      {/* The house is the headline. The upcoming chag is news, and news
          belongs under the name of the place, not instead of it. */}
      <h1
        className={`mt-3.5 text-balance text-[clamp(2.1rem,4.6vw,3.3rem)] font-bold leading-[1.12] tracking-[-.02em] ${tone.title}`}
      >
        {TENANT.name.he} – {TENANT.region.he}
      </h1>

      <p
        className={`mt-2 mb-5 text-[clamp(1.15rem,2.4vw,1.6rem)] font-medium ${
          onImage ? 'text-accent' : 'text-accent-strong'
        }`}
      >
        {TENANT.tagline.he}
      </p>

      {cal.next && (
        <p className={`mb-3 text-[1.02rem] font-medium ${tone.title}`}>
          הקרוב: {cal.next.title.he}
        </p>
      )}

      <p className={`max-w-[47ch] text-[1.1rem] ${tone.lede}`}>
        {text(copy, 'home.lede')}
      </p>

      <div className="mt-7.5 flex flex-wrap gap-3 max-[560px]:flex-col max-[560px]:items-stretch">
        <Link href="/shabbat" className="btn btn-accent btn-lg max-[560px]:justify-center">
          {cal.next?.kind === 'shabbat' ? 'הרשמה לשבת' : 'הרשמה לחג'}
        </Link>
        <Link
          href="/menu"
          className={`btn btn-lg max-[560px]:justify-center ${
            onImage
              ? 'border-white/40 bg-white/10 text-white backdrop-blur-sm hover:bg-white/20'
              : 'btn-ghost'
          }`}
        >
          לתפריט המסעדה
        </Link>
      </div>

      <dl className={`mt-8.5 flex flex-wrap gap-6.5 border-t pt-6 ${tone.rule}`}>
        {[
          { t: 'הדלקת נרות', v: cal.next?.candleLighting.toFormat('HH:mm') ?? '—' },
          { t: 'צאת השבת/חג', v: cal.next?.havdalah.toFormat('HH:mm') ?? '—' },
          { t: 'שקיעה היום', v: cal.today.zmanim.sunset.toFormat('HH:mm') },
        ].map((x) => (
          <div key={x.t} className="flex flex-col gap-0.5">
            <dt className={`order-2 text-[.79rem] ${tone.meta}`}>{x.t}</dt>
            <dd className={`clock order-1 text-[1.28rem] font-bold ${tone.title}`}>{x.v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export default async function HomePage() {
  const cal = getHomeCalendar();
  const [menu, slides, copy, about, featured] = await Promise.all([
    getMenu(),
    getHeroSlides(),
    getSiteText(),
    getAbout(),
    getGallery({ featuredOnly: true, limit: 10 }),
  ]);
  const highlights = menu.flatMap((c) => c.items).slice(0, 4);

  return (
    <>
      <SiteHeader
        statusOpen={cal.status.isOpen}
        statusLabel={cal.status.label}
        closures={cal.closures}
      />

      <main className="flex-1">
        {slides.length > 0 ? (
          <HeroCarousel slides={slides}>
            <HeroCopy cal={cal} copy={copy} onImage />
          </HeroCarousel>
        ) : (
          <section className="relative overflow-hidden border-b border-line">
            <HeroSky />
            <div className="wrap relative pt-19 pb-21 max-[900px]:pt-13 max-[900px]:pb-15">
              <HeroCopy cal={cal} copy={copy} />
            </div>
          </section>
        )}


        <section className="py-18">
          <div className="wrap">
            <div className="mb-8.5 max-w-[60ch]">
              <span className="eyebrow">{text(copy, 'home.services.eyebrow')}</span>
              <h2 className="mt-2 mb-2.5 text-balance text-[clamp(1.6rem,3vw,2.1rem)] font-bold tracking-[-.015em]">
                {text(copy, 'home.services.title')}
              </h2>
              <p className="text-fg-muted">
                {text(copy, 'home.services.body')}
              </p>
            </div>
            <ServiceCards />
          </div>
        </section>

        <section className="border-y border-line bg-surface py-18">
          <div className="wrap grid grid-cols-[.9fr_1.1fr] items-center gap-11 max-[900px]:grid-cols-1 max-[900px]:gap-7">
            <div>
              <span className="eyebrow">המסעדה</span>
              <h2 className="mt-2 mb-3 text-balance text-[clamp(1.6rem,3vw,2.1rem)] font-bold tracking-[-.015em]">
                {text(copy, 'home.restaurant.title')}
              </h2>
              <p className="text-fg-muted">
                {text(copy, 'home.restaurant.body')}
              </p>
              <div className="mt-4 flex items-center gap-3 rounded-card bg-accent-soft px-4.5 py-3.5 text-sm">
                <Icon name="scooter" size={21} className="shrink-0 text-accent-strong" />
                <span>
                  משלוח לאזור ארוגם ביי: <b className="money">500 LKR</b> · בערך{' '}
                  <b className="money">35</b> דק׳ · משלמים לנהג במזומן
                </span>
              </div>
              <div className="mt-5.5 flex flex-wrap gap-3">
                <Link href="/menu" className="btn btn-accent">להזמנה</Link>
                <Link href="/menu" className="btn btn-ghost">לתפריט המלא</Link>
              </div>
            </div>

            <ul className="overflow-hidden rounded-card border border-line bg-bg">
              {highlights.map((item) => {
                const sellable = isSellable(item);
                return (
                  <li
                    key={item.id}
                    className={`flex items-center gap-4 border-b border-line px-5 py-4 last:border-b-0 ${
                      sellable ? '' : 'opacity-55'
                    }`}
                  >
                    <DishThumb
                      src={item.imageUrl}
                      alt={item.name.he}
                      size={46}
                      rounded="rounded-[11px]"
                    />
                    <span className="min-w-0 flex-1">
                      <b className="block font-medium">{item.name.he}</b>
                      <span className="text-[.8rem] text-fg-subtle">{item.description.he}</span>
                    </span>
                    <span className={`chip ${sellable ? 'chip-kosher' : 'chip-out'}`}>
                      {sellable
                        ? item.kosher === 'meat' ? 'בשרי' : item.kosher === 'dairy' ? 'חלבי' : 'פרווה'
                        : 'אזל להיום'}
                    </span>
                    <span className="money">{formatLkr(item.priceLkr)}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
        {featured.length > 0 && <GalleryStrip items={featured} />}

        <AboutSection about={about} />

        <ContactSection statusLabel={cal.status.label} />
      </main>

      <SiteFooter />
    </>
  );
}
