'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/ui/icon';
import { formatLkr } from '@/lib/config';
import { placeOrder, type OrderInput } from '@/app/menu/actions';

type Fulfillment = 'delivery' | 'pickup' | 'dine_in';

const PAY_OPTIONS: Record<Fulfillment, { value: OrderInput['payMethod']; label: string; hint: string }[]> = {
  delivery: [
    { value: 'cash_lkr_to_driver', label: 'מזומן לנהג', hint: 'משלמים כשהאוכל מגיע' },
  ],
  pickup: [
    { value: 'cash_lkr_at_counter', label: 'מזומן בדלפק', hint: 'משלמים כשאוספים' },
  ],
  dine_in: [
    { value: 'cash_lkr_at_counter', label: 'מזומן בדלפק', hint: 'משלמים בסוף הארוחה' },
  ],
};

export function CheckoutSheet({
  fulfillment,
  lines,
  total,
  onClose,
}: {
  fulfillment: Fulfillment;
  lines: OrderInput['lines'];
  total: number;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !pending) onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose, pending]);

  async function submit(formData: FormData) {
    setPending(true);
    setError(null);

    const result = await placeOrder({
      fulfillment,
      name: String(formData.get('name') ?? ''),
      phone: String(formData.get('phone') ?? ''),
      address: String(formData.get('address') ?? '') || undefined,
      addressNotes: String(formData.get('addressNotes') ?? '') || undefined,
      tableNo: String(formData.get('tableNo') ?? '') || undefined,
      payMethod: String(formData.get('payMethod') ?? '') as OrderInput['payMethod'],
      lines,
    });

    if (!result.ok || !result.trackToken) {
      setError(result.message);
      setPending(false);
      return;
    }
    // Leave the sheet open while navigating so the button cannot be pressed
    // twice into a second order.
    router.push(`/order/${result.trackToken}`);
  }

  const pay = PAY_OPTIONS[fulfillment];

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/45 sm:items-center"
      onClick={(e) => { if (e.target === e.currentTarget && !pending) onClose(); }}
    >
      <form
        action={submit}
        role="dialog"
        aria-modal="true"
        aria-label="פרטי ההזמנה"
        className="flex max-h-[92dvh] w-full max-w-[520px] flex-col rounded-t-card bg-bg sm:rounded-card"
      >
        <header className="flex items-start gap-3 border-b border-line p-5">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold">פרטים אחרונים</h2>
            <p className="mt-0.5 text-[.85rem] text-fg-muted">
              {fulfillment === 'delivery' ? 'משלוח' : fulfillment === 'pickup' ? 'איסוף' : 'ישיבה במקום'}
              {' · '}
              <b className="money">{formatLkr(total)}</b>
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            disabled={pending}
            aria-label="סגור"
            className="grid size-9 shrink-0 place-items-center rounded-full border border-line-strong hover:bg-surface disabled:opacity-40"
          >
            <Icon name="x" size={17} />
          </button>
        </header>

        <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-5">
          <label>
            <span className="label">שם</span>
            <input className="field" name="name" required minLength={2} autoComplete="name" />
          </label>

          <label>
            <span className="label">טלפון (וואטסאפ)</span>
            <input
              className="field ltr"
              name="phone"
              type="tel"
              required
              placeholder="+94771234567"
              autoComplete="tel"
            />
            <span className="mt-1 block text-[.75rem] text-fg-subtle">
              עם קידומת מדינה. לשם נשלח את עדכוני ההזמנה.
            </span>
          </label>

          {fulfillment === 'delivery' && (
            <>
              <label>
                <span className="label">כתובת</span>
                <input className="field" name="address" required autoComplete="street-address" />
              </label>
              <label>
                <span className="label">איך למצוא אתכם (לא חובה)</span>
                <input className="field" name="addressNotes" placeholder="מול הסופר, קומה 2" />
              </label>
            </>
          )}

          {fulfillment === 'dine_in' && (
            <label>
              <span className="label">מספר שולחן</span>
              <input className="field" name="tableNo" required inputMode="numeric" />
            </label>
          )}

          <fieldset className="mt-1">
            <legend className="label">תשלום</legend>
            <div className="flex flex-col gap-2">
              {pay.map((p, i) => (
                <label
                  key={p.value}
                  className="flex cursor-pointer items-center gap-3 rounded-input border border-line px-3.5 py-2.5"
                >
                  <input
                    type="radio"
                    name="payMethod"
                    value={p.value}
                    defaultChecked={i === 0}
                    className="size-4 accent-[var(--accent)]"
                    required
                  />
                  <span className="flex-1">
                    <b className="block font-medium">{p.label}</b>
                    <span className="text-[.78rem] text-fg-subtle">{p.hint}</span>
                  </span>
                </label>
              ))}
            </div>
            <p className="mt-2 text-[.76rem] text-fg-subtle">
              תשלום בכרטיס עדיין לא מחובר — בשלב הבא.
            </p>
          </fieldset>

          {error && (
            <p role="alert" className="rounded-input bg-danger/10 px-3 py-2.5 text-[.85rem] text-danger">
              {error}
            </p>
          )}
        </div>

        <footer className="border-t border-line p-5">
          {fulfillment === 'delivery' && (
            <p className="mb-3 rounded-input bg-accent-soft px-3 py-2 text-[.82rem]">
              תשלמו לנהג במזומן: <b className="money">{formatLkr(total)}</b>
            </p>
          )}
          <button type="submit" className="btn btn-accent w-full justify-center" disabled={pending}>
            {pending ? 'שולח…' : 'שליחת ההזמנה'}
          </button>
        </footer>
      </form>
    </div>
  );
}
