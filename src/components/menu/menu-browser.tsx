'use client';

import { useMemo, useState } from 'react';
import type { MenuCategory, MenuItem } from '@/lib/data/types';
import { isSellable } from '@/lib/data/types';
import { formatLkr, lkrToIls } from '@/lib/config';
import {
  describeModifications, priceDelta, selectionKey, type Selection,
} from '@/lib/data/modifiers';
import { ItemSheet } from './item-sheet';
import { CheckoutSheet } from './checkout-sheet';
import { DishGallery } from './dish-gallery';

type Fulfillment = 'delivery' | 'pickup' | 'dine_in';

const FULFILLMENT: { id: Fulfillment; label: string; hint: string }[] = [
  { id: 'delivery', label: 'משלוח', hint: 'תשלום לנהג במזומן' },
  { id: 'pickup', label: 'איסוף', hint: 'מוכן בעוד ~20 דק׳' },
  { id: 'dine_in', label: 'ישיבה במקום', hint: 'סרקו את ה-QR על השולחן' },
];

const KOSHER_LABEL: Record<MenuItem['kosher'], string> = {
  meat: 'בשרי', dairy: 'חלבי', pareve: 'פרווה',
};

const DELIVERY_FEE_LKR = 500;

interface CartLine {
  key: string;
  itemId: string;
  qty: number;
  selection: Selection;
}

