'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useId, useRef, useState } from 'react';
import { Icon } from '@/components/ui/icon';

export interface NavItem {
  href: string;
  label: string;
  children?: { href: string; label: string; hint?: string }[];
}

/**
 * Five top-level items instead of eight.
 *
 * The four pages that are all "who we are and what we've been doing" sit
 * together under אודות rather than each claiming a slot in the bar.
 */
export const NAV: NavItem[] = [
  { href: '/shabbat', label: 'שבתות וחגים' },
  { href: '/menu', label: 'המסעדה' },
  { href: '/travel', label: 'טיולים והמלצות' },
  {
    href: '/about',
    label: 'אודות',
    children: [
      { href: '/about', label: 'על הבית', hint: 'מי אנחנו ואיפה למצוא אותנו' },
      { href: '/whats-on', label: 'מה קורה בבית', hint: 'שיעורים והתוועדויות' },
      { href: '/gallery', label: 'גלריה', hint: 'תמונות וסרטונים' },
      { href: '/articles', label: 'מאמרים', hint: 'מדריכים למי שמגיע' },
    ],
  },
  { href: '/ask', label: 'שאלו אותנו' },
];

function isActive(pathname: string, item: NavItem): boolean {
  if (pathname === item.href) return true;
  return item.children?.some((c) => pathname === c.href) ?? false;
}

/**
 * Opens on hover for a mouse, on tap for a finger, and on Enter for a
 * keyboard. Hover alone would leave the group unreachable on a phone, and
 * click alone would feel broken on a desktop.
 */
function Dropdown({ item, pathname }: { item: NavItem; pathname: string }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const menuId = useId();
  const active = isActive(pathname, item);

  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onDown = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };

    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDown);
    };
  }, [open]);

  // A small grace period, so crossing the gap to the panel does not close it.
  const scheduleClose = () => {
    closeTimer.current = setTimeout(() => setOpen(false), 160);
  };
  const cancelClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  };

  return (
    <div
      ref={wrap}
      className="relative"
      onPointerEnter={(e) => {
        if (e.pointerType === 'mouse') {
          cancelClose();
          setOpen(true);
        }
      }}
      onPointerLeave={(e) => {
        if (e.pointerType === 'mouse') scheduleClose();
      }}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-1 rounded-pill px-3.5 py-2 text-sm font-medium transition-colors ${
          active ? 'bg-surface text-fg' : 'text-fg-muted hover:bg-surface hover:text-fg'
        }`}
      >
        {item.label}
        <svg
          width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          aria-hidden="true"
          className={`transition-transform ${open ? 'rotate-180' : ''}`}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      <div
        id={menuId}
        onPointerEnter={cancelClose}
        onPointerLeave={(e) => {
          if (e.pointerType === 'mouse') scheduleClose();
        }}
        /* start-0 anchors the panel's leading edge — the right one in
           Hebrew — so it opens leftward into the page instead of outward
           past the trigger. */
        className={`absolute start-0 top-full z-50 w-[190px] pt-2 transition-all ${
          open
            ? 'visible translate-y-0 opacity-100'
            : 'invisible -translate-y-1 opacity-0'
        }`}
      >
        <ul className="overflow-hidden rounded-card border border-line bg-bg p-1.5 shadow-float">
          {item.children!.map((c) => (
            <li key={c.href}>
              <Link
                href={c.href}
                onClick={() => setOpen(false)}
                className={`block rounded-input px-3 py-2 text-[.86rem] transition-colors ${
                  pathname === c.href ? 'bg-accent-soft font-medium' : 'hover:bg-surface'
                }`}
              >
                {/* The hints are gone: four labels this plain explain
                    themselves, and the second line doubled the panel's
                    height for no one. */}
                {c.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function DesktopNav() {
  const pathname = usePathname();

  return (
    <nav className="ms-2 flex gap-1 max-[1000px]:hidden" aria-label="ראשי">
      {NAV.map((item) =>
        item.children ? (
          <Dropdown key={item.href} item={item} pathname={pathname} />
        ) : (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded-pill px-3.5 py-2 text-sm font-medium transition-colors ${
              isActive(pathname, item)
                ? 'bg-surface text-fg'
                : 'text-fg-muted hover:bg-surface hover:text-fg'
            }`}
          >
            {item.label}
          </Link>
        ),
      )}
    </nav>
  );
}

/**
 * Below 1000px the bar has no room for the links at all. Until now that
 * meant a phone had no navigation beyond the logo — every page was reachable
 * only from the home page.
 */
export function MobileNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

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

  const flat = NAV.flatMap((i) => (i.children ? i.children : [{ ...i, hint: undefined }]));

  return (
    <div className="min-[1000px]:hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={open ? 'סגירת התפריט' : 'פתיחת התפריט'}
        className="grid size-[38px] place-items-center rounded-full border border-line-strong text-fg hover:bg-surface"
      >
        {open ? (
          <Icon name="x" size={17} />
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        )}
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 top-[68px] z-40 bg-black/30 max-[620px]:top-[62px]"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <nav
            aria-label="ראשי"
            className="fixed inset-x-0 top-[68px] z-50 max-h-[calc(100dvh-68px)] overflow-y-auto border-b border-line bg-bg p-4 shadow-float max-[620px]:top-[62px] max-[620px]:max-h-[calc(100dvh-62px)]"
          >
            <ul className="flex flex-col gap-1">
              {flat.map((c) => (
                <li key={c.href + c.label}>
                  <Link
                    href={c.href}
                    onClick={() => setOpen(false)}
                    className={`flex flex-col gap-0.5 rounded-input px-4 py-3 ${
                      pathname === c.href ? 'bg-accent-soft' : 'hover:bg-surface'
                    }`}
                  >
                    <span className="font-medium">{c.label}</span>
                    {'hint' in c && c.hint && (
                      <span className="text-[.76rem] text-fg-subtle">{c.hint}</span>
                    )}
                  </Link>
                </li>
              ))}
              <li className="mt-1 border-t border-line pt-2">
                <Link
                  href="/donate"
                  onClick={() => setOpen(false)}
                  className="flex rounded-input px-4 py-3 font-medium hover:bg-surface"
                >
                  תרומה
                </Link>
              </li>
            </ul>
          </nav>
        </>
      )}
    </div>
  );
}
