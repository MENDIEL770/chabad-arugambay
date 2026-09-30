import Link from 'next/link';
import { TENANT } from '@/lib/config';

const COLUMNS = [
  {
    title: 'שבתות וחגים',
    links: [
      { href: '/shabbat', label: 'השבת הקרובה' },
      { href: '/shabbat', label: 'חגי השנה' },
      { href: '/zmanim', label: 'זמני היום' },
      { href: '/whats-on', label: 'מה קורה בבית' },
      { href: '/donate', label: 'תרומה' },
    ],
  },
  {
    title: 'המסעדה',
    links: [
      { href: '/menu', label: 'תפריט' },
      { href: '/menu', label: 'משלוחים' },
      { href: '/menu', label: 'שעות פתיחה' },
      { href: '/articles', label: 'כשרות' },
    ],
  },
  {
    title: 'מטיילים',
    links: [
      { href: '/travel', label: 'המלצות לינה' },
      { href: '/travel', label: 'מה לעשות' },
      { href: '/articles', label: 'מאמרים' },
      { href: '/ask', label: 'צור קשר' },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="mt-auto bg-ink-panel pt-13 pb-8 text-fg-on-dark">
      <div className="wrap">
        <div className="grid grid-cols-[1.6fr_1fr_1fr_1fr] gap-9 max-[820px]:grid-cols-2 max-[820px]:gap-7">
          <div>
            <div className="mb-3.5 flex items-center gap-3 text-white">
              <span className="grid size-[36px] place-items-center rounded-full bg-accent font-bold text-fg-on-accent">
                ח
              </span>
              <span className="flex flex-col leading-tight">
                <span className="font-bold">
                  {TENANT.name.he} – {TENANT.region.he}
                </span>
                <span className="text-[.78rem] text-[#a8a4a6]">{TENANT.tagline.he}</span>
              </span>
            </div>
            <p className="max-w-[34ch] text-sm leading-relaxed text-[#a8a4a6]">
              <span className="ltr">{TENANT.addressLine.en}, Sri Lanka.</span>
              <br />
              פתוח לכל יהודי שעובר כאן — לשבת, לארוחה, או רק לקפה ושיחה.
            </p>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h4 className="mb-3 text-[.74rem] font-medium uppercase tracking-[.14em] text-[#8e8a8c]">
                {col.title}
              </h4>
              <ul className="flex flex-col gap-2.5 text-sm text-[#c5c1c3]">
                {col.links.map((l, i) => (
                  <li key={`${l.href}-${i}`}>
                    <Link href={l.href} className="hover:text-accent">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-9 flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-5 text-[.79rem] text-[#8e8a8c]">
          <span>© תשפ״ז · {TENANT.name.he} – {TENANT.region.he}</span>
          <span className="flex items-center gap-4">
            <span className="ltr">Arugam Bay, Sri Lanka</span>
            {/* Deliberately quiet: staff know it is here, visitors have no
                reason to notice it. */}
            <Link
              href="/admin"
              className="rounded-pill border border-white/15 px-3 py-1 text-[.74rem] transition-colors hover:border-accent hover:text-accent"
            >
              כניסת צוות
            </Link>
          </span>
        </div>
      </div>
    </footer>
  );
}
