import type { Metadata } from 'next';
import { getHomeCalendar } from '@/lib/data/calendar';
import { getSiteText } from '@/lib/data/site-text';
import { text } from '@/lib/site-text';
import { SiteHeader } from '@/components/site/site-header';
import { SiteFooter } from '@/components/site/site-footer';
import { TravelSearch } from '@/components/travel/travel-search';

export const metadata: Metadata = {
  title: 'טיולים והמלצות',
  description: 'איפה לישון ומה לעשות בארוגם ביי — המלצות ממי שגר כאן.',
};

export default async function TravelPage() {
  const cal = await getHomeCalendar();
  const copy = await getSiteText();
  return (
    <>
      <SiteHeader statusOpen={cal.status.isOpen} statusLabel={cal.status.label} closures={cal.closures} week={cal.week} />
      <main className="wrap flex-1 py-12">
        <div className="mb-7 max-w-[62ch]">
          <span className="eyebrow">טיולים והמלצות</span>
          <h1 className="mt-2 mb-2.5 text-balance text-[clamp(1.9rem,4vw,2.6rem)] font-bold tracking-[-.02em]">
            איפה לישון ומה לעשות בארוגם ביי
          </h1>
          <p className="text-fg-muted">
            {text(copy, 'travel.intro')}
          </p>
        </div>
        <TravelSearch />
      </main>
      <SiteFooter />
    </>
  );
}
