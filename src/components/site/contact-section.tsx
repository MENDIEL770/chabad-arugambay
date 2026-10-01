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
  const maps = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
  const directions = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;

  const rows = [
    { icon: 'map' as const, label: 'כתובת', value: 'Main Street, Arugam Bay, Sri Lanka', href: maps },
    { icon: 'whatsapp' as const, label: 'וואטסאפ', value: TENANT.whatsapp, href: `https://wa.me/${digits}` },
    { icon: 'clock' as const, label: 'המסעדה', value: statusLabel, href: '/menu' },
  ];

  return (
    <section id="contact" className="py-18">
      <div className="wrap grid items-start gap-11 grid-cols-[1fr_1fr] max-[860px]:grid-cols-1">
        <Reveal>
          <span className="eyebrow">יצירת קשר</span>
          <h2 className="mt-2 mb-5 text-balance text-[clamp(1.6rem,3vw,2.1rem)] font-bold tracking-[-.015em]">
            איפה אנחנו
          </h2>

          <ul className="flex flex-col gap-3">
            {rows.map((r) => (
              <li key={r.label}>
                <a
                  href={r.href}
                  target={r.href.startsWith('http') ? '_blank' : undefined}
                  rel={r.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                  className="flex items-center gap-3.5 rounded-card border border-line bg-bg px-4 py-3.5 transition-colors hover:border-line-strong hover:bg-surface"
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-input bg-accent-soft text-accent-strong">
                    <Icon name={r.icon} size={19} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[.76rem] text-fg-subtle">{r.label}</span>
                    <span className={`block font-medium ${r.label === 'וואטסאפ' ? 'ltr text-start' : ''}`}>
                      {r.value}
                    </span>
                  </span>
                  <Icon name="arrow" size={16} className="shrink-0 text-fg-subtle" />
                </a>
              </li>
            ))}
          </ul>

          <div className="mt-5 flex flex-wrap gap-3">
            <a href={directions} target="_blank" rel="noopener noreferrer" className="btn btn-accent">
              <Icon name="map" size={17} />
              ניווט לכאן
            </a>
            <a href={`https://wa.me/${digits}`} target="_blank" rel="noopener noreferrer" className="btn btn-ghost">
              <Icon name="whatsapp" size={17} />
              שלחו הודעה
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
              src={`https://maps.google.com/maps?q=${latitude},${longitude}&z=16&hl=iw&output=embed`}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              className="block h-[300px] w-full border-0"
            />
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3">
              <span className="text-[.85rem] font-medium">
                Main Street, Arugam Bay
              </span>
              <a
                href={maps}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-[.82rem] font-medium text-accent-strong hover:underline"
              >
                פתיחה במפות
                <Icon name="arrow" size={14} />
              </a>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
