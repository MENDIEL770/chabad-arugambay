import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { DateTime } from 'luxon';
import { getEventBySlug } from '@/lib/data/events';
import { getHomeCalendar } from '@/lib/data/calendar';
import { SiteHeader } from '@/components/site/site-header';
import { SiteFooter } from '@/components/site/site-footer';
import { RegisterForm } from '@/components/events/register-form';
import { buildDays } from '@/lib/calendar/occasions';
import { TENANT } from '@/lib/config';

export const dynamic = 'force-dynamic';

export async function generateMetadata(
  { params }: PageProps<'/f/[slug]'>,
): Promise<Metadata> {
  const { slug } = await params;
  const event = await getEventBySlug(slug);
  return { title: event ? `הרשמה · ${event.title.he}` : 'הרשמה' };
}

export default async function RegisterPage({ params }: PageProps<'/f/[slug]'>) {
  const { slug } = await params;
  const [event, cal] = await Promise.all([
    getEventBySlug(slug),
    getHomeCalendar(),
  ]);

  if (!event) notFound();

  // Times for the block, straight from the calendar module rather than
  // stored on the event — so a correction to the zmanim shows up everywhere
  // at once instead of in whichever copy happened to be edited.
  const days = buildDays(TENANT.point, TENANT.zmanim, event.erevOn, event.endsOn);
  const erev = days.find((d) => d.date === event.erevOn);
  const last = days[days.length - 1];

  const closesAt = erev
    ? erev.zmanim.candleLighting.minus({ hours: event.closesHoursBefore })
    : null;
  const closed = !event.isOpen || (closesAt ? DateTime.now() > closesAt : false);

  return (
    <>
      <SiteHeader
        statusOpen={cal.status.isOpen}
        statusLabel={cal.status.label}
        closures={cal.closures} week={cal.week} />

      <main className="wrap flex-1 py-12">
        <div className="mx-auto mb-8 max-w-[620px]">
          <span className="eyebrow">הרשמה</span>
          <h1 className="mt-2 mb-3 text-balance text-[clamp(1.9rem,4vw,2.6rem)] font-bold tracking-[-.02em]">
            {event.title.he}
          </h1>
          {event.intro.he && <p className="text-fg-muted">{event.intro.he}</p>}

          <dl className="mt-6 grid grid-cols-3 gap-px overflow-hidden rounded-card bg-line max-[520px]:grid-cols-1">
            {[
              { t: 'הדלקת נרות', v: erev?.zmanim.candleLighting.toFormat('HH:mm') ?? '—' },
              { t: 'צאת', v: last?.zmanim.havdalah.toFormat('HH:mm') ?? '—' },
              {
                t: 'ההרשמה נסגרת',
                v: closesAt ? closesAt.setLocale('he').toFormat('ccc HH:mm') : '—',
              },
            ].map((x) => (
              <div key={x.t} className="bg-surface px-4 py-3">
                <dt className="text-[.76rem] text-fg-subtle">{x.t}</dt>
                <dd className="clock mt-0.5 text-[1.2rem] font-bold">{x.v}</dd>
              </div>
            ))}
          </dl>
        </div>

        {closed ? (
          <div className="card mx-auto max-w-[620px]">
            <p className="font-medium">ההרשמה נסגרה.</p>
            <p className="mt-1.5 text-sm text-fg-muted">
              עדיין אפשר להגיע — פשוט קשה לנו להבטיח אוכל למי שלא נרשם.
              כתבו לנו בוואטסאפ ונראה מה אפשר לעשות.
            </p>
            <a
              href={`https://wa.me/${TENANT.whatsapp.replace(/[^\d]/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-accent btn-sm mt-4"
            >
              וואטסאפ
            </a>
          </div>
        ) : event.meals.length === 0 ? (
          <p className="card mx-auto max-w-[620px] text-sm text-fg-muted">
            עוד לא הוגדרו סעודות לאירוע הזה.
          </p>
        ) : (
          <RegisterForm event={event} />
        )}
      </main>

      <SiteFooter />
    </>
  );
}
