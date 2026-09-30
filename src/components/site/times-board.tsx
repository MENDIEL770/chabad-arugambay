import type { Occasion } from '@/lib/calendar/occasions';
import { DateTime } from 'luxon';

interface Row { label: string; time: DateTime; key?: boolean; note?: string }

/**
 * Build the board rows from the occasion itself, so a one-day Shabbat and a
 * three-day chag both render correctly without special cases in the markup.
 *
 * Only computed halachic times appear here. Prayer and meal times belong to
 * the event editor and are passed in once an event exists — inventing them
 * would put wrong times in front of people who plan around them.
 */
function rowsFor(o: Occasion): Row[] {
  const rows: Row[] = [
    { label: 'הדלקת נרות', time: o.candleLighting, key: true },
    { label: 'שקיעה', time: o.days[0].zmanim.sunset },
  ];

  for (const day of o.days) {
    if (day.fromExistingFlame) {
      rows.push({
        label: 'הדלקת נרות ליום השני',
        time: day.zmanim.tzeis,
        note: 'מאש קיימת',
      });
    }
  }

  rows.push({
    label: o.kind === 'shabbat' ? 'צאת השבת' : 'צאת החג',
    time: o.havdalah,
    key: true,
  });

  return rows;
}

function hebrewRange(o: Occasion): string {
  const start = DateTime.fromISO(o.erevDate).setLocale('he');
  const end = DateTime.fromISO(o.endDate).setLocale('he');
  const sameMonth = start.month === end.month;
  return sameMonth
    ? `${start.day}–${end.day} ב${end.toFormat('LLLL')}`
    : `${start.toFormat('d בLLLL')} – ${end.toFormat('d בLLLL')}`;
}

export function TimesBoard({ occasion }: { occasion: Occasion }) {
  const rows = rowsFor(occasion);

  return (
    <aside
      className="rounded-card bg-ink-panel p-6 pb-5 text-fg-on-dark shadow-float"
      aria-label={`זמני ${occasion.title.he}`}
    >
      <div className="flex items-start justify-between gap-3.5 border-b border-white/15 pb-4">
        <div className="min-w-0">
          <span className="eyebrow !text-[#a8a4a6]">
            {occasion.kind === 'shabbat' ? 'השבת הקרובה' : 'החג הקרוב'}
          </span>
          <strong className="mt-1.5 block text-lg font-bold">{occasion.title.he}</strong>
        </div>
        <span className="shrink-0 rounded-pill bg-accent px-3 py-1.5 text-[.7rem] font-medium tracking-wide text-fg-on-accent">
          {hebrewRange(occasion)}
        </span>
      </div>

      <ul className="flex flex-col">
        {rows.map((r, i) => (
          <li
            key={`${r.label}-${i}`}
            className="flex items-baseline gap-3 border-b border-white/[.07] py-2.5 text-[.94rem] last:border-b-0"
          >
            <span className={r.key ? 'font-medium text-white' : 'text-[#c5c1c3]'}>
              {r.label}
              {r.note && <em className="ms-2 not-italic text-[.72rem] text-[#8e8a8c]">{r.note}</em>}
            </span>
            <i className="min-w-6 flex-1 -translate-y-[3px] border-b border-dotted border-white/20" aria-hidden="true" />
            <span className={`clock text-[1.03rem] ${r.key ? 'text-accent' : ''}`}>
              {r.time.toFormat('HH:mm')}
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-3.5 text-[.74rem] leading-relaxed text-[#8e8a8c]">
        זמנים לשיטת אדמו״ר הזקן · ארוגם ביי, סרי לנקה · הדלקה 18 דק׳ לפני השקיעה
        {occasion.hasExistingFlameNight && ' · ליל החג השני מאש קיימת'}
      </p>
    </aside>
  );
}
