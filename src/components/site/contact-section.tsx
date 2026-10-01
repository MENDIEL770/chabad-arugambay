import { Icon } from '@/components/ui/icon';
import { TENANT } from '@/lib/config';
import { Reveal } from './reveal';

/**
 * Where the house is and how to reach it.
 *
 * The map is a link with a static preview rather than an embedded iframe:
 * a Google Maps embed is several hundred kilobytes and loads third-party
 * scripts, and on the connection most visitors have here it would be the
 * slowest thing on the page. Tapping it opens the app they already use.
 */
export function ContactSection({ statusLabel }: { statusLabel: string }) {
  const { latitude, longitude } = TENANT.point;
  const digits = TENANT.whatsapp.replace(/[^\d]/g, '');
  /**
   * The house's own Google listing, by CID.
   *
   * A bare lat/lng drops an unnamed pin; the CID resolves to the business
   * entry, so the map shows "בית חב״ד ארוגם ביי" with its hours and photos
   * and Directions works from it. Taken from the listing's share link.
   */
  const cid = '2854414804382352519';
  const maps = `https://maps.google.com/maps?cid=${cid}`;
  const directions = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}&destination_place_id=ChIJnUtEIgC95ToQh4TTKCTrnCc`;
  const embed = `https://maps.google.com/maps?cid=${cid}&z=16&hl=iw&output=embed`;

  const rows = [
    { icon: 'map' as const, label: 'כתובת', value: 'Main Street, Arugam Bay, Sri Lanka', href: maps },
    { icon: 'whatsapp' as const, label: 'וואטסאפ', value: TENANT.whatsapp, href: `https://wa.me/${digits}` },
    { icon: 'clock' as const, label: 'המסעדה', value: statusLabel, href: '/menu' },
  ];

  return (
    <section id="contact" className="py-18">
      {/* The map is the wider half: it is the thing being looked at, and
          the details beside it are four short lines. */}
      <div className="wrap grid items-start gap-8 grid-cols-[minmax(0,19rem)_1fr] max-[860px]:grid-cols-1">
        <Reveal>
          <span className="eyebrow">יצירת קשר</span>
          <h2 className="mt-1.5 mb-4 text-balance text-[clamp(1.4rem,2.4vw,1.75rem)] font-bold tracking-[-.015em]">
            איפה אנחנו
          </h2>

          {/* One bordered box with divided rows rather than three separate
              cards: the same information in about half the height. */}
          <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-bg">
            {rows.map((r) => (
              <li key={r.label}>
                <a
                  href={r.href}
                  target={r.href.startsWith('http') ? '_blank' : undefined}
                  rel={r.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                  className="flex items-center gap-3 px-3.5 py-2.5 transition-colors hover:bg-surface"
                >
                  <span className="grid size-8 shrink-0 place-items-center rounded-input bg-accent-soft text-accent-strong">
                    <Icon name={r.icon} size={16} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[.72rem] leading-tight text-fg-subtle">{r.label}</span>
                    <span className={`block text-[.88rem] font-medium leading-snug ${r.label === 'וואטסאפ' ? 'ltr text-start' : ''}`}>
                      {r.value}
                    </span>
                  </span>
                  <Icon name="arrow" size={14} className="shrink-0 text-fg-subtle" />
                </a>
              </li>
            ))}
          </ul>

          <div className="mt-3.5 flex flex-wrap gap-2">
            <a href={directions} target="_blank" rel="noopener noreferrer" className="btn btn-accent btn-sm">
              <Icon name="map" size={15} />
              ניווט לכאן
            </a>
            <a href={`https://wa.me/${digits}`} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">
              <Icon name="whatsapp" size={15} />
              שלחו הודעה
            </a>
            {/* Moved off the map: everything readable now sits in this
                column, and the map is only a map. */}
            <a href={maps} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">
              פתיחה במפות
            </a>
          </div>
        </Reveal>

        <Reveal delay={120}>
          {/* A real map, loaded lazily.
           *
           * This was a drawn coastline to avoid the weight of an embed, but
           * a picture of "a coast" does not help anyone find the house —
           * which is the only job this element has. `loading="lazy"` keeps
           * it off the critical path, so it costs nothing until someone
           * scrolls to it. */}
          <div className="overflow-hidden rounded-card border border-line bg-surface-sunk">
            <iframe
              title="מיקום בית חב״ד ארוגם ביי"
              src={embed}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              className="block h-[320px] w-full border-0 max-[860px]:h-[240px]"
            />
          </div>
        </Reveal>
      </div>
    </section>
  );
}
