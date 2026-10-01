import type { Metadata } from 'next';
import { getHomeCalendar } from '@/lib/data/calendar';
import { getSiteText } from '@/lib/data/site-text';
import { text } from '@/lib/site-text';
import { SiteHeader } from '@/components/site/site-header';
import { SiteFooter } from '@/components/site/site-footer';
import { TENANT } from '@/lib/config';

export const metadata: Metadata = { title: 'תרומה' };

const AMOUNTS = [50, 100, 180, 360, 1000];

export default async function DonatePage() {
  const cal = await getHomeCalendar();
  const copy = await getSiteText();
  const wa = `https://wa.me/${TENANT.whatsapp.replace(/[^\d]/g, '')}`;

  return (
    <>
      <SiteHeader statusOpen={cal.status.isOpen} statusLabel={cal.status.label} closures={cal.closures} week={cal.week} />
      <main id="main" className="wrap flex-1 py-12">
        <div className="max-w-[58ch]">
          <span className="eyebrow">תרומה</span>
          <h1 className="mt-2 mb-3 text-balance text-[clamp(1.9rem,4vw,2.6rem)] font-bold tracking-[-.02em]">
            {text(copy, 'donate.title')}
          </h1>
          <p className="text-fg-muted">
            {text(copy, 'donate.body')}
          </p>

          <div className="card mt-7">
            <span className="label">סכום לתרומה</span>
            <div className="flex flex-wrap gap-2">
              {AMOUNTS.map((a) => (
                <span key={a} className="chip !px-4 !py-2 !text-[.9rem]">
                  <span className="money">{a} ₪</span>
                </span>
              ))}
            </div>
            <p className="mt-4 rounded-input bg-surface px-4 py-3 text-[.85rem] text-fg-muted">
              הסליקה עדיין לא מחוברת. עד שהיא תהיה — אפשר לתאם תרומה איתנו
              ישירות, ונשלח קישור תשלום.
            </p>
            <a href={wa} target="_blank" rel="noopener noreferrer" className="btn btn-accent mt-4">
              לתאם בוואטסאפ
            </a>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
