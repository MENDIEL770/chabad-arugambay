'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  KB, describeDish, matchDish, searchKb,
  type DishFact, type KbFacts,
} from '@/lib/data/kb';

const SUGGESTIONS = [
  'עד מתי אפשר להירשם?',
  'מתי הדלקת נרות?',
  'כמה עולה שקשוקה?',
  'יש משלוחים?',
  'אפשר לישון אצלכם?',
];

export function AskBox({ facts, dishes }: { facts: KbFacts; dishes: DishFact[] }) {
  const [q, setQ] = useState('');
  const asked = q.trim().length > 0;
  const results = useMemo(() => (asked ? searchKb(q) : KB), [q, asked]);
  const dish = useMemo(() => (asked ? matchDish(q, dishes) : null), [q, asked, dishes]);

  return (
    <>
      <div className="mb-4">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="field !rounded-pill w-full !px-5 !py-4 !text-[1rem]"
          placeholder="מה רציתם לשאול?"
          aria-label="שאלה"
        />
      </div>

      <div className="mb-8 flex flex-wrap gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setQ(s)}
            className="rounded-pill border border-line-strong bg-bg px-3.5 py-1.5 text-[.82rem] text-fg-muted transition-colors hover:bg-surface hover:text-fg"
          >
            {s}
          </button>
        ))}
      </div>

      {dish && (
        <div className="card mb-3 border-accent bg-accent-soft">
          <h2 className="font-bold">{dish.nameHe}</h2>
          <p className="mt-2 text-[.94rem] leading-relaxed">{describeDish(dish)}</p>
          <Link
            href="/menu"
            className="mt-3 inline-flex items-center gap-1.5 text-[.85rem] font-medium text-accent-strong hover:underline"
          >
            לתפריט ולהזמנה
            <span aria-hidden="true">←</span>
          </Link>
        </div>
      )}

      {asked && results.length === 0 && !dish ? (
        <div className="card">
          <p className="font-medium">אין לנו תשובה מוכנה לזה.</p>
          <p className="mt-1.5 text-sm text-fg-muted">
            שלחו לנו בוואטסאפ ונענה — ואם זו שאלה שחוזרת, נוסיף אותה לכאן.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {results.map((entry) => (
            <li key={entry.id} className="card">
              <h2 className="font-bold">{entry.question.he}</h2>
              <p className="mt-2 text-[.94rem] leading-relaxed text-fg-muted">
                {entry.answer(facts)}
              </p>
              {entry.link && (
                <Link
                  href={entry.link.href}
                  className="mt-3 inline-flex items-center gap-1.5 text-[.85rem] font-medium text-accent-strong hover:underline"
                >
                  {entry.link.label}
                  <span aria-hidden="true">←</span>
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
