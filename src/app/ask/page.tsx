import type { Metadata } from 'next';
import { getHomeCalendar } from '@/lib/data/calendar';
import { getMenu } from '@/lib/data/menu';
import { isSellable } from '@/lib/data/types';
import { SiteHeader } from '@/components/site/site-header';
import { SiteFooter } from '@/components/site/site-footer';
import { AskBox } from '@/components/ask/ask-box';
import type { DishFact, KbFacts } from '@/lib/data/kb';
import { TENANT } from '@/lib/config';

export const revalidate = 900;

export const metadata: Metadata = {
  title: 'שאלו אותנו',
  description: 'התשובות לשאלות שחוזרות — זמנים, מחירים, משלוחים, לינה.',
};

export default async function AskPage() {
  const cal = await getHomeCalendar();
  const menu = await getMenu();

  const sellable = menu.flatMap((c) => c.items).filter(isSellable);
  const cheapest = sellable.length
    ? Math.min(...sellable.map((i) => i.priceLkr))
    : null;

  // Registration closes the evening before the erev, so there is a day to shop.
  const closes = cal.next
    ? cal.next.candleLighting.minus({ days: 1 }).set({ hour: 20, minute: 0 })
    : null;

  const facts: KbFacts = {
    occasionTitle: cal.next?.title.he ?? null,
    candleLighting: cal.next?.candleLighting.toFormat('HH:mm') ?? null,
    havdalah: cal.next?.havdalah.toFormat('HH:mm') ?? null,
    registrationCloses: closes ? closes.setLocale('he').toFormat("cccc dd/MM 'בשעה' HH:mm") : null,
    storeStatus: cal.status.label,
    storeOpen: cal.status.isOpen,
    cheapestDishLkr: cheapest,
    deliveryFeeLkr: 500,
  };

  const dishes: DishFact[] = menu.flatMap((c) =>
    c.items.map((i) => ({
      nameHe: i.name.he,
      nameEn: i.name.en,
      priceLkr: i.priceLkr,
      available: isSellable(i),
      descriptionHe: i.description.he,
    })),
  );

  const wa = `https://wa.me/${TENANT.whatsapp.replace(/[^\d]/g, '')}`;

  return (
    <>
      <SiteHeader statusOpen={cal.status.isOpen} statusLabel={cal.status.label} closures={cal.closures} week={cal.week} />
      <main className="wrap flex-1 py-12">
        <div className="mb-7 max-w-[62ch]">
          <span className="eyebrow">שאלו אותנו</span>
          <h1 className="mt-2 mb-2.5 text-balance text-[clamp(1.9rem,4vw,2.6rem)] font-bold tracking-[-.02em]">
            התשובות שכולם שואלים
          </h1>
          <p className="text-fg-muted">
            הזמנים והמחירים כאן מתעדכנים לבד מהמערכת, אז הם תמיד נכונים להיום.
            מה שאין כאן — <a className="font-medium text-accent-strong hover:underline" href={wa} target="_blank" rel="noopener noreferrer">שאלו בוואטסאפ</a>.
          </p>
        </div>

        <AskBox facts={facts} dishes={dishes} />
      </main>
      <SiteFooter />
    </>
  );
}
