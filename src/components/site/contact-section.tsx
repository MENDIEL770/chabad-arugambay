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
          <a
            href={maps}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="פתיחת המיקום במפות"
            className="group relative block overflow-hidden rounded-card border border-line bg-ink-panel"
          >
            {/* A drawn coastline, not a map tile — no third-party request,
                and it only has to say "east coast, on the water". */}
            <svg viewBox="0 0 400 300" className="h-full w-full" role="presentation">
              <rect width="400" height="300" fill="#0e3a4a" />
              <path d="M0 150 Q70 120 110 160 T210 170 Q280 150 330 190 L400 210 L400 300 L0 300 Z" fill="#1d5d4a" />
              <path d="M0 150 Q70 120 110 160 T210 170 Q280 150 330 190 L400 210" fill="none" stroke="#2AA6A0" strokeWidth="2.5" />
              {[40, 90, 140, 190, 240].map((y) => (
                <path key={y} d={`M0 ${y} Q60 ${y - 8} 120 ${y} T240 ${y} T400 ${y}`} fill="none" stroke="#164f63" strokeWidth="1.5" />
              ))}
              <circle cx="238" cy="178" r="22" fill="#FDB940" opacity=".2">
                <animate attributeName="r" values="18;30;18" dur="3s" repeatCount="indefinite" />
              </circle>
              <circle cx="238" cy="178" r="7" fill="#FDB940" stroke="#211f20" strokeWidth="2" />
            </svg>

            <span className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 bg-ink-panel/85 px-4 py-3 text-fg-on-dark backdrop-blur-sm">
              <span className="text-[.85rem] font-medium">Arugam Bay, Sri Lanka</span>
              <span className="clock text-[.72rem] text-[#a8a4a6]">
                {latitude}°N {longitude}°E
              </span>
            </span>
          </a>
        </Reveal>
      </div>
    </section>
  );
}
