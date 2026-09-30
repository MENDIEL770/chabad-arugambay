'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/ui/icon';
import { PhoneField } from '@/components/ui/phone-field';
import { formatLkr } from '@/lib/config';
import { placeOrder, type OrderInput } from '@/app/menu/actions';
import { advanceOnEnter, digitsOnlyInput } from '@/lib/form-keyboard';
import type { PickedPoint } from '@/components/ui/map-picker';

/** A map library is a lot of JavaScript for someone who only wants pickup. */
const MapPicker = dynamic(
  () => import('@/components/ui/map-picker').then((m) => m.MapPicker),
  { ssr: false },
);

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
  const [point, setPoint] = useState<PickedPoint | null>(null);
  const [mapOpen, setMapOpen] = useState(false);
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
      lat: point?.lat,
      lng: point?.lng,
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
        onKeyDown={advanceOnEnter}
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

          <PhoneField hint="לשם נשלח את עדכוני ההזמנה." />

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

              {/* In Arugam Bay a pin beats an address: lanes are unnamed and
                  half the guesthouses share a name. */}
              <div>
                <span className="label">סימון על המפה</span>
                <button
                  type="button"
                  onClick={() => setMapOpen(true)}
                  className={`flex w-full items-center gap-3 rounded-input border px-3.5 py-3 text-start transition-colors ${
                    point
                      ? 'border-accent bg-accent-soft'
                      : 'border-line-strong hover:bg-surface'
                  }`}
                >
                  <Icon name="map" size={19} className="shrink-0 text-accent-strong" />
                  <span className="min-w-0 flex-1">
                    <b className="block text-[.9rem] font-medium">
                      {point ? 'המיקום סומן' : 'פתחו מפה וסמנו בדיוק'}
                    </b>
                    {point ? (
                      <span className="money text-[.75rem] text-fg-subtle">
                        {point.lat.toFixed(5)}, {point.lng.toFixed(5)}
                      </span>
                    ) : (
                      <span className="text-[.75rem] text-fg-subtle">
                        עוזר לנהג להגיע ישר אליכם
                      </span>
                    )}
                  </span>
                  {point && <span className="chip chip-kosher">שונה</span>}
                </button>
              </div>
            </>
          )}

          {fulfillment === 'dine_in' && (
            <label>
              <span className="label">מספר שולחן</span>
              <input
                className="field"
                name="tableNo"
                required
                inputMode="numeric"
                pattern="[0-9]*"
                onInput={digitsOnlyInput}
              />
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

      {mapOpen && (
        <MapPicker
          value={point}
          onChange={setPoint}
          onClose={() => setMapOpen(false)}
        />
      )}
    </div>
  );
}
