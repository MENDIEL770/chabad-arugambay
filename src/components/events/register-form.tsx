'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/ui/icon';
import { SubmittingOverlay } from '@/components/ui/submitting-overlay';
import { PhoneField } from '@/components/ui/phone-field';
import type { EventRecord } from '@/lib/data/events';
import { register, type RegisterInput } from '@/app/f/[slug]/actions';
import { advanceOnEnter } from '@/lib/form-keyboard';
import { choicesForMeal, type MealChoiceDef } from '@/lib/data/meal-choices';

const DONATIONS = [0, 50, 100, 180, 360];

/**
 * Serving time as HH:mm in the house's timezone.
 *
 * Formatted explicitly rather than with the browser's locale: a visitor
 * whose phone is still on Israel time would otherwise be shown a meal
 * three and a half hours out.
 */
function mealTime(iso: string): string {
  return new Intl.DateTimeFormat('he-IL', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Colombo',
    hour12: false,
  }).format(new Date(iso));
}
const STEPS = ['סעודות', 'פרטים', 'אישור'] as const;

export function RegisterForm({ event }: { event: EventRecord }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [donation, setDonation] = useState(0);
  /**
   * Names are keyed by meal, because the same two people usually eat at
   * both and the form should not ask twice. `sameForAll` is on by default
   * and mirrors the first meal's names onto the rest; turning it off
   * reveals a separate set per meal.
   */
  const [sameForAll, setSameForAll] = useState(true);
  const [names, setNames] = useState<Record<string, { first: string; last: string; choice: string }[]>>({});
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allTypes = useMemo(
    () => event.meals.flatMap((m) => m.types.map((t) => ({ ...t, mealId: m.id, mealName: m.name.he }))),
    [event],
  );

  const chosen = allTypes.filter((t) => (qty[t.id] ?? 0) > 0);
  const mealsTotal = chosen.reduce((s, t) => s + t.priceIls * qty[t.id], 0);
  const total = mealsTotal + donation;

  /**
   * How many names each meal needs. Seats, not rows: an infant takes none,
   * so it needs no name. Crucially this is PER MEAL — summing across meals
   * asked for four names when two people were eating twice.
   */
  const seatsByMeal = useMemo(() => {
    const out: { mealId: string; mealName: string; servesAt: string | null; seats: number }[] = [];
    for (const meal of event.meals) {
      const seats = meal.types.reduce(
        (sum, t) => sum + (t.seats > 0 ? (qty[t.id] ?? 0) * t.seats : 0),
        0,
      );
      if (seats > 0) {
        out.push({ mealId: meal.id, mealName: meal.name.he, servesAt: meal.servesAt, seats });
      }
    }
    return out;
  }, [event.meals, qty]);

  /** With the switch on, one list serves every meal: the largest sitting. */
  const sharedSeats = seatsByMeal.reduce((m, x) => Math.max(m, x.seats), 0);

  function nameAt(mealId: string, i: number) {
    return names[mealId]?.[i] ?? { first: '', last: '', choice: '' };
  }

  function setNameAt(
    mealId: string,
    i: number,
    patch: Partial<{ first: string; last: string; choice: string }>,
  ) {
    setNames((prev) => {
      const list = [...(prev[mealId] ?? [])];
      list[i] = { ...(list[i] ?? { first: '', last: '', choice: '' }), ...patch };
      return { ...prev, [mealId]: list };
    });
  }

  /**
   * Which dietary options to offer beside a person's name.
   *
   * With one list for every meal, the options are the union across the
   * meals being booked: a person's diet does not change between Friday
   * night and lunch, and asking twice would be the wrong question.
   */
  function choicesFor(mealId: string): MealChoiceDef[] {
    if (mealId !== SHARED) {
      const meal = event.meals.find((m) => m.id === mealId);
      return choicesForMeal(meal?.mealChoices, event.mealChoices);
    }
    const seen = new Map<string, MealChoiceDef>();
    for (const m of seatsByMeal) {
      const meal = event.meals.find((x) => x.id === m.mealId);
      for (const c of choicesForMeal(meal?.mealChoices, event.mealChoices)) {
        seen.set(c.key, c);
      }
    }
    return [...seen.values()];
  }

  const SHARED = '__shared__';

  /** Every required name, filled in. Blocks the step rather than the submit. */
  const namesComplete = useMemo(() => {
    const need = sameForAll
      ? [{ mealId: SHARED, seats: sharedSeats }]
      : seatsByMeal.map((m) => ({ mealId: m.mealId, seats: m.seats }));

    return need.every(({ mealId, seats }) =>
      Array.from({ length: seats }, (_, i) => nameAt(mealId, i)).every(
        (n) => n.first.trim().length > 1 && n.last.trim().length > 1,
      ),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [names, sameForAll, sharedSeats, seatsByMeal]);

  function bump(typeId: string, delta: number, max: number) {
    setQty((q) => {
      const next = Math.min(Math.max((q[typeId] ?? 0) + delta, 0), max);
      const copy = { ...q };
      if (next === 0) delete copy[typeId];
      else copy[typeId] = next;
      return copy;
    });
  }

  async function submit(formData: FormData) {
    setPending(true);
    setError(null);

    const payload: RegisterInput = {
      eventId: event.id,
      name: String(formData.get('name') ?? ''),
      email: String(formData.get('email') ?? ''),
      phone: String(formData.get('phone') ?? ''),
      nationality: String(formData.get('nationality') ?? '') || undefined,
      notes: String(formData.get('notes') ?? '') || undefined,
      donation,
      lines: chosen.map((t) => ({ typeId: t.id, qty: qty[t.id] })),
      // One row per person per meal, which is what the kitchen sheet needs.
      participants: seatsByMeal.flatMap((meal) =>
        Array.from({ length: meal.seats }, (_, i) => {
          const n = nameAt(sameForAll ? SHARED : meal.mealId, i);
          // A shared answer still has to be valid for this particular
          // meal: lunch may not offer what Friday night does.
          const allowed = choicesForMeal(
            event.meals.find((m) => m.id === meal.mealId)?.mealChoices,
            event.mealChoices,
          ).map((c) => c.key);
          return {
            mealId: meal.mealId,
            fullName: `${n.first.trim()} ${n.last.trim()}`.trim(),
            isChild: false,
            mealChoice: n.choice && allowed.includes(n.choice) ? n.choice : undefined,
          };
        }).filter((p) => p.fullName.length > 0),
      ),
    };

    const result = await register(payload);
    if (!result.ok || !result.trackToken) {
      setError(result.message);
      setPending(false);
      // Capacity errors come from the last step; send them back to fix it.
      if (/התמלאה|נסגרה/.test(result.message)) setStep(0);
      return;
    }
    router.push(`/r/${result.trackToken}`);
  }

  return (
    <>
      <SubmittingOverlay
        show={pending}
        label="רושמים אתכם…"
        patience="עוד רגע — שומרים את הפרטים ושולחים אישור."
      />
    <form action={submit} onKeyDown={advanceOnEnter} className="mx-auto max-w-[620px]">
      <ol className="mb-8 flex gap-2" aria-label="שלבי ההרשמה">
        {STEPS.map((s, i) => (
          <li key={s} className="flex flex-1 flex-col gap-1.5">
            <span className={`h-1 rounded-pill ${i <= step ? 'bg-accent' : 'bg-line'}`} />
            <span className={`text-[.78rem] ${i === step ? 'font-medium' : 'text-fg-subtle'}`}>
              {i + 1}. {s}
            </span>
          </li>
        ))}
      </ol>

      {/* ---------------------------------------------------- 1. meals */}
      <div hidden={step !== 0} className="flex flex-col gap-6">
        {event.meals.map((meal) => {
          const full = meal.seatsLeft !== null && meal.seatsLeft <= 0;
          return (
            <section key={meal.id} className="card">
              <div className="mb-3 flex flex-wrap items-baseline gap-2">
                <h2 className="font-bold">{meal.name.he}</h2>
                {meal.servesAt && (
                  <span className="clock text-[.82rem] font-normal text-fg-subtle">
                    {mealTime(meal.servesAt)}
                  </span>
                )}
                {!meal.isOpen && <span className="chip chip-out">סגורה</span>}
                {full && <span className="chip chip-out">מלאה</span>}
                {meal.seatsLeft !== null && meal.seatsLeft > 0 && meal.seatsLeft <= 8 && (
                  <span className="chip">נשארו {meal.seatsLeft} מקומות</span>
                )}
              </div>

              <ul className="flex flex-col">
                {meal.types.map((t) => {
                  const n = qty[t.id] ?? 0;
                  const disabled = !meal.isOpen || full;
                  return (
                    <li
                      key={t.id}
                      className="flex items-center gap-3 border-b border-line py-2.5 last:border-b-0"
                    >
                      <span className="min-w-0 flex-1">
                        {t.name.he}
                        {t.priceIls > 0 ? (
                          <span className="ms-2 text-[.82rem] text-fg-subtle">
                            <span className="money">{t.priceIls}</span> ₪
                          </span>
                        ) : (
                          <span className="ms-2 text-[.82rem] text-fg-subtle">ללא תשלום</span>
                        )}
                      </span>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <button
                          type="button"
                          aria-label={`פחות ${t.name.he}`}
                          disabled={disabled || n === 0}
                          onClick={() => bump(t.id, -1, t.maxPerRegistration)}
                          className="grid size-8 place-items-center rounded-full border border-line-strong disabled:opacity-35"
                        >
                          −
                        </button>
                        <span className="clock w-6 text-center">{n}</span>
                        <button
                          type="button"
                          aria-label={`עוד ${t.name.he}`}
                          disabled={disabled}
                          onClick={() => bump(t.id, 1, t.maxPerRegistration)}
                          className="grid size-8 place-items-center rounded-full border border-line-strong disabled:opacity-35"
                        >
                          +
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}

        <button
          type="button"
          className="btn btn-accent btn-lg justify-center"
          disabled={chosen.length === 0}
          onClick={() => setStep(1)}
        >
          {chosen.length === 0 ? 'בחרו סעודה כדי להמשיך' : 'המשך'}
        </button>
      </div>

      {/* ---------------------------------------------------- 2. details */}
      <div hidden={step !== 1} className="flex flex-col gap-4">
        {seatsByMeal.length > 0 && (
          <div className="card flex flex-col gap-4">
            <div>
              <h2 className="font-bold">שמות המשתתפים</h2>
              <p className="mt-0.5 text-[.8rem] text-fg-muted">
                השם המלא של כל משתתף — זה מה שנרשם בכניסה.
              </p>
            </div>

            {seatsByMeal.length > 1 && (
              <label className="flex items-start gap-2.5 rounded-input bg-surface px-3.5 py-3">
                <input
                  type="checkbox"
                  checked={sameForAll}
                  onChange={(e) => setSameForAll(e.target.checked)}
                  className="mt-0.5 size-4 shrink-0 accent-[var(--accent)]"
                />
                <span>
                  <span className="block text-[.9rem] font-medium">
                    אותם אנשים בכל הסעודות
                  </span>
                  <span className="block text-[.78rem] text-fg-subtle">
                    בטלו את הסימון אם מגיעים אנשים אחרים לבוקר.
                  </span>
                </span>
              </label>
            )}

            {(sameForAll
              ? [{ mealId: SHARED, mealName: '', servesAt: null, seats: sharedSeats }]
              : seatsByMeal
            ).map((group) => (
              <div key={group.mealId} className="flex flex-col gap-2.5">
                {!sameForAll && (
                  <h3 className="flex items-baseline gap-2 text-[.85rem] font-medium text-fg-muted">
                    {group.mealName}
                    {group.servesAt && (
                      <span className="clock text-[.78rem] font-normal text-fg-subtle">
                        {mealTime(group.servesAt)}
                      </span>
                    )}
                  </h3>
                )}
                {Array.from({ length: group.seats }, (_, i) => {
                  const n = nameAt(group.mealId, i);
                  return (
                    <div key={i} className="flex gap-2 max-[520px]:flex-col">
                      <input
                        className="field flex-1"
                        // Per-field direction: a Hebrew name aligns right, a
                        // Latin one left. Forcing ltr on the whole box put
                        // Hebrew names against the wrong edge.
                        dir="auto"
                        value={n.first}
                        onChange={(e) => setNameAt(group.mealId, i, { first: e.target.value })}
                        placeholder="שם פרטי"
                        aria-label={`שם פרטי של משתתף ${i + 1}`}
                        autoComplete="off"
                      />
                      <input
                        className="field flex-1"
                        dir="auto"
                        value={n.last}
                        onChange={(e) => setNameAt(group.mealId, i, { last: e.target.value })}
                        placeholder="שם משפחה"
                        aria-label={`שם משפחה של משתתף ${i + 1}`}
                        autoComplete="off"
                      />
                      {choicesFor(group.mealId).length > 0 && (
                        <select
                          className="field max-[520px]:w-full sm:w-[11rem]"
                          value={n.choice}
                          onChange={(e) =>
                            setNameAt(group.mealId, i, { choice: e.target.value })
                          }
                          aria-label={`בחירת מנה למשתתף ${i + 1}`}
                        >
                          <option value="">מנה רגילה</option>
                          {choicesFor(group.mealId).map((c) => (
                            <option key={c.key} value={c.key}>{c.label.he}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}

            {!namesComplete && (
              <p className="text-[.8rem] text-fg-subtle">
                צריך שם פרטי ושם משפחה לכל משתתף כדי להמשיך.
              </p>
            )}
          </div>
        )}

        <div className="card flex flex-col gap-3">
          <div>
            <h2 className="font-bold">על שם מי ההזמנה</h2>
            <p className="mt-0.5 text-[.8rem] text-fg-muted">
              איש הקשר להרשמה — לשם יישלח האישור.
            </p>
          </div>
          <label>
            <span className="label">שם מלא</span>
            <input className="field" name="name" required={step === 1} minLength={2} />
          </label>
          <PhoneField required={step === 1} hint="לשם נשלח את אישור ההרשמה." />
          <label>
            <span className="label">מייל (לא חובה)</span>
            <input className="field ltr" name="email" type="email" />
          </label>
          <label>
            <span className="label">מאיפה אתם? (לא חובה)</span>
            <input className="field" name="nationality" placeholder="ישראל" />
          </label>
        </div>

        <label className="card">
          <span className="label">הערות (אלרגיות, שאלות)</span>
          <input className="field" name="notes" />
        </label>

        <div className="flex gap-3">
          <button type="button" className="btn btn-ghost" onClick={() => setStep(0)}>
            חזרה
          </button>
          <button
            type="button"
            className="btn btn-accent flex-1 justify-center"
            disabled={!namesComplete}
            onClick={() => setStep(2)}
          >
            המשך
          </button>
        </div>
      </div>

      {/* ---------------------------------------------------- 3. confirm */}
      <div hidden={step !== 2} className="flex flex-col gap-4">
        <div className="card">
          <h2 className="mb-3 font-bold">סיכום</h2>
          <ul className="flex flex-col gap-2 border-b border-line pb-3">
            {chosen.map((t) => (
              <li key={t.id} className="flex items-baseline gap-2 text-sm">
                <span className="clock text-fg-subtle">{qty[t.id]}×</span>
                <span className="min-w-0 flex-1">
                  {t.name.he}
                  <span className="text-fg-subtle"> · {t.mealName}</span>
                </span>
                <span className="money text-[.85rem]">{t.priceIls * qty[t.id]} ₪</span>
              </li>
            ))}
          </ul>

          <div className="py-3">
            <span className="label">להוסיף תרומה?</span>
            <p className="mb-2 text-[.8rem] text-fg-muted">
              הסעודות פתוחות גם למי שלא יכול לשלם. מי שיכול — עוזר לנו להמשיך.
            </p>
            <div className="flex flex-wrap gap-2">
              {DONATIONS.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDonation(d)}
                  aria-pressed={donation === d}
                  className={`rounded-pill border px-3.5 py-1.5 text-[.85rem] font-medium ${
                    donation === d
                      ? 'border-accent bg-accent text-fg-on-accent'
                      : 'border-line-strong hover:bg-surface'
                  }`}
                >
                  {d === 0 ? 'לא הפעם' : <span className="money">{d} ₪</span>}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-between border-t border-line pt-3 font-bold">
            <span>סה״כ</span>
            <span className="money">{total} ₪</span>
          </div>

          <p className="mt-3 rounded-input bg-accent-soft px-3 py-2 text-[.82rem]">
            {total > 0
              ? 'התשלום מתבצע במקום. סליקה אונליין תתווסף בקרוב.'
              : 'אין מה לשלם — פשוט בואו.'}
          </p>
        </div>

        {error && (
          <p role="alert" className="rounded-input bg-danger/10 px-3 py-2.5 text-[.85rem] text-danger">
            {error}
          </p>
        )}

        <div className="flex gap-3">
          <button type="button" className="btn btn-ghost" onClick={() => setStep(1)} disabled={pending}>
            חזרה
          </button>
          <button type="submit" className="btn btn-accent flex-1 justify-center" disabled={pending}>
            {pending ? 'שולח…' : 'סיום הרשמה'}
            {!pending && <Icon name="arrow" size={15} />}
          </button>
        </div>
      </div>
    </form>
    </>
  );
}
