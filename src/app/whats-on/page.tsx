import type { Metadata } from 'next';
import { DateTime } from 'luxon';
import { getHomeCalendar } from '@/lib/data/calendar';
import {
  getHappenings, describeWhen, nextOccurrence, KIND_LABEL, type Happening,
} from '@/lib/data/happenings';
import { SiteHeader } from '@/components/site/site-header';
import { SiteFooter } from '@/components/site/site-footer';
import { Icon, type IconName } from '@/components/ui/icon';
import { TENANT } from '@/lib/config';

export const revalidate = 1800;

export const metadata: Metadata = {
  title: 'מה קורה בבית',
  description: 'שיעורים, התוועדויות והודעות בבית חב״ד ארוגם ביי.',
};

const KIND_ICON: Record<Happening['kind'], IconName> = {
  class: 'sparkle',
  farbrengen: 'candle',
  notice: 'clock',
  event: 'heart',
};

export default async function WhatsOnPage() {
  const cal = getHomeCalendar();
  const happenings = await getHappenings();
  const now = DateTime.now().setZone(TENANT.point.timezone);

  // Soonest first, so the board answers "what is on tonight" at a glance.
  const withNext = happenings
    .map((h) => ({ h, next: nextOccurrence(h, now) }))
    .sort((a, b) => {
      if (!a.next) return 1;
      if (!b.next) return -1;
      return a.next.toMillis() - b.next.toMillis();
    });

  const recurring = withNext.filter((x) => x.h.cycle !== 'once');
  const oneOff = withNext.filter((x) => x.h.cycle === 'once' && x.next);

  return (
    <>
      <SiteHeader
        statusOpen={cal.status.isOpen}
        statusLabel={cal.status.label}
        closures={cal.closures}
      />

      <main className="wrap flex-1 py-12">
        <div className="mb-9 max-w-[62ch]">
          <span className="eyebrow">לוח מודעות</span>
          <h1 className="mt-2 mb-2.5 text-balance text-[clamp(1.9rem,4vw,2.6rem)] font-bold tracking-[-.02em]">
            מה קורה בבית
          </h1>
          <p className="text-fg-muted">
            שיעורים קבועים, התוועדויות והודעות. שיעור שתלוי בשקיעה זז לבד עם
            הזמנים — מה שרשום כאן הוא מה שיהיה.
          </p>
        </div>

        {happenings.length === 0 ? (
          <p className="card max-w-[62ch] text-sm text-fg-muted">
            עוד לא פורסם כלום. בינתיים — פשוט תבואו, תמיד קורה משהו.
          </p>
        ) : (
          <>
            {oneOff.length > 0 && (
              <section className="mb-10">
                <h2 className="mb-3 text-lg font-bold">השבוע</h2>
                <ul className="grid grid-cols-2 gap-4 max-[760px]:grid-cols-1">
                  {oneOff.map(({ h, next }) => (
                    <li key={h.id} className="card border-accent bg-accent-soft">
                      <div className="flex items-start gap-3">
                        <Icon name={KIND_ICON[h.kind]} size={20} className="mt-0.5 shrink-0 text-accent-strong" />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-baseline gap-2">
                            <b className="font-bold">{h.title.he}</b>
                            <span className="chip">{KIND_LABEL[h.kind]}</span>
                          </div>
                          {h.details.he && (
                            <p className="mt-1 text-[.87rem] text-fg-muted">{h.details.he}</p>
                          )}
                          <p className="clock mt-2 text-[.85rem] font-medium">
                            {next!.setLocale('he').toFormat('cccc dd/MM · HH:mm')}
                          </p>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <h2 className="mb-3 text-lg font-bold">קבוע</h2>
            <ul className="overflow-hidden rounded-card border border-line bg-bg">
              {recurring.map(({ h, next }) => (
                <li
                  key={h.id}
                  className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-line px-5 py-4 last:border-b-0"
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-input bg-accent-soft text-accent-strong">
                    <Icon name={KIND_ICON[h.kind]} size={19} />
                  </span>

                  <div className="min-w-[13rem] flex-1">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <b className="font-medium">{h.title.he}</b>
                      <span className="chip">{KIND_LABEL[h.kind]}</span>
                      {h.audience.he && <span className="chip">{h.audience.he}</span>}
                    </div>
                    {h.details.he && (
                      <p className="mt-0.5 text-[.85rem] text-fg-muted">{h.details.he}</p>
                    )}
                    {h.pausedNote.he && (
                      <p className="mt-0.5 text-[.82rem] text-danger">{h.pausedNote.he}</p>
                    )}
                  </div>

                  <div className="text-start">
                    <span className="block text-[.78rem] text-fg-muted">{describeWhen(h)}</span>
                    {next && (
                      <span className="clock text-[.8rem] text-fg-subtle">
                        הקרוב: {next.setLocale('he').toFormat('ccc HH:mm')}
                      </span>
                    )}
                  </div>

                  {h.location.he && <span className="chip">{h.location.he}</span>}
                </li>
              ))}
            </ul>
          </>
        )}
      </main>

      <SiteFooter />
    </>
  );
}
