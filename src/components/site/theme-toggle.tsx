'use client';

import { useState } from 'react';
import { Icon } from '@/components/ui/icon';

/**
 * Explicit viewer choice, overriding the OS preference.
 *
 * The saved theme is applied by an inline script in the document head before
 * first paint (see layout.tsx), not from an effect here — an effect runs
 * after paint, so a viewer who chose dark would see a white flash on every
 * navigation.
 */
export function ThemeToggle() {
  // Nothing is read during render: the DOM already carries the answer, and
  // reading it here would differ between server and client.
  const [, force] = useState(0);

  function toggle() {
    const root = document.documentElement;
    const current =
      root.dataset.theme ??
      (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const next = current === 'dark' ? 'light' : 'dark';
    root.dataset.theme = next;
    try {
      localStorage.setItem('theme', next);
    } catch {
      // Private mode or blocked storage: the choice just will not persist.
    }
    force((n) => n + 1);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="החלף בין מצב בהיר לכהה"
      className="grid size-[38px] place-items-center rounded-full border border-line-strong text-fg hover:bg-surface max-[520px]:hidden"
    >
      <Icon name="contrast" size={18} />
    </button>
  );
}
