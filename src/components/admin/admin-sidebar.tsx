'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Icon, type IconName } from '@/components/ui/icon';

interface Entry {
  href: string;
  label: string;
  icon: IconName;
  hint?: string;
}

/**
 * Grouped by who does the work, not by which table it touches.
 *
 * The restaurant group is what someone standing in the kitchen needs during
 * service; the site group is what gets edited once a month. Keeping them
 * apart is also the shape the restaurant-only account will take later — that
 * login simply gets the first group and nothing else.
 */
export const SECTIONS: { title: string; entries: Entry[] }[] = [
  {
    title: 'מסעדה',
    entries: [
      { href: '/admin/orders', label: 'הזמנות', icon: 'clock', hint: 'לוח ההזמנות החי' },
      { href: '/kitchen', label: 'מסך מטבח', icon: 'utensils', hint: 'המסך של המטבח' },
      { href: '/admin/restaurant/menu', label: 'תפריט ומלאי', icon: 'dish' },
      { href: '/admin/restaurant/receipt', label: 'עיצוב הקבלה', icon: 'image' },
    ],
  },
  {
    title: 'אירועים',
    entries: [
      { href: '/admin/events', label: 'שבתות וחגים', icon: 'candle', hint: 'טפסי הרשמה' },
    ],
  },
  {
    title: 'האתר',
    entries: [
      { href: '/admin/settings/hero', label: 'תמונות רקע', icon: 'image' },
      { href: '/admin/settings/text', label: 'טקסטים', icon: 'sparkle', hint: 'כל משפט באתר' },
    ],
  },
  {
    title: 'מערכת',
    entries: [{ href: '/admin/settings', label: 'הגדרות', icon: 'map' }],
  },
];

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav aria-label="ניהול" className="flex flex-col gap-5">
      {SECTIONS.map((section) => (
        <div key={section.title}>
          <h2 className="mb-1.5 px-3 text-[.7rem] font-medium uppercase tracking-[.12em] text-fg-subtle">
            {section.title}
          </h2>
          <ul className="flex flex-col gap-0.5">
            {section.entries.map((e) => {
              // The kitchen screen lives outside /admin, so an exact match
              // is wrong for it and a prefix match is wrong for /admin.
              const active =
                pathname === e.href ||
                (e.href !== '/admin' && e.href !== '/kitchen' && pathname.startsWith(`${e.href}/`));

              return (
                <li key={e.href}>
                  <Link
                    href={e.href}
                    onClick={onNavigate}
                    aria-current={active ? 'page' : undefined}
                    className={`flex items-start gap-2.5 rounded-input px-3 py-2 transition-colors ${
                      active
                        ? 'bg-accent-soft font-medium text-fg'
                        : 'text-fg-muted hover:bg-surface hover:text-fg'
                    }`}
                  >
                    <Icon
                      name={e.icon}
                      size={17}
                      className={`mt-0.5 shrink-0 ${active ? 'text-accent-strong' : ''}`}
                    />
                    <span className="min-w-0">
                      <span className="block text-[.9rem] leading-tight">{e.label}</span>
                      {e.hint && (
                        <span className="block text-[.72rem] text-fg-subtle">{e.hint}</span>
                      )}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export function AdminSidebar() {
  return (
    <aside className="sticky top-[64px] h-fit w-[224px] shrink-0 max-[900px]:hidden">
      <div className="py-6 pe-2">
        <NavList />
      </div>
    </aside>
  );
}

/** The same list behind a button, for a phone. */
export function AdminMobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const current =
    SECTIONS.flatMap((s) => s.entries).find((e) => e.href === pathname)?.label ?? 'ניהול';

  return (
    <div className="min-[900px]:hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex items-center gap-2 rounded-pill border border-line-strong px-3.5 py-2 text-[.86rem] font-medium"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
        {current}
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 top-16 z-40 bg-black/30"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div className="fixed inset-x-0 top-16 z-50 max-h-[calc(100dvh-4rem)] overflow-y-auto border-b border-line bg-bg p-4 shadow-float">
            <NavList onNavigate={() => setOpen(false)} />
          </div>
        </>
      )}
    </div>
  );
}
