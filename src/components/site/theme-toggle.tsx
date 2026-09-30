'use client';

import { useEffect, useState } from 'react';

/** Explicit viewer choice, persisted, overriding the OS preference. */
export function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark' | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('theme');
    if (saved === 'light' || saved === 'dark') {
      setTheme(saved);
      document.documentElement.dataset.theme = saved;
    }
  }, []);

  function toggle() {
    const current =
      theme ?? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const next = current === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.dataset.theme = next;
    localStorage.setItem('theme', next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="החלף בין מצב בהיר לכהה"
      className="grid size-[38px] place-items-center rounded-full border border-line-strong text-fg hover:bg-surface max-[520px]:hidden"
    >
      ◐
    </button>
  );
}
