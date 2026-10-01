'use client';

import { useState, useTransition } from 'react';
import { DateTime } from 'luxon';
import type { EventRecord } from '@/lib/data/events';
import { runAction } from '@/lib/run-action';
import {
  saveEvent, saveMeal, saveRegistrantType, type ActionResult,
} from '@/app/admin/events/event-actions';
import { MEAL_CHOICES } from '@/lib/data/meal-choices';

function Toast({ r }: { r: ActionResult | null }) {
  if (!r?.message) return null;
  return (
    <p
      role="status"
      className={`mt-2 rounded-input px-3 py-2 text-[.82rem] ${
        r.ok ? 'bg-accent-soft' : 'bg-danger/10 text-danger'
      }`}
    >
      {r.message}
    </p>
  );
}

/** `datetime-local` wants the wall clock in the restaurant's zone. */
/**
 * The per-meal dietary question.
 *
 * Three states, because two are not enough. "Inherit" follows the global
 * default; "custom" is this meal's own answer, and a custom answer with
 * nothing ticked is a deliberate off — Shabbat lunch may be a buffet where
 * the question is meaningless even when Friday night offers a plate.
 */
function MealChoiceField({ meal }: { meal: { mealChoices: string[] | null } }) {
  const [mode, setMode] = useState<'inherit' | 'custom'>(
    meal.mealChoices === null ? 'inherit' : 'custom',
  );
  const [keys, setKeys] = useState<string[]>(meal.mealChoices ?? []);

  return (
    <fieldset className="col-span-2 max-[700px]:col-span-1">
      <legend className="label !mb-1">בחירת מנה מיוחדת</legend>
      <input type="hidden" name="choiceMode" value={mode} />

      <div className="mb-2 flex flex-wrap gap-1.5">
        {([
          ['inherit', 'כמו בהגדרות הכלליות'],
          ['custom', 'הגדרה לסעודה הזו'],
        ] as const).map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={`btn btn-sm ${mode === value ? 'btn-accent' : 'btn-ghost'}`}
            onClick={() => setMode(value)}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === 'custom' && (
        <>
          <div className="flex flex-wrap gap-1.5">
            {MEAL_CHOICES.map((c) => {
              const on = keys.includes(c.key);
              return (
                <label
                  key={c.key}
                  className={`cursor-pointer rounded-input border px-3 py-1.5 text-[.84rem] ${
                    on
                      ? 'border-accent bg-accent-soft text-accent-strong'
                      : 'border-line text-fg-muted hover:border-accent/50'
                  }`}
                >
                  <input
                    type="checkbox"
                    name="mealChoices"
                    value={c.key}
                    checked={on}
                    onChange={(e) =>
                      setKeys((prev) =>
                        e.target.checked ? [...prev, c.key] : prev.filter((k) => k !== c.key),
                      )
                    }
                    className="sr-only"
                  />
                  {c.label.he}
                </label>
              );
            })}
          </div>
          {keys.length === 0 && (
            <span className="mt-1 block text-[.74rem] text-fg-subtle">
              בלי סימון — השאלה לא תישאל בסעודה הזו.
            </span>
          )}
        </>
      )}
    </fieldset>
  );
}

function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  return DateTime.fromISO(iso).setZone('Asia/Colombo').toFormat("yyyy-LL-dd'T'HH:mm");
}

/**
 * Editing one form.
 *
 * Every change here marks the event hand-edited, which is what stops the
 * nightly generator from resetting it. Prices already charged are not
 * affected: a registration copies the amount onto its line rather than
 * reading it back from the type.
 */
