import Link from 'next/link';
import { getHomeCalendar } from '@/lib/data/calendar';
import { getMenu } from '@/lib/data/menu';
import { isSellable } from '@/lib/data/types';
import { Icon } from '@/components/ui/icon';
import { formatLkr, TENANT } from '@/lib/config';
import { SiteHeader } from '@/components/site/site-header';
import { SiteFooter } from '@/components/site/site-footer';
import { TimesBoard } from '@/components/site/times-board';
import { HeroSky } from '@/components/site/hero-sky';
import { ServiceCards } from '@/components/site/service-cards';
import { DishThumb } from '@/components/menu/dish-thumb';

// Zmanim shift every day, so the page is rebuilt hourly rather than pinned.
export const revalidate = 3600;

export default async function HomePage() {
  const cal = getHomeCalendar();
  const menu = await getMenu();

  const highlights = menu
    .flatMap((c) => c.items)
    .slice(0, 4);

  return (
    <>
      <SiteHeader
        statusOpen={cal.status.isOpen}
        statusLabel={cal.status.label}
        closures={cal.closures}
      />

      <main className="flex-1">
        <section className="relative overflow-hidden border-b border-line">
          <HeroSky />
          <div className="wrap relative grid grid-cols-[1.15fr_.85fr] items-center gap-13 pt-19 pb-21 max-[900px]:grid-cols-1 max-[900px]:gap-9 max-[900px]:pt-13 max-[900px]:pb-15">
            <div>
              <p className="eyebrow">
                {cal.today.hebrewDate.he}
                {cal.today.holiday && ` · ${cal.today.holiday.he}`}
              </p>
              <h1 className="mt-3.5 mb-4.5 text-balance text-[clamp(2.3rem,5.1vw,3.7rem)] font-bold leading-[1.1] tracking-[-.02em]">
                {cal.next ? `${cal.next.title.he} בארוגם ביי` : 'שבת בארוגם ביי'}
              </h1>
              <p className="mb-3 text-[1.02rem] font-medium text-accent-strong">
                {TENANT.name.he} – {TENANT.region.he} · {TENANT.tagline.he}
              </p>
              <p className="max-w-[47ch] text-[1.1rem] text-fg-muted">
                סעודות על שפת הים, מקום לישון למי שצריך, ואוכל כשר כל השבוע.
                כל מי שעובר בארוגם ביי מוזמן.
              </p>

              <div className="mt-7.5 flex flex-wrap gap-3 max-[560px]:flex-col max-[560px]:items-stretch">
                <Link href="/shabbat" className="btn btn-accent btn-lg max-[560px]:justify-center">
                  {cal.next?.kind === 'shabbat' ? 'הרשמה לשבת' : 'הרשמה לחג'}
                </Link>
                <Link href="/menu" className="btn btn-ghost btn-lg max-[560px]:justify-center">
                  לתפריט המסעדה
                </Link>
              </div>

              <dl className="mt-8.5 flex flex-wrap gap-6.5 border-t border-line pt-6">
                <div className="flex flex-col gap-0.5">
                  <dt className="order-2 text-[.79rem] text-fg-subtle">הדלקת נרות</dt>
                  <dd className="clock order-1 text-[1.28rem] font-bold">
                    {cal.next?.candleLighting.toFormat('HH:mm') ?? '—'}
                  </dd>
                </div>
                <div className="flex flex-col gap-0.5">
                  <dt className="order-2 text-[.79rem] text-fg-subtle">צאת השבת/חג</dt>
                  <dd className="clock order-1 text-[1.28rem] font-bold">
                    {cal.next?.havdalah.toFormat('HH:mm') ?? '—'}
                  </dd>
                </div>
                <div className="flex flex-col gap-0.5">
                  <dt className="order-2 text-[.79rem] text-fg-subtle">שקיעה היום</dt>
                  <dd className="clock order-1 text-[1.28rem] font-bold">
                    {cal.today.zmanim.sunset.toFormat('HH:mm')}
                  </dd>
                </div>
              </dl>
            </div>

            {cal.next && <TimesBoard occasion={cal.next} />}
          </div>
        </section>

        <section className="py-18">
          <div className="wrap">
            <div className="mb-8.5 max-w-[60ch]">
              <span className="eyebrow">מה אפשר לעשות כאן</span>
              <h2 className="mt-2 mb-2.5 text-balance text-[clamp(1.6rem,3vw,2.1rem)] font-bold tracking-[-.015em]">
                כל מה שקורה בבית, במקום אחד
              </h2>
              <p className="text-fg-muted">
                הרשמה, אוכל, טיולים ותשובות — בלי לחפש במי-יודע-איזו קבוצת וואטסאפ.
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
                אוכל כשר, חם, על החוף
              </h2>
              <p className="text-fg-muted">
                בשר וחלב בהפרדה מלאה, בהשגחת בית חב״ד. מזמינים מהטלפון, ומקבלים
                עדכון בוואטסאפ בכל שלב — מהמטבח ועד שהנהג בדרך.
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
                    <DishThumb src={item.imageUrl} alt={item.name.he} size={46} rounded="rounded-[11px]" />
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
      </main>

      <SiteFooter />
    </>
  );
}
