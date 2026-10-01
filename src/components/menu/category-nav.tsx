'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Sticky category rail.
 *
 * On a phone the menu is long enough that the categories scroll out of
 * reach almost immediately, leaving no way to jump between them. This stays
 * under the header and highlights whichever section is in view.
 */
export function CategoryNav({
  categories,
}: {
  categories: { id: string; label: string }[];
}) {
  const [active, setActive] = useState(categories[0]?.id ?? '');
  const rail = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (categories.length === 0) return;

    const sections = categories
      .map((c) => document.getElementById(`cat-${c.id}`))
      .filter((el): el is HTMLElement => el !== null);

    if (sections.length === 0) return;

    const io = new IntersectionObserver(
      (entries) => {
        // The topmost section currently intersecting wins, so scrolling up
        // and down both land on the heading you can actually see.
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id.replace('cat-', ''));
      },
      // Top band only: a section counts as "current" once its heading is
      // near the top, not when its last item is still on screen.
      { rootMargin: '-120px 0px -65% 0px', threshold: 0 },
    );

    sections.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, [categories]);

  // Keep the active chip in view when the page scrolls it out of the rail.
  useEffect(() => {
    const el = rail.current?.querySelector<HTMLElement>(`[data-cat="${active}"]`);
    el?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  }, [active]);

  if (categories.length < 2) return null;

  return (
    <div className="sticky top-[68px] z-30 -mx-5 border-b border-line bg-bg/95 backdrop-blur-md max-[620px]:top-[62px]">
      <div
        ref={rail}
        className="flex gap-2 overflow-x-auto px-5 py-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {categories.map((c) => {
          const on = active === c.id;
          return (
            <a
              key={c.id}
              href={`#cat-${c.id}`}
              data-cat={c.id}
              onClick={(e) => {
                e.preventDefault();
                const el = document.getElementById(`cat-${c.id}`);
                if (!el) return;
                // scroll-margin on the heading handles the sticky offset.
                el.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
              className={`shrink-0 rounded-pill px-3.5 py-1.5 text-[.85rem] font-medium whitespace-nowrap transition-colors ${
                on
                  ? 'bg-accent text-fg-on-accent'
                  : 'bg-surface text-fg-muted hover:text-fg'
              }`}
            >
              {c.label}
            </a>
          );
        })}
      </div>
    </div>
  );
}