export function EventEditor({ event }: { event: EventRecord }) {
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<ActionResult>) =>
    start(async () => setResult(await runAction(fn) as ActionResult));

  return (
    <div className="flex flex-col gap-6">
      <section className="card">
        <h2 className="mb-3 font-bold">הטופס</h2>
        <form
          className="grid grid-cols-2 gap-3 max-[700px]:grid-cols-1"
          action={(fd) => run(() => saveEvent(fd))}
        >
          <input type="hidden" name="id" value={event.id} />

          <label>
            <span className="label !mb-1">כותרת (עברית)</span>
            <input className="field" name="titleHe" defaultValue={event.title.he} required />
          </label>
          <label>
            <span className="label !mb-1">כותרת (English)</span>
            <input className="field ltr" name="titleEn" defaultValue={event.title.en} />
          </label>

          <label className="col-span-2 max-[700px]:col-span-1">
            <span className="label !mb-1">טקסט פתיחה (עברית)</span>
            <textarea className="field" name="introHe" rows={2} defaultValue={event.intro.he} />
          </label>

          <label>
            <span className="label !mb-1">ההרשמה נסגרת (שעות לפני הדלקת נרות)</span>
            <input
              className="field money"
              name="closesHoursBefore"
              inputMode="numeric"
              defaultValue={event.closesHoursBefore}
            />
          </label>

          <div className="flex flex-col justify-end gap-2 pb-1">
            <label className="flex items-center gap-2 text-[.88rem]">
              <input type="checkbox" name="isOpen" defaultChecked={event.isOpen} className="size-4 accent-[var(--accent)]" />
              ההרשמה פתוחה
            </label>
            <label className="flex items-center gap-2 text-[.88rem]">
              <input type="checkbox" name="isListed" defaultChecked={event.isListed} className="size-4 accent-[var(--accent)]" />
              מופיע ברשימת השבתות
            </label>
          </div>

          <div className="col-span-2 max-[700px]:col-span-1">
            <button type="submit" className="btn btn-accent btn-sm" disabled={pending}>
              {pending ? 'שומר…' : 'שמירת הטופס'}
            </button>
          </div>
        </form>
      </section>

      {event.meals.map((meal) => (
        <section key={meal.id} className="card">
          <div className="mb-3 flex flex-wrap items-baseline gap-2">
            <h2 className="font-bold">{meal.name.he}</h2>
            {!meal.isOpen && <span className="chip chip-out">סגורה</span>}
            {meal.seatsLeft !== null && (
              <span className="chip">נשארו {meal.seatsLeft} מקומות</span>
            )}
          </div>

          <form
            className="mb-4 grid grid-cols-2 gap-3 max-[700px]:grid-cols-1"
            action={(fd) => run(() => saveMeal(fd))}
          >
            <input type="hidden" name="id" value={meal.id} />
            <input type="hidden" name="eventId" value={event.id} />

            <label>
              <span className="label !mb-1">שם הסעודה</span>
              <input className="field" name="nameHe" defaultValue={meal.name.he} required />
            </label>
            <label>
              <span className="label !mb-1">שעת הגשה</span>
              <input
                className="field clock"
                type="datetime-local"
                name="servesAt"
                defaultValue={toLocalInput(meal.servesAt)}
              />
            </label>
            <label>
              <span className="label !mb-1">קיבולת</span>
              <input
                className="field money"
                name="capacity"
                inputMode="numeric"
                placeholder="ללא הגבלה"
                defaultValue={meal.capacity ?? ''}
              />
            </label>
            <div className="flex items-end gap-3 pb-1">
              <label className="flex items-center gap-2 text-[.88rem]">
                <input type="checkbox" name="isOpen" defaultChecked={meal.isOpen} className="size-4 accent-[var(--accent)]" />
                פתוחה להרשמה
              </label>
            </div>

            <MealChoiceField meal={meal} />

            <div className="col-span-2 max-[700px]:col-span-1">
              <button type="submit" className="btn btn-ghost btn-sm" disabled={pending}>
                שמירה
              </button>
            </div>
          </form>

          <h3 className="mb-2 text-[.85rem] font-medium text-fg-muted">מחירים</h3>
          <ul className="flex flex-col gap-2">
            {meal.types.map((t) => (
              <li key={t.id}>
                <form
                  className="flex flex-wrap items-end gap-2"
                  action={(fd) => run(() => saveRegistrantType(fd))}
                >
                  <input type="hidden" name="id" value={t.id} />
                  <input type="hidden" name="eventId" value={event.id} />
                  <input type="hidden" name="nameHe" value={t.name.he} />

                  <span className="min-w-[9rem] flex-1 text-[.9rem]">{t.name.he}</span>

                  <label className="w-28">
                    <span className="label !mb-1">מחיר ₪</span>
                    <input className="field money" name="price" inputMode="decimal" defaultValue={t.priceIls} />
                  </label>
                  <label className="w-24">
                    <span className="label !mb-1">מקומות</span>
                    <input className="field money" name="seats" inputMode="numeric" defaultValue={t.seats} />
                  </label>

                  <button type="submit" className="btn btn-ghost btn-sm" disabled={pending}>
                    עדכון
                  </button>
                </form>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[.74rem] text-fg-subtle">
            מקומות = כמה כסאות הסוג הזה תופס. תינוק הוא 0, ולכן לא נדרש לו שם
            ולא נספר בקיבולת.
          </p>
        </section>
      ))}

      <Toast r={result} />
    </div>
  );
}
