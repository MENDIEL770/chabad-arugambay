'use client';

import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/ui/icon';

type Setting = 'fontScale' | 'contrast' | 'underlineLinks' | 'stopMotion' | 'readableFont';

interface Prefs {
  fontScale: number;
  contrast: boolean;
  underlineLinks: boolean;
  stopMotion: boolean;
  readableFont: boolean;
}

const DEFAULTS: Prefs = {
  fontScale: 1,
  contrast: false,
  underlineLinks: false,
  stopMotion: false,
  readableFont: false,
};

const STORE = 'a11y';

/**
 * Accessibility controls.
 *
 * Applied as data attributes and a custom property on <html>, with the
 * actual styling in globals.css — so a preference survives navigation
 * without React having to re-apply it, and nothing flashes while the page
 * loads. Israeli sites are required to offer this; it is also simply
 * useful on a beach in bright sun.
 */
export function AccessibilityMenu() {
  const [open, setOpen] = useState(false);
  /**
   * Seeded from what the pre-paint script already applied, rather than
   * loaded in an effect. An effect would mean a cascading render and, more
   * visibly, a flash of normal contrast before the saved setting took hold.
   */
  const [prefs, setPrefs] = useState<Prefs>(() => {
    if (typeof document === 'undefined') return DEFAULTS;
    try {
      return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(STORE) ?? '{}') };
    } catch {
      return DEFAULTS;
    }
  });
  const panel = useRef<HTMLDivElement>(null);

  // Mirror every change back to the DOM and to storage.
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--a11y-scale', String(prefs.fontScale));
    root.dataset.a11yContrast = prefs.contrast ? 'on' : '';
    root.dataset.a11yUnderline = prefs.underlineLinks ? 'on' : '';
    root.dataset.a11yStopMotion = prefs.stopMotion ? 'on' : '';
    root.dataset.a11yReadable = prefs.readableFont ? 'on' : '';
    try {
      localStorage.setItem(STORE, JSON.stringify(prefs));
    } catch {
      /* ignore */
    }
  }, [prefs]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    const onDown = (e: PointerEvent) => {
      if (!panel.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDown);
    };
  }, [open]);

  /**
   * Step the font scale from the current state rather than from the value
   * captured when the button rendered. Two quick taps on "+" both read the
   * same closed-over `prefs` and the second did nothing.
   */
  const stepScale = (delta: number) =>
    setPrefs((p) => ({
      ...p,
      fontScale: Math.min(1.5, Math.max(0.9, +(p.fontScale + delta).toFixed(2))),
    }));

  const toggles: { key: Setting; label: string; on: boolean }[] = [
    { key: 'contrast', label: 'ניגודיות גבוהה', on: prefs.contrast },
    { key: 'underlineLinks', label: 'הדגשת קישורים', on: prefs.underlineLinks },
    { key: 'stopMotion', label: 'עצירת אנימציות', on: prefs.stopMotion },
    { key: 'readableFont', label: 'פונט קריא', on: prefs.readableFont },
  ];

  return (
    <div ref={panel}>
      {open && (
        <div
          role="dialog"
          aria-label="הגדרות נגישות"
          className="fixed bottom-[8.5rem] start-4 z-[70] w-[260px] rounded-card border border-line bg-bg p-4 shadow-float"
        >
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-bold">נגישות</h2>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="סגירה"
              className="grid size-7 place-items-center rounded-full hover:bg-surface"
            >
              <Icon name="x" size={15} />
            </button>
          </div>

          <div className="mb-3">
            <span className="label !mb-1.5">גודל טקסט</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => stepScale(-0.1)}
                className="btn btn-ghost btn-sm !px-3"
                aria-label="הקטנת טקסט"
              >
                −
              </button>
              <span className="clock flex-1 text-center text-[.9rem]">
                {Math.round(prefs.fontScale * 100)}%
              </span>
              <button
                type="button"
                onClick={() => stepScale(0.1)}
                className="btn btn-ghost btn-sm !px-3"
                aria-label="הגדלת טקסט"
              >
                +
              </button>
            </div>
          </div>

          <ul className="flex flex-col gap-1">
            {toggles.map((t) => (
              <li key={t.key}>
                <button
                  type="button"
                  onClick={() => setPrefs((p) => ({ ...p, [t.key]: !p[t.key] }))}
                  aria-pressed={t.on}
                  className={`flex w-full items-center justify-between rounded-input px-3 py-2 text-[.88rem] transition-colors ${
                    t.on ? 'bg-accent-soft font-medium' : 'hover:bg-surface'
                  }`}
                >
                  {t.label}
                  <span
                    className={`grid size-4 place-items-center rounded-full border text-[.6rem] ${
                      t.on ? 'border-accent bg-accent text-fg-on-accent' : 'border-line-strong'
                    }`}
                  >
                    {t.on ? '✓' : ''}
                  </span>
                </button>
              </li>
            ))}
          </ul>

          <button
            type="button"
            onClick={() => setPrefs(DEFAULTS)}
            className="mt-3 w-full text-[.8rem] text-fg-subtle hover:underline"
          >
            איפוס
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label="הגדרות נגישות"
        className="fixed bottom-4 start-4 z-[60] grid size-12 place-items-center rounded-full border border-line-strong bg-bg text-fg shadow-float transition-transform hover:scale-105"
      >
        {/* The standard accessibility figure, so it is recognised without a label. */}
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="12" cy="4.2" r="2.1" />
          <path d="M20 7.4c0 .6-.5 1.1-1.1 1.1-1.9 0-3.6-.3-5-.6v2.6l3.4 9.1a1.15 1.15 0 1 1-2.1.8L12.4 14h-.8l-2.8 6.4a1.15 1.15 0 1 1-2.1-.8l3.4-9.1V7.9c-1.4.3-3.1.6-5 .6a1.1 1.1 0 1 1 0-2.2c2.6 0 4.9-.7 5.8-1a2.7 2.7 0 0 1 1.1-.2c.4 0 .8.1 1.1.2.9.3 3.2 1 5.8 1 .6 0 1.1.5 1.1 1.1Z" />
        </svg>
      </button>
    </div>
  );
}