export function MenuBrowser({ categories }: { categories: MenuCategory[] }) {
  const [fulfillment, setFulfillment] = useState<Fulfillment>('delivery');
  const [lines, setLines] = useState<CartLine[]>([]);
  const [editing, setEditing] = useState<MenuItem | null>(null);
  const [checkingOut, setCheckingOut] = useState(false);

  const itemsById = useMemo(
    () => new Map(categories.flatMap((c) => c.items).map((i) => [i.id, i])),
    [categories],
  );

  /** Same dish built differently is a separate line; identical builds merge. */
  function addLine(item: MenuItem, selection: Selection, qty: number) {
    const key = selectionKey(item.id, selection);
    setLines((prev) => {
      const at = prev.findIndex((l) => l.key === key);
      if (at === -1) return [...prev, { key, itemId: item.id, qty, selection }];
      const copy = [...prev];
      copy[at] = { ...copy[at], qty: copy[at].qty + qty };
      return copy;
    });
    setEditing(null);
  }

  function bump(key: string, delta: number) {
    setLines((prev) =>
      prev
        .map((l) => (l.key === key ? { ...l, qty: l.qty + delta } : l))
        .filter((l) => l.qty > 0),
    );
  }

  function onAddClick(item: MenuItem) {
    if (!isSellable(item)) return;
    // A dish with nothing to choose goes straight in — no pointless sheet.
    if (item.modifierGroups.length === 0) {
      addLine(item, {}, 1);
      return;
    }
    setEditing(item);
  }

  const priced = lines.map((l) => {
    const item = itemsById.get(l.itemId)!;
    const unit = item.priceLkr + priceDelta(item.modifierGroups, l.selection);
    return {
      ...l,
      item,
      unit,
      total: unit * l.qty,
      mods: describeModifications(item.modifierGroups, l.selection),
    };
  });

  const subtotal = priced.reduce((s, l) => s + l.total, 0);
  const fee = fulfillment === 'delivery' && subtotal > 0 ? DELIVERY_FEE_LKR : 0;
  const total = subtotal + fee;
  const count = priced.reduce((s, l) => s + l.qty, 0);

  function qtyOf(itemId: string) {
    return priced.filter((l) => l.itemId === itemId).reduce((s, l) => s + l.qty, 0);
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
                on ? 'border-accent bg-accent-soft' : 'border-line-strong bg-bg hover:bg-surface'
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
                  const inCart = qtyOf(item.id);
                  const low = sellable && item.stock === 'count' && (item.stockQty ?? 0) <= 3;
                  const customisable = item.modifierGroups.length > 0;

                  return (
                    <li
                      key={item.id}
                      className={`card overflow-hidden !p-0 ${sellable ? '' : 'opacity-60'}`}
                    >
                      <DishGallery images={item.images} alt={item.name.he} />

                      <div className="flex min-w-0 flex-1 flex-col gap-1 p-4">
                        <div className="flex items-start justify-between gap-2">
                          <b className="font-medium">{item.name.he}</b>
                          <span className="money text-[.92rem]">{formatLkr(item.priceLkr)}</span>
                        </div>
                        <p className="text-[.82rem] text-fg-muted">{item.description.he}</p>

                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          <span className="chip chip-kosher">{KOSHER_LABEL[item.kosher]}</span>
                          {!sellable && <span className="chip chip-out">אזל להיום</span>}
                          {low && <span className="chip">נשארו {item.stockQty}</span>}
                          <span className="chip">{item.prepMinutes} דק׳</span>
                          {customisable && <span className="chip">אפשר להתאים</span>}
                        </div>

                        <div className="mt-2 flex items-center justify-end gap-2">
                          {inCart > 0 && (
                            <span className="text-[.78rem] text-fg-subtle">{inCart} בעגלה</span>
                          )}
                          <button
                            type="button"
                            className="btn btn-accent btn-sm"
                            disabled={!sellable}
                            onClick={() => onAddClick(item)}
                          >
                            {customisable ? 'בחירת תוספות' : 'הוסף'}
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

          {priced.length === 0 ? (
            <p className="text-sm text-fg-muted">עדיין לא הוספתם כלום.</p>
          ) : (
            <>
              <ul className="flex flex-col gap-3 border-b border-line pb-3">
                {priced.map((l) => (
                  <li key={l.key} className="flex flex-col gap-1">
                    <div className="flex items-baseline gap-2 text-sm">
                      <span className="min-w-0 flex-1 font-medium">{l.item.name.he}</span>
                      <span className="money text-[.85rem]">{formatLkr(l.total)}</span>
                    </div>

                    {l.mods.length > 0 && (
                      <ul className="flex flex-wrap gap-1">
                        {l.mods.map((m, i) => (
                          <li
                            key={i}
                            className={`chip !py-0.5 !text-[.68rem] ${
                              m.kind === 'removal' ? 'chip-out' : ''
                            }`}
                          >
                            {m.text.he}
                          </li>
                        ))}
                      </ul>
                    )}

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => bump(l.key, -1)}
                        aria-label={`הסר ${l.item.name.he}`}
                        className="grid size-7 place-items-center rounded-full border border-line-strong text-sm hover:bg-bg"
                      >
                        −
                      </button>
                      <span className="clock w-5 text-center text-sm">{l.qty}</span>
                      <button
                        type="button"
                        onClick={() => bump(l.key, 1)}
                        aria-label={`עוד ${l.item.name.he}`}
                        className="grid size-7 place-items-center rounded-full border border-line-strong text-sm hover:bg-bg"
                      >
                        +
                      </button>
                    </div>
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
                  <dd><span className="money">{lkrToIls(total)}</span> ₪</dd>
                </div>
              </dl>

              {fulfillment === 'delivery' && (
                <p className="mb-3 rounded-input bg-accent-soft px-3 py-2 text-[.8rem]">
                  תשלמו לנהג במזומן: <b className="money">{formatLkr(total)}</b>
                </p>
              )}

              <button
                type="button"
                className="btn btn-accent w-full justify-center"
                onClick={() => setCheckingOut(true)}
              >
                להמשך הזמנה ({count})
              </button>
            </>
          )}
        </aside>
      </div>

      {checkingOut && (
        <CheckoutSheet
          fulfillment={fulfillment}
          total={total}
          onClose={() => setCheckingOut(false)}
          // Only ids, quantities and choices travel to the server; every
          // price is rebuilt there from the menu table.
          lines={priced.map((l) => ({
            itemId: l.itemId,
            qty: l.qty,
            modifiers: Object.entries(l.selection).map(([id, state]) => ({ id, state })),
          }))}
        />
      )}

      {editing && (
        <ItemSheet
          item={editing}
          onClose={() => setEditing(null)}
          onAdd={(selection, qty) => addLine(editing, selection, qty)}
        />
      )}
    </>
  );
}
