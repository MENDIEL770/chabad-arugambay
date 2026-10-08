'use client';

import { useMemo, useState } from 'react';
import { Icon } from '@/components/ui/icon';
import type { KosherCategory, KosherProduct } from '@/lib/data/kosher';
import { STATUS, STATUS_ORDER, fold, searchable } from '@/lib/data/kosher-view';

export function KosherSearch({
  categories, products,
}: {
  categories: KosherCategory[];
  products: KosherProduct[];
}) {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<string>('all');
  const [status, setStatus] = useState<string>('all');

  const shown = useMemo(() => {
    const needle = fold(q);
    return products.filter((p) => {
      if (cat !== 'all' && p.categoryId !== cat) return false;
      if (status !== 'all' && p.status !== status) return false;
      return !needle || searchable(p).includes(needle);
    });
  }, [products, q, cat, status]);

  /** Grouped under headings, so a long list stays navigable. */
  const groups = useMemo(() => {
    const byCat = new Map<string, KosherProduct[]>();
    for (const p of shown) {
      const key = p.categoryId ?? '';
      if (!byCat.has(key)) byCat.set(key, []);
      byCat.get(key)!.push(p);
    }
    // Categories in their configured order; anything unassigned last.
    const ordered: { id: string; name: string; items: KosherProduct[] }[] = [];
    for (const c of categories) {
      const items = byCat.get(c.id);
      if (items?.length) ordered.push({ id: c.id, name: c.name.he, items });
    }
    const loose = byCat.get('');
    if (loose?.length) ordered.push({ id: '', name: 'שונות', items: loose });
    return ordered;
  }, [shown, categories]);

  return (
    <div className="flex flex-col gap-5">
      <div className="sticky top-16 z-20 -mx-4 bg-bg/92 px-4 py-3 backdrop-blur">
        <label className="relative block">
          <span className="sr-only">חיפוש מוצר</span>
          <span className="pointer-events-none absolute inset-y-0 start-3 grid place-items-center text-fg-subtle">
            <Icon name="search" size={17} />
          </span>
          <input
            className="field !ps-10"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="שם המוצר, מותג או ברקוד"
            type="search"
            enterKeyHint="search"
            autoComplete="off"
          />
        </label>

        <div className="mt-2 flex flex-wrap gap-1.5">
          <button
            type="button"
            className={`btn btn-sm ${cat === 'all' && status === 'all' ? 'btn-accent' : 'btn-ghost'}`}
            onClick={() => { setCat('all'); setStatus('all'); }}
          >
            הכל
          </button>

          {STATUS_ORDER.map((s) => (
            <button
              key={s}
              type="button"
              className={`btn btn-sm ${status === s ? 'btn-accent' : 'btn-ghost'}`}
              onClick={() => setStatus(status === s ? 'all' : s)}
            >
              {STATUS[s].label}
            </button>
          ))}

          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`btn btn-sm ${cat === c.id ? 'btn-accent' : 'btn-ghost'}`}
              onClick={() => setCat(cat === c.id ? 'all' : c.id)}
            >
              {c.name.he}
              <span className="clock text-fg-subtle"> {c.count}</span>
            </button>
          ))}
        </div>
      </div>

      {shown.length === 0 ? (
        <div className="card text-center">
          <p className="font-medium">
            {products.length === 0 ? 'הרשימה עוד נבנית.' : 'לא מצאנו את המוצר הזה.'}
          </p>
          {/* An absence is not an answer, and saying so is the honest
              thing: a shopper must not read "not listed" as "kosher" or
              as "forbidden". */}
          <p className="mt-1 text-[.86rem] text-fg-muted">
            מוצר שלא מופיע כאן פשוט עוד לא נבדק — זה לא אומר שהוא כשר ולא
            שהוא אסור. שלחו לנו הודעה ונבדוק.
          </p>
          <a
            href="https://wa.me/94761234567"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-accent btn-sm mt-3"
          >
            <Icon name="whatsapp" size={15} />
            שאלו אותנו על מוצר
          </a>
        </div>
      ) : (
        groups.map((g) => (
          <section key={g.id}>
            <h2 className="mb-2 text-[.8rem] font-medium uppercase tracking-[.1em] text-fg-subtle">
              {g.name}
            </h2>
            <ul className="flex flex-col gap-2">
              {g.items.map((p) => (
                <li key={p.id} className="card flex items-start gap-3 !p-3.5">
                  {p.imageUrl ? (
                    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-input border border-line">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.imageUrl} alt="" loading="lazy" className="size-full object-cover" />
                    </div>
                  ) : (
                    <span className="grid size-12 shrink-0 place-items-center rounded-input bg-surface-sunk text-fg-subtle">
                      <Icon name="dish" size={18} />
                    </span>
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <b className="leading-snug">{p.name.he}</b>
                      <span className={`chip ${STATUS[p.status].chip}`}>{STATUS[p.status].label}</span>
                    </div>

                    {(p.brand || p.name.en) && (
                      <span className="ltr block text-start text-[.8rem] text-fg-muted">
                        {[p.brand, p.name.en].filter(Boolean).join(' · ')}
                      </span>
                    )}

                    {(p.certification || p.kosherType) && (
                      <span className="block text-[.82rem] text-fg-muted">
                        {[p.certification, p.kosherType].filter(Boolean).join(' · ')}
                      </span>
                    )}

                    {p.notes.he && (
                      <p className="mt-0.5 text-[.82rem] text-accent-strong">{p.notes.he}</p>
                    )}

                    {(p.whereToBuy || p.verifiedOn) && (
                      <span className="mt-0.5 block text-[.72rem] text-fg-subtle">
                        {p.whereToBuy}
                        {p.whereToBuy && p.verifiedOn && ' · '}
                        {p.verifiedOn && <>נבדק <span className="clock">{p.verifiedOn}</span></>}
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}

      <p className="text-[.78rem] text-fg-subtle">
        הרשימה נבדקת ומתעדכנת. יצרן יכול לשנות הרכב בלי להודיע — אם התאריך
        ליד מוצר ישן, שווה לשאול שוב.
      </p>
    </div>
  );
}
