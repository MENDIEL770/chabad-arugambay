import type { Metadata } from 'next';
import { DateTime } from 'luxon';
import Link from 'next/link';
import { getHomeCalendar, getUpcomingOccasions } from '@/lib/data/calendar';
import { getOpenEvents } from '@/lib/data/events';
import { SiteHeader } from '@/components/site/site-header';
import { SiteFooter } from '@/components/site/site-footer';
import type { Occasion } from '@/lib/calendar/occasions';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'שבתות וחגים',
  description: 'זמני הדלקת נרות וצאת השבת בארוגם ביי, והרשמה לסעודות.',
};

const KIND_LABEL: Record<Occasion['kind'], string> = {
  shabbat: 'שבת',
  yomtov: 'חג',
  combined: 'שבת וחג',
};

function DayRange({ o }: { o: Occasion }) {
  const start = DateTime.fromISO(o.erevDate).setLocale('he');
  const end = DateTime.fromISO(o.endDate).setLocale('he');
  return (
    <span className="clock text-[.82rem] text-fg-subtle">
      {start.toFormat('dd/MM')}–{end.toFormat('dd/MM')}
    </span>
  );
}

export default async function ShabbatPage() {
  const cal = getHomeCalendar();
  const occasions = getUpcomingOccasions(24);
  const events = await getOpenEvents();

  /**
   * Match each occasion to its registration form by occasion key.
   *
   * The list is built from the calendar, not the events table, so a shabbat
   * always appears with correct times even before a form exists for it.
   * The button only becomes a link once there is something to link to.
   */
  const formFor = new Map(events.map((e) => [`${e.startsOn}`, e.slug]));
  const [next, ...rest] = occasions;

  return (
    <>
      <SiteHeader
        statusOpen={cal.status.isOpen}
        statusLabel={cal.status.label}
        closures={cal.closures}
      />

      <main className="wrap flex-1 py-12">
        <div className="mb-9 max-w-[60ch]">
          <span className="eyebrow">שבתות וחגים</span>
          <h1 className="mt-2 mb-2.5 text-balance text-[clamp(1.9rem,4vw,2.6rem)] font-bold tracking-[-.02em]">
            הזמנים והסעודות
          </h1>
          <p className="text-fg-muted">
            זמנים לשיטת אדמו״ר הזקן, מחושבים למיקום של ארוגם ביי. הדלקת נרות
            18 דקות לפני השקיעה.
          </p>
        </div>

        {next && (
          <section className="mb-10 overflow-hidden rounded-card border border-accent bg-accent-soft">
            <div className="flex flex-wrap items-center gap-4 border-b border-accent/40 px-6 py-4">
              <span className="chip !border-transparent !bg-accent !text-fg-on-accent">
                הקרוב
              </span>
              <h2 className="text-xl font-bold">{next.title.he}</h2>
              <DayRange o={next} />
              {formFor.has(next.startDate) ? (
                <Link href={`/f/${formFor.get(next.startDate)}`} className="btn btn-accent btn-sm ms-auto">
                  להרשמה
                </Link>
              ) : (
                <span className="chip ms-auto">ההרשמה תיפתח בקרוב</span>
              )}
            </div>

            <dl className="grid grid-cols-4 gap-px bg-accent/25 max-[700px]:grid-cols-2">
              {[
                { t: 'הדלקת נרות', v: next.candleLighting },
                { t: 'שקיעה', v: next.days[0].zmanim.sunset },
                { t: 'צאת הכוכבים', v: next.days[next.days.length - 1].zmanim.tzeis },
                { t: KIND_LABEL[next.kind] === 'שבת' ? 'צאת השבת' : 'צאת החג', v: next.havdalah },
              ].map((r) => (
                <div key={r.t} className="bg-accent-soft px-6 py-4">
                  <dt className="text-[.78rem] text-fg-muted">{r.t}</dt>
                  <dd className="clock mt-1 text-[1.45rem] font-bold">{r.v.toFormat('HH:mm')}</dd>
                </div>
              ))}
            </dl>

            {next.hasExistingFlameNight && (
              <p className="border-t border-accent/40 px-6 py-3 text-[.84rem]">
                שימו לב: בליל החג השני מדליקים נרות <b>מאש קיימת</b>, אחרי צאת
                הכוכבים ולא לפני.
              </p>
            )}
          </section>
        )}

        <h2 className="mb-4 text-lg font-bold">הבאים בתור</h2>
        <ul className="overflow-hidden rounded-card border border-line bg-bg">
          {rest.map((o) => (
            <li
              key={o.key}
              className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-line px-5 py-4 last:border-b-0 hover:bg-surface"
            >
              <div className="min-w-[14rem] flex-1">
                <div className="flex flex-wrap items-baseline gap-2.5">
                  <b className="font-medium">{o.title.he}</b>
                  <span className="chip">{KIND_LABEL[o.kind]}</span>
                  <DayRange o={o} />
                </div>
              </div>

              <div className="flex gap-7">
                <div>
                  <span className="block text-[.72rem] text-fg-subtle">הדלקה</span>
                  <span className="clock">{o.candleLighting.toFormat('HH:mm')}</span>
                </div>
                <div>
                  <span className="block text-[.72rem] text-fg-subtle">צאת</span>
                  <span className="clock">{o.havdalah.toFormat('HH:mm')}</span>
                </div>
              </div>

              {formFor.has(o.startDate) ? (
                <Link href={`/f/${formFor.get(o.startDate)}`} className="btn btn-ghost btn-sm">
                  להרשמה
                </Link>
              ) : (
                <span className="chip">בקרוב</span>
              )}
            </li>
          ))}
        </ul>

        <p className="mt-4 text-[.8rem] text-fg-subtle">
          טפסי ההרשמה נפתחים אוטומטית 24 שבתות מראש. מי שמגיע בלי להירשם —
          תמיד יש מקום, פשוט קשה יותר לתכנן כמה אוכל להכין.
        </p>
      </main>

      <SiteFooter />
    </>
  );
}
