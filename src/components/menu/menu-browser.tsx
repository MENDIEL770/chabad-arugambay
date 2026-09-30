'use client';

import { useMemo, useState } from 'react';
import type { MenuCategory, MenuItem } from '@/lib/data/types';
import { isSellable } from '@/lib/data/types';
import { formatLkr, lkrToIls } from '@/lib/config';

type Fulfillment = 'delivery' | 'pickup' | 'dine_in';

const FULFILLMENT: { id: Fulfillment; label: string; hint: string }[] = [
  { id: 'delivery', label: 'משלוח', hint: 'תשלום לנהג במזומן' },
  { id: 'pickup', label: 'איסוף', hint: 'מוכן בעוד ~20 דק׳' },
  { id: 'dine_in', label: 'ישיבה במקום', hint: 'סרקו את ה-QR על השולחן' },
];

const KOSHER_LABEL: Record<MenuItem['kosher'], string> = {
  meat: 'בשרי',
  dairy: 'חלבי',
  pareve: 'פרווה',
};

const DELIVERY_FEE_LKR = 500;

export function MenuBrowser({ categories }: { categories: MenuCategory[] }) {
  const [fulfillment, setFulfillment] = useState<Fulfillment>('delivery');
  const [cart, setCart] = useState<Record<string, number>>({});

  const allItems = useMemo(
    () => new Map(categories.flatMap((c) => c.items).map((i) => [i.id, i])),
    [categories],
  );

  const lines = Object.entries(cart)
    .map(([id, qty]) => ({ item: allItems.get(id)!, qty }))
    .filter((l) => l.item);

  const subtotal = lines.reduce((s, l) => s + l.item.priceLkr * l.qty, 0);
  const fee = fulfillment === 'delivery' && subtotal > 0 ? DELIVERY_FEE_LKR : 0;
  const total = subtotal + fee;
  const count = lines.reduce((s, l) => s + l.qty, 0);

  function change(item: MenuItem, delta: number) {
    // Guard here as well as on the server: a stale tab must not be able to
    // add a dish that sold out while it sat open.
    if (delta > 0 && !isSellable(item)) return;
    setCart((c) => {
      const next = (c[item.id] ?? 0) + delta;
      const copy = { ...c };
      if (next <= 0) delete copy[item.id];
      else copy[item.id] = next;
      return copy;
    });
  }

  return (
    <>
      <div className="mb-8 flex flex-wrap gap-2.5" role="group" aria-label="איך לקבל את ההזמנה">
        {FULFILLMENT.map((f) => {
          const on = fulfillment === f.id;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => setFulfillment(f.id)}
              aria-pressed={on}
              className={`flex flex-col items-start rounded-card border px-4.5 py-3 text-start transition-colors ${
                on
                  ? 'border-accent bg-accent-soft'
                  : 'border-line-strong bg-bg hover:bg-surface'
              }`}
            >
              <span className="font-medium">{f.label}</span>
              <span className="text-[.76rem] text-fg-subtle">{f.hint}</span>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-[1fr_330px] items-start gap-9 max-[980px]:grid-cols-1">
        <div className="flex flex-col gap-10">
          {categories.map((cat) => (
            <section key={cat.id} aria-labelledby={`cat-${cat.id}`}>
              <h2 id={`cat-${cat.id}`} className="mb-4 text-xl font-bold tracking-[-.01em]">
                {cat.name.he}
              </h2>
              <ul className="grid grid-cols-2 gap-4 max-[680px]:grid-cols-1">
                {cat.items.map((item) => {
                  const sellable = isSellable(item);
                  const qty = cart[item.id] ?? 0;
                  const low =
                    sellable && item.stock === 'count' && (item.stockQty ?? 0) <= 3;

                  return (
                    <li
                      key={item.id}
                      className={`card flex gap-4 !p-4 ${sellable ? '' : 'opacity-60'}`}
                    >
                      <span
                        className="grid size-[68px] shrink-0 place-items-center rounded-input bg-accent-soft text-2xl"
                        aria-hidden="true"
                      >
                        {item.kosher === 'meat' ? '🍗' : item.kosher === 'dairy' ? '🍳' : '🥗'}
                      </span>

                      <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <div className="flex items-start justify-between gap-2">
                          <b className="font-medium">{item.name.he}</b>
                          <span className="money text-[.92rem]">{formatLkr(item.priceLkr)}</span>
                        </div>
                        <p className="text-[.82rem] text-fg-muted">{item.description.he}</p>

                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          <span className="chip chip-kosher">{KOSHER_LABEL[item.kosher]}</span>
                          {!sellable && <span className="chip chip-out">אזל להיום</span>}
                          {low && (
                            <span className="chip">נשארו {item.stockQty}</span>
                          )}
                          <span className="chip">{item.prepMinutes} דק׳</span>
                        </div>

                        <div className="mt-2 flex items-center justify-end gap-2">
                          {qty > 0 && (
                            <>
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm !px-3"
                                onClick={() => change(item, -1)}
                                aria-label={`הסר ${item.name.he}`}
                              >
                                −
                              </button>
                              <span className="clock w-6 text-center">{qty}</span>
                            </>
                          )}
                          <button
                            type="button"
                            className="btn btn-accent btn-sm !px-3"
                            disabled={!sellable}
                            onClick={() => change(item, 1)}
                            aria-label={`הוסף ${item.name.he}`}
                          >
                            {qty > 0 ? '+' : 'הוסף'}
                          </button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>

        <aside className="sticky top-24 rounded-card border border-line bg-surface p-5 max-[980px]:static">
          <h2 className="mb-3 text-lg font-bold">העגלה</h2>

          {lines.length === 0 ? (
            <p className="text-sm text-fg-muted">עדיין לא הוספתם כלום.</p>
          ) : (
            <>
              <ul className="flex flex-col gap-2 border-b border-line pb-3">
                {lines.map((l) => (
                  <li key={l.item.id} className="flex items-baseline gap-2 text-sm">
                    <span className="clock text-fg-subtle">{l.qty}×</span>
                    <span className="min-w-0 flex-1 truncate">{l.item.name.he}</span>
                    <span className="money text-[.85rem]">
                      {formatLkr(l.item.priceLkr * l.qty)}
                    </span>
                  </li>
                ))}
              </ul>

              <dl className="flex flex-col gap-1.5 py-3 text-sm">
                <div className="flex justify-between">
                  <dt className="text-fg-muted">מנות</dt>
                  <dd className="money">{formatLkr(subtotal)}</dd>
                </div>
                {fulfillment === 'delivery' && (
                  <div className="flex justify-between">
                    <dt className="text-fg-muted">משלוח</dt>
                    <dd className="money">{formatLkr(fee)}</dd>
                  </div>
                )}
                <div className="mt-1 flex justify-between border-t border-line pt-2 font-bold">
                  <dt>סה״כ</dt>
                  <dd className="money">{formatLkr(total)}</dd>
                </div>
                <div className="flex justify-between text-[.76rem] text-fg-subtle">
                  <dt>בערך</dt>
                  <dd className="money">≈ {lkrToIls(total)} ILS</dd>
                </div>
              </dl>

              {fulfillment === 'delivery' && (
                <p className="mb-3 rounded-input bg-accent-soft px-3 py-2 text-[.8rem]">
                  תשלמו לנהג במזומן: <b className="money">{formatLkr(total)}</b>
                </p>
              )}

              <button type="button" className="btn btn-accent w-full justify-center" disabled>
                להמשך הזמנה ({count})
              </button>
              <p className="mt-2 text-center text-[.72rem] text-fg-subtle">
                התשלום והשליחה למטבח מחוברים בשלב הבא
              </p>
            </>
          )}
        </aside>
      </div>
    </>
  );
}
