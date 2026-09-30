'use client';

import { useMemo, useState } from 'react';
import {
  STAYS, TIPS, TIER_LABEL, type TravelTier,
} from '@/lib/data/content';

const TIERS: TravelTier[] = ['luxury', 'standard', 'backpacker', 'family'];

/** Fold Hebrew final letters so "מקום"/"מקומ" both match. */
function normalise(s: string): string {
  return s
    .toLowerCase()
    .replace(/[ךםןףץ]/g, (c) => ({ ך: 'כ', ם: 'מ', ן: 'נ', ף: 'פ', ץ: 'צ' })[c]!)
    .replace(/["'״׳]/g, '');
}

export function TravelSearch() {
  const [q, setQ] = useState('');
  const [tier, setTier] = useState<TravelTier | null>(null);

  const needle = normalise(q.trim());

  const stays = useMemo(
    () =>
      STAYS.filter((s) => {
        if (tier && !s.tiers.includes(tier)) return false;
        if (!needle) return true;
        return normalise(`${s.name} ${s.blurb.he} ${s.blurb.en}`).includes(needle);
      }),
    [needle, tier],
  );

  const tips = useMemo(
    () =>
      TIPS.filter((t) =>
        !needle ? true : normalise(`${t.title.he} ${t.body.he} ${t.tags.join(' ')}`).includes(needle),
      ),
    [needle],
  );

  const nothing = stays.length === 0 && tips.length === 0;

  return (
    <>
      <div className="mb-5 flex flex-wrap gap-2.5">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="field !rounded-pill min-w-[240px] flex-1 !px-5 !py-3.5"
          placeholder="מה אתם מחפשים? ״ספוט לגלישה למתחילים״, ״מקום זול לישון״…"
          aria-label="חיפוש המלצות"
        />
      </div>

      <div className="mb-7 flex flex-wrap gap-2" role="group" aria-label="רמת תקציב">
        {TIERS.map((t) => {
          const on = tier === t;
          return (
            <button
              key={t}
              type="button"
              aria-pressed={on}
              onClick={() => setTier(on ? null : t)}
              className={`rounded-pill border px-4 py-2 text-[.86rem] font-medium transition-colors ${
                on
                  ? 'border-accent bg-accent text-fg-on-accent'
                  : 'border-line-strong bg-bg text-fg-muted hover:bg-surface hover:text-fg'
              }`}
            >
              {TIER_LABEL[t]}
            </button>
          );
        })}
      </div>

      {nothing && (
        <p className="card text-sm text-fg-muted">
          לא מצאנו כלום ל״{q}״. נסו מילה אחרת, או שאלו אותנו בוואטסאפ — נענה.
        </p>
      )}

      {stays.length > 0 && (
        <>
          <h2 className="mb-3 text-lg font-bold">איפה לישון</h2>
          <ul className="mb-9 grid grid-cols-3 gap-4 max-[900px]:grid-cols-2 max-[620px]:grid-cols-1">
            {stays.map((s) => (
              <li key={s.id} className="card flex gap-3.5 !p-4">
                <span className="grid size-16 shrink-0 place-items-center rounded-xl bg-surface-sunk text-2xl" aria-hidden="true">
                  {s.icon}
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <b className="ltr text-[1rem] font-bold">{s.name}</b>
                  <p className="text-[.85rem] text-fg-muted">{s.blurb.he}</p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2">
                    {s.tiers.map((t) => (
                      <span key={t} className="chip">{TIER_LABEL[t]}</span>
                    ))}
                    <span className="text-[.85rem]">
                      <span className="money">${s.nightlyUsd}</span> ללילה
                    </span>
                  </div>
                  {s.walkMinutes !== null && (
                    <span className="text-[.75rem] text-fg-subtle">
                      {s.walkMinutes} דק׳ הליכה מבית חב״ד
                    </span>
                  )}
                  {/* No link until the affiliate id exists — see content.ts */}
                  <span className="text-[.7rem] text-fg-subtle">
                    קישור הזמנה ב-Booking יתווסף בקרוב
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {tips.length > 0 && (
        <>
          <h2 className="mb-3 text-lg font-bold">מה לעשות</h2>
          <ul className="grid grid-cols-2 gap-4 max-[760px]:grid-cols-1">
            {tips.map((t) => (
              <li key={t.id} className="card flex gap-3.5 !p-4">
                <span className="grid size-11 shrink-0 place-items-center rounded-input bg-accent-soft text-xl" aria-hidden="true">
                  {t.icon}
                </span>
                <div className="flex min-w-0 flex-col gap-1">
                  <b className="font-medium">{t.title.he}</b>
                  <p className="text-[.85rem] text-fg-muted">{t.body.he}</p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {t.tags.map((tag) => <span key={tag} className="chip">{tag}</span>)}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
