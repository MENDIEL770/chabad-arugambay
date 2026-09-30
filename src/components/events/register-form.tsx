'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/ui/icon';
import type { EventRecord } from '@/lib/data/events';
import { register, type RegisterInput } from '@/app/f/[slug]/actions';

const DONATIONS = [0, 50, 100, 180, 360];
const STEPS = ['סעודות', 'פרטים', 'אישור'] as const;

export function RegisterForm({ event }: { event: EventRecord }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [donation, setDonation] = useState(0);
  const [names, setNames] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allTypes = useMemo(
    () => event.meals.flatMap((m) => m.types.map((t) => ({ ...t, mealId: m.id, mealName: m.name.he }))),
    [event],
  );

  const chosen = allTypes.filter((t) => (qty[t.id] ?? 0) > 0);
  const mealsTotal = chosen.reduce((s, t) => s + t.priceIls * qty[t.id], 0);
  const total = mealsTotal + donation;

  /** Seats, not people: an infant takes none, so it needs no name row. */
  const nameCount = chosen.reduce(
    (s, t) => s + (t.seats > 0 ? qty[t.id] : 0),
    0,
  );

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
      participants: names
        .filter((n) => n.trim().length > 0)
        .map((n) => ({ fullName: n.trim(), isChild: false })),
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
    <form action={submit} className="mx-auto max-w-[620px]">
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
                        <span className="money ms-2 text-[.82rem] text-fg-subtle">
                          {t.priceIls > 0 ? `${t.priceIls} ₪` : 'ללא תשלום'}
                        </span>
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
          onClick={() => {
            setNames((prev) => {
              const next = [...prev];
              next.length = nameCount;
              return Array.from(next, (x) => x ?? '');
            });
            setStep(1);
          }}
        >
          {chosen.length === 0 ? 'בחרו סעודה כדי להמשיך' : 'המשך'}
        </button>
      </div>

      {/* ---------------------------------------------------- 2. details */}
      <div hidden={step !== 1} className="flex flex-col gap-4">
        <div className="card flex flex-col gap-3">
          <h2 className="font-bold">מי נרשם</h2>
          <label>
            <span className="label">שם מלא</span>
            <input className="field" name="name" required={step === 1} minLength={2} />
          </label>
          <label>
            <span className="label">טלפון (וואטסאפ)</span>
            <input
              className="field ltr"
              name="phone"
              type="tel"
              required={step === 1}
              placeholder="+972501234567"
            />
          </label>
          <label>
            <span className="label">מייל (לא חובה)</span>
            <input className="field ltr" name="email" type="email" />
          </label>
          <label>
            <span className="label">מאיפה אתם? (לא חובה)</span>
            <input className="field" name="nationality" placeholder="ישראל" />
          </label>
        </div>

        {nameCount > 0 && (
          <div className="card flex flex-col gap-3">
            <div>
              <h2 className="font-bold">שמות המשתתפים</h2>
              <p className="mt-0.5 text-[.8rem] text-fg-muted">
                באנגלית כמו בדרכון — זה מה שנרשם בכניסה.
              </p>
            </div>
            {Array.from({ length: nameCount }, (_, i) => (
              <input
                key={i}
                className="field ltr"
                value={names[i] ?? ''}
                onChange={(e) =>
                  setNames((prev) => {
                    const next = [...prev];
                    next[i] = e.target.value;
                    return next;
                  })
                }
                placeholder={`משתתף ${i + 1}`}
                aria-label={`שם משתתף ${i + 1}`}
              />
            ))}
          </div>
        )}

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
  );
}
