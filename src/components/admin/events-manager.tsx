'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { DateTime } from 'luxon';
import { Icon } from '@/components/ui/icon';
import type { EventRecord } from '@/lib/data/events';
import { generateEvents, type ActionResult } from '@/app/admin/events/actions';
import { runAction } from '@/lib/run-action';

export function EventsManager({
  events,
  registrationCounts,
}: {
  events: EventRecord[];
  registrationCounts: Record<string, number>;
}) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);

  return (
    <div className="flex flex-col gap-5">
      <div className="card flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-bold">פתיחת שבתות וחגים</h2>
          <p className="mt-1 max-w-[52ch] text-[.84rem] text-fg-muted">
            פותח טפסי הרשמה ל-24 המועדים הבאים, עם סעודות ומחירי ברירת מחדל.
            אפשר ללחוץ שוב בכל עת — אירוע שכבר קיים לא נוצר פעמיים, ואירוע
            שערכתם ידנית לא ישתנה.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-accent"
          disabled={pending}
          onClick={() =>
            start(async () => setResult(await runAction(() => generateEvents(24)) as ActionResult))
          }
        >
          {pending ? 'פותח…' : 'פתחו 24 מועדים'}
        </button>
      </div>

      {result && (
        <p
          role="status"
          className={`rounded-input px-3 py-2 text-[.85rem] ${
            result.ok ? 'bg-accent-soft' : 'bg-danger/10 text-danger'
          }`}
        >
          {result.message}
        </p>
      )}

      {events.length === 0 ? (
        <p className="card text-sm text-fg-muted">
          אין עדיין אירועים פתוחים. לחצו על הכפתור למעלה.
        </p>
      ) : (
        <ul className="overflow-hidden rounded-card border border-line bg-bg">
          {events.map((e) => {
            const count = registrationCounts[e.id] ?? 0;
            return (
              <li
                key={e.id}
                className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-line px-5 py-4 last:border-b-0 hover:bg-surface"
              >
                <div className="min-w-[14rem] flex-1">
                  <div className="flex flex-wrap items-baseline gap-2.5">
                    <b className="font-medium">{e.title.he}</b>
                    <span className="chip">{e.kind === 'shabbat' ? 'שבת' : 'חג'}</span>
                    {e.handEdited && <span className="chip chip-kosher">נערך ידנית</span>}
                    <span className="clock text-[.8rem] text-fg-subtle">
                      {DateTime.fromISO(e.erevOn).toFormat('dd/MM')}–
                      {DateTime.fromISO(e.endsOn).toFormat('dd/MM')}
                    </span>
                  </div>
                </div>

                <div className="text-center">
                  <span className="block text-[.72rem] text-fg-subtle">נרשמו</span>
                  <span className="clock font-bold">{count}</span>
                </div>

                <div className="flex gap-2">
                  <Link href={`/admin/events/${e.id}`} className="btn btn-accent btn-sm">
                    נרשמים
                  </Link>
                  <Link href={`/f/${e.slug}`} className="btn btn-ghost btn-sm">
                    <Icon name="arrow" size={14} />
                    לטופס
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
