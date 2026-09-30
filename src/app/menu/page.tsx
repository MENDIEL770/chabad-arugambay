import type { Metadata } from 'next';
import { getMenu } from '@/lib/data/menu';
import { getHomeCalendar } from '@/lib/data/calendar';
import { SiteHeader } from '@/components/site/site-header';
import { SiteFooter } from '@/components/site/site-footer';
import { MenuBrowser } from '@/components/menu/menu-browser';

export const revalidate = 300;

export const metadata: Metadata = {
  title: 'התפריט',
  description: 'אוכל כשר בארוגם ביי — משלוח, איסוף או ישיבה במקום.',
};

export default async function MenuPage() {
  const [menu, cal] = await Promise.all([getMenu(), Promise.resolve(getHomeCalendar())]);
  const active = menu.filter((c) => c.isActive && c.items.length > 0);

  return (
    <>
      <SiteHeader
        statusOpen={cal.status.isOpen}
        statusLabel={cal.status.label}
        closures={cal.closures}
      />

      <main className="wrap flex-1 py-12">
        <div className="mb-8 max-w-[60ch]">
          <span className="eyebrow">המסעדה</span>
          <h1 className="mt-2 mb-2.5 text-balance text-[clamp(1.9rem,4vw,2.6rem)] font-bold tracking-[-.02em]">
            התפריט
          </h1>
          <p className="text-fg-muted">
            הכול כשר בהשגחת בית חב״ד, בשר וחלב בהפרדה מלאה. המחירים ברופי סרי-לנקי.
          </p>
          {!cal.status.isOpen && (
            <p className="mt-4 rounded-card border border-line bg-surface px-4 py-3 text-sm">
              <b>{cal.status.label}.</b> אפשר לעיין בתפריט, אבל הזמנות ייפתחו מחדש כשנפתח.
            </p>
          )}
        </div>

        <MenuBrowser categories={active} />
      </main>

      <SiteFooter />
    </>
  );
}
