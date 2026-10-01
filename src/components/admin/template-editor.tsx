'use client';

import { useState, useTransition } from 'react';
import type { EventTemplate, TemplateMeal } from '@/lib/data/event-template';
import { runAction } from '@/lib/run-action';
import {
  saveEventTemplate, type ActionResult, type TemplateInput,
} from '@/app/admin/events/template-actions';

const KINDS = [
  { v: 'adult', l: 'מבוגר' },
  { v: 'child', l: 'ילד' },
  { v: 'infant', l: 'תינוק' },
  { v: 'donation', l: 'תרומה' },
] as const;

/** Offsets are stored relative to candle lighting; shown as hours. */
const asHours = (min: number) => (min / 60).toFixed(1).replace(/\.0$/, '');

/**
 * The defaults every newly generated form starts from.
 *
 * Changing these does not touch forms that already exist — rewriting live
 * forms would alter prices under people who already registered. The next
 * batch the generator creates picks them up.
 */
export function TemplateEditor({ template }: { template: EventTemplate }) {
  const [t, setT] = useState<EventTemplate>(template);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();

  const patchMeal = (i: number, p: Partial<TemplateMeal>) =>
    setT((prev) => ({
      ...prev,
      meals: prev.meals.map((m, j) => (j === i ? { ...m, ...p } : m)),
    }));

  const patchType = (mi: number, ti: number, p: Partial<TemplateMeal['types'][number]>) =>
    setT((prev) => ({
      ...prev,
      meals: prev.meals.map((m, j) =>
        j === mi ? { ...m, types: m.types.map((x, k) => (k === ti ? { ...x, ...p } : x)) } : m,
      ),
    }));

  const submit = () => {
    const input: TemplateInput = {
      introHe: t.intro.he,
      introEn: t.intro.en,
      meals: t.meals.map((m) => ({
        key: m.key,
        nameHe: m.name.he,
        nameEn: m.name.en,
        servesOffsetMin: m.servesOffsetMin,
        capacity: m.capacity ?? '',
        types: m.types.map((x) => ({
          nameHe: x.name.he,
          nameEn: x.name.en,
          kind: x.kind,
          price: x.price,
          seats: x.seats,
        })),
      })),
      askEmail: t.askEmail,
      askNationality: t.askNationality,
      askNotes: t.askNotes,
      askParticipants: t.askParticipants,
      donationAmounts: t.donationAmounts,
      weeksAhead: t.weeksAhead,
      closesHoursBefore: t.closesHoursBefore,
    };
    start(async () => setResult(await runAction(() => saveEventTemplate(input)) as ActionResult));
  };

  return (
    <div className="flex flex-col gap-5">
      <p className="rounded-input bg-accent-soft px-4 py-3 text-[.84rem]">
        <b>אלה ברירות המחדל לטפסים חדשים.</b> שינוי כאן לא נוגע בטפסים
        שכבר קיימים — אחרת מחיר היה משתנה מתחת למי שכבר נרשם. לעריכת טופס
        בודד יש כפתור ״ערוך״ לידו ברשימה.
      </p>

      <section className="card">
        <h2 className="mb-3 font-bold">טקסט פתיחה</h2>
        <div className="grid grid-cols-2 gap-3 max-[700px]:grid-cols-1">
          <label>
            <span className="label !mb-1">עברית</span>
            <textarea
              className="field" rows={2} value={t.intro.he}
              onChange={(e) => setT({ ...t, intro: { ...t.intro, he: e.target.value } })}
            />
          </label>
          <label>
            <span className="label !mb-1">English</span>
            <textarea
              className="field ltr" rows={2} value={t.intro.en}
              onChange={(e) => setT({ ...t, intro: { ...t.intro, en: e.target.value } })}
            />
          </label>
        </div>
      </section>

      {t.meals.map((m, mi) => (
        <section key={m.key} className="card">
          <h2 className="mb-3 font-bold">{m.name.he}</h2>

          <div className="mb-4 grid grid-cols-3 gap-3 max-[700px]:grid-cols-1">
            <label>
              <span className="label !mb-1">שם הסעודה</span>
              <input
                className="field" value={m.name.he}
                onChange={(e) => patchMeal(mi, { name: { ...m.name, he: e.target.value } })}
              />
            </label>
            <label>
              <span className="label !mb-1">שעות אחרי הדלקת נרות</span>
              <input
                className="field money" inputMode="decimal" value={asHours(m.servesOffsetMin)}
                onChange={(e) =>
                  patchMeal(mi, { servesOffsetMin: Math.round(Number(e.target.value || 0) * 60) })
                }
              />
              <span className="mt-1 block text-[.72rem] text-fg-subtle">
                יחסי, כדי שהסעודה תישאר במקומה כשהשקיעה זזה לאורך השנה.
              </span>
            </label>
            <label>
              <span className="label !mb-1">קיבולת</span>
              <input
                className="field money" inputMode="numeric" placeholder="ללא הגבלה"
                value={m.capacity ?? ''}
                onChange={(e) =>
                  patchMeal(mi, { capacity: e.target.value === '' ? null : Number(e.target.value) })
                }
              />
            </label>
          </div>

          <h3 className="mb-2 text-[.85rem] font-medium text-fg-muted">סוגי נרשמים</h3>
          <ul className="flex flex-col gap-2">
            {m.types.map((x, ti) => (
              <li key={ti} className="flex flex-wrap items-end gap-2">
                <label className="min-w-[10rem] flex-1">
                  <span className="label !mb-1">שם</span>
                  <input
                    className="field" value={x.name.he}
                    onChange={(e) => patchType(mi, ti, { name: { ...x.name, he: e.target.value } })}
                  />
                </label>
                <label className="w-28">
                  <span className="label !mb-1">סוג</span>
                  <select
                    className="field" value={x.kind}
                    onChange={(e) => patchType(mi, ti, { kind: e.target.value as typeof x.kind })}
                  >
                    {KINDS.map((k) => <option key={k.v} value={k.v}>{k.l}</option>)}
                  </select>
                </label>
                <label className="w-24">
                  <span className="label !mb-1">מחיר ₪</span>
                  <input
                    className="field money" inputMode="decimal" value={x.price}
                    onChange={(e) => patchType(mi, ti, { price: Number(e.target.value || 0) })}
                  />
                </label>
                <label className="w-24">
                  <span className="label !mb-1">מקומות</span>
                  <input
                    className="field money" inputMode="numeric" value={x.seats}
                    onChange={(e) => patchType(mi, ti, { seats: Number(e.target.value || 0) })}
                  />
                </label>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <section className="card">
        <h2 className="mb-3 font-bold">מה לשאול בטופס</h2>
        <div className="flex flex-col gap-2">
          {([
            ['askParticipants', 'שמות כל המשתתפים'],
            ['askEmail', 'כתובת מייל'],
            ['askNationality', 'מאיפה הם'],
            ['askNotes', 'הערות ואלרגיות'],
          ] as const).map(([key, label]) => (
            <label key={key} className="flex items-center gap-2.5 text-[.9rem]">
              <input
                type="checkbox" className="size-4 accent-[var(--accent)]"
                checked={t[key]}
                onChange={(e) => setT({ ...t, [key]: e.target.checked })}
              />
              {label}
            </label>
          ))}
        </div>
      </section>

      <section className="card">
        <h2 className="mb-3 font-bold">המחולל</h2>
        <div className="grid grid-cols-2 gap-3 max-[700px]:grid-cols-1">
          <label>
            <span className="label !mb-1">כמה שבתות לפתוח מראש</span>
            <input
              className="field money" inputMode="numeric" value={t.weeksAhead}
              onChange={(e) => setT({ ...t, weeksAhead: Number(e.target.value || 0) })}
            />
          </label>
          <label>
            <span className="label !mb-1">ההרשמה נסגרת (שעות לפני)</span>
            <input
              className="field money" inputMode="numeric" value={t.closesHoursBefore}
              onChange={(e) => setT({ ...t, closesHoursBefore: Number(e.target.value || 0) })}
            />
          </label>
          <label className="col-span-2 max-[700px]:col-span-1">
            <span className="label !mb-1">סכומי תרומה מוצעים (מופרדים בפסיק)</span>
            <input
              className="field money ltr"
              value={t.donationAmounts.join(', ')}
              onChange={(e) =>
                setT({
                  ...t,
                  donationAmounts: e.target.value
                    .split(',').map((n) => Number(n.trim())).filter((n) => Number.isFinite(n)),
                })
              }
            />
          </label>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="btn btn-accent" disabled={pending} onClick={submit}>
          {pending ? 'שומר…' : 'שמירת ברירות המחדל'}
        </button>
        {result?.message && (
          <span className={`text-[.84rem] ${result.ok ? 'text-ok' : 'text-danger'}`}>
            {result.message}
          </span>
        )}
      </div>
    </div>
  );
}
