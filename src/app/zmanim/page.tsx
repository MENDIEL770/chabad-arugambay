import type { Metadata } from 'next';
import { DateTime } from 'luxon';
import { TENANT } from '@/lib/config';
import { buildDays } from '@/lib/calendar/occasions';
import { getHomeCalendar } from '@/lib/data/calendar';
import { SiteHeader } from '@/components/site/site-header';
import { SiteFooter } from '@/components/site/site-footer';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'זמני היום',
  description: 'זמני היום לשיטת אדמו״ר הזקן, מחושבים לארוגם ביי.',
};

export default async function ZmanimPage() {
  const cal = await getHomeCalendar();
  const now = DateTime.now().setZone(TENANT.point.timezone);
  const today = buildDays(TENANT.point, TENANT.zmanim, now.toISODate()!, now.toISODate()!)[0];
  const z = today.zmanim;

  const rows = [
    { l: 'עלות השחר', v: z.alos },
    { l: 'זריחה (אמיתית)', v: z.sunriseBaal },
    { l: 'זריחה (נראית)', v: z.sunrise },
    { l: 'סוף זמן קריאת שמע', v: z.sofZmanShma },
    { l: 'סוף זמן תפילה', v: z.sofZmanTfila },
    { l: 'חצות', v: z.chatzos },
    { l: 'מנחה גדולה', v: z.minchaGedola },
    { l: 'מנחה קטנה', v: z.minchaKetana },
    { l: 'פלג המנחה', v: z.plagHamincha },
    { l: 'שקיעה (נראית)', v: z.sunset },
    { l: 'שקיעה (אמיתית)', v: z.sunsetBaal },
    { l: 'צאת הכוכבים', v: z.tzeis },
  ];

  return (
    <>
      <SiteHeader statusOpen={cal.status.isOpen} statusLabel={cal.status.label} closures={cal.closures} week={cal.week} />
      <main id="main" className="wrap flex-1 py-12">
        <div className="mb-7 max-w-[60ch]">
          <span className="eyebrow">
            {today.hebrewDate.he}
            {today.holiday && ` · ${today.holiday.he}`}
          </span>
          <h1 className="mt-2 mb-2.5 text-[clamp(1.9rem,4vw,2.6rem)] font-bold tracking-[-.02em]">
            זמני היום
          </h1>
          <p className="text-fg-muted">
            לשיטת אדמו״ר הזקן, מחושבים למיקום של ארוגם ביי
            (<span className="ltr">{TENANT.point.latitude}°N, {TENANT.point.longitude}°E</span>).
          </p>
        </div>

        <div className="overflow-hidden rounded-card bg-ink-panel text-fg-on-dark">
          <ul>
            {rows.map((r) => (
              <li
                key={r.l}
                className="flex items-baseline gap-3 border-b border-white/[.07] px-6 py-3 last:border-b-0"
              >
                <span className="text-[#c5c1c3]">{r.l}</span>
                <i className="min-w-6 flex-1 -translate-y-[3px] border-b border-dotted border-white/20" aria-hidden="true" />
                <span className="clock text-[1.05rem]">{r.v.toFormat('HH:mm')}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="mt-4 text-[.8rem] text-fg-subtle">
          שעה זמנית היום: <span className="clock">{z.shaahZmanisMin.toFixed(1)}</span> דקות.
          הזמנים מחושבים מקומית ומאומתים מול zmanim.org.il.
        </p>
      </main>
      <SiteFooter />
    </>
  );
}
