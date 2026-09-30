'use client';

import Image from 'next/image';
import { useRef, useState, useTransition } from 'react';
import type { MenuCategory, MenuItem } from '@/lib/data/types';
import { isSellable } from '@/lib/data/types';
import { formatLkr } from '@/lib/config';
import { Icon } from '@/components/ui/icon';
import { advanceOnEnter } from '@/lib/form-keyboard';
import {
  removeItemImage, restock, saveItem, toggleAvailability,
  type ActionResult,
} from '@/app/admin/restaurant/menu/actions';

const KOSHER = [
  { v: 'meat', l: 'בשרי' },
  { v: 'dairy', l: 'חלבי' },
  { v: 'pareve', l: 'פרווה' },
] as const;

const STATIONS = [
  { v: 'grill', l: 'גריל' },
  { v: 'cold', l: 'קר' },
  { v: 'bar', l: 'בר' },
  { v: 'bakery', l: 'מאפייה' },
] as const;

const STOCK = [
  { v: 'none', l: 'ללא מעקב' },
  { v: 'count', l: 'לפי כמות' },
  { v: 'daily_limit', l: 'מגבלה יומית' },
] as const;

function Toast({ result }: { result: ActionResult | null }) {
  if (!result) return null;
  return (
    <p
      role="status"
      className={`mt-2 rounded-input px-3 py-2 text-[.82rem] ${
        result.ok ? 'bg-accent-soft' : 'bg-danger/10 text-danger'
      }`}
    >
      {result.message}
    </p>
  );
}

function ImageCell({ item, onResult }: { item: MenuItem; onResult: (r: ActionResult) => void }) {
  const [pending, start] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);

  function pick(file: File) {
    // Show the chosen file immediately; the upload replaces it on success.
    setPreview(URL.createObjectURL(file));
    const fd = new FormData();
    fd.set('id', item.id);
    fd.set('image', file);
    start(async () => {
      const r = await (await import('@/app/admin/restaurant/menu/actions')).uploadItemImage(fd);
      onResult(r);
      if (!r.ok) setPreview(null);
    });
  }

  const src = preview ?? item.imageUrl;

  return (
    <div className="flex flex-col items-center gap-1.5">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={pending}
        aria-label={`החלף תמונה ל${item.name.he}`}
        className="relative grid size-[72px] place-items-center overflow-hidden rounded-input border border-dashed border-line-strong bg-surface text-fg-subtle transition-colors hover:border-accent hover:bg-accent-soft disabled:opacity-50"
      >
        {src ? (
          <Image
            src={src}
            alt=""
            fill
            sizes="72px"
            className="object-cover"
            unoptimized={Boolean(preview)}
          />
        ) : (
          <span className="flex flex-col items-center gap-1">
            <Icon name="image" size={20} />
            <span className="text-[.65rem] leading-none">העלו תמונה</span>
          </span>
        )}
        {pending && (
          <span className="absolute inset-0 grid place-items-center bg-bg/70 text-[.7rem]">
            מעלה…
          </span>
        )}
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) pick(f);
          e.target.value = '';
        }}
      />

      {item.imageUrl && (
        <button
          type="button"
          className="text-[.7rem] text-fg-subtle underline hover:text-danger"
          onClick={() => start(async () => onResult(await removeItemImage(item.id)))}
        >
          הסר
        </button>
      )}
    </div>
  );
}

function ItemRow({ item }: { item: MenuItem }) {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();
  const [stockMode, setStockMode] = useState(item.stock);
  const sellable = isSellable(item);

  return (
    <li className="border-b border-line last:border-b-0">
      <div className="flex items-center gap-4 px-4 py-3">
        <ImageCell item={item} onResult={setResult} />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-2">
            <b className="font-medium">{item.name.he}</b>
            <span className="ltr text-[.78rem] text-fg-subtle">{item.name.en}</span>
          </div>
          <p className="truncate text-[.8rem] text-fg-muted">{item.description.he}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span className="chip chip-kosher">
              {KOSHER.find((k) => k.v === item.kosher)?.l}
            </span>
            <span className="chip">{STATIONS.find((s) => s.v === item.station)?.l}</span>
            {item.stock === 'count' && (
              <span className={`chip ${(item.stockQty ?? 0) <= 3 ? 'chip-out' : ''}`}>
                מלאי {item.stockQty}
              </span>
            )}
            {item.stock === 'daily_limit' && (
              <span className="chip">
                {item.soldToday}/{item.dailyLimit} היום
              </span>
            )}
            {!sellable && <span className="chip chip-out">אזל</span>}
          </div>
        </div>

        <span className="money whitespace-nowrap">{formatLkr(item.priceLkr)}</span>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            disabled={pending}
            className={`btn btn-sm ${item.isAvailable ? 'btn-ghost' : 'btn-accent'}`}
            onClick={() =>
              start(async () => setResult(await toggleAvailability(item.id, !item.isAvailable)))
            }
          >
            {item.isAvailable ? 'סמן שאזל' : 'החזר לתפריט'}
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
          >
            {open ? 'סגור' : 'ערוך'}
          </button>
        </div>
      </div>

      {open && (
        <form
          className="grid grid-cols-4 gap-3 border-t border-line bg-surface px-4 py-4 max-[900px]:grid-cols-2 max-[560px]:grid-cols-1"
          action={(fd) => start(async () => setResult(await saveItem(fd)))}
          onKeyDown={advanceOnEnter}
        >
          <input type="hidden" name="id" value={item.id} />

          <label className="col-span-2 max-[560px]:col-span-1">
            <span className="label">שם (עברית)</span>
            <input className="field" name="nameHe" defaultValue={item.name.he} required />
          </label>
          <label className="col-span-2 max-[560px]:col-span-1">
            <span className="label">שם (English)</span>
            <input className="field ltr" name="nameEn" defaultValue={item.name.en} required />
          </label>

          <label className="col-span-2 max-[560px]:col-span-1">
            <span className="label">תיאור (עברית)</span>
            <input className="field" name="descriptionHe" defaultValue={item.description.he} />
          </label>
          <label className="col-span-2 max-[560px]:col-span-1">
            <span className="label">תיאור (English)</span>
            <input className="field ltr" name="descriptionEn" defaultValue={item.description.en} />
          </label>

          <label>
            <span className="label">מחיר (LKR)</span>
            <input className="field money" name="priceLkr" type="number" min="0"
                   defaultValue={item.priceLkr} required />
          </label>
          <label>
            <span className="label">כשרות</span>
            <select className="field" name="kosher" defaultValue={item.kosher}>
              {KOSHER.map((k) => <option key={k.v} value={k.v}>{k.l}</option>)}
            </select>
          </label>
          <label>
            <span className="label">תחנה</span>
            <select className="field" name="station" defaultValue={item.station}>
              {STATIONS.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}
            </select>
          </label>
          <label>
            <span className="label">זמן הכנה (דק׳)</span>
            <input className="field money" name="prepMinutes" type="number" min="0"
                   defaultValue={item.prepMinutes} />
          </label>

          <label>
            <span className="label">מעקב מלאי</span>
            <select
              className="field"
              name="stock"
              defaultValue={item.stock}
              onChange={(e) => setStockMode(e.target.value as MenuItem['stock'])}
            >
              {STOCK.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}
            </select>
          </label>

          {/* Only the field that the chosen mode actually uses is shown, so an
              unused number cannot sit there looking authoritative. */}
          {stockMode === 'count' && (
            <label>
              <span className="label">יחידות במלאי</span>
              <input className="field money" name="stockQty" type="number" min="0"
                     defaultValue={item.stockQty ?? 0} />
            </label>
          )}
          {stockMode === 'daily_limit' && (
            <label>
              <span className="label">מגבלה יומית</span>
              <input className="field money" name="dailyLimit" type="number" min="0"
                     defaultValue={item.dailyLimit ?? 0} />
            </label>
          )}

          <div className="col-span-4 flex flex-wrap items-center gap-3 max-[900px]:col-span-2 max-[560px]:col-span-1">
            <button type="submit" className="btn btn-accent btn-sm" disabled={pending}>
              {pending ? 'שומר…' : 'שמירה'}
            </button>
            {item.stock === 'count' && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={pending}
                onClick={() =>
                  start(async () => setResult(await restock(item.id, (item.stockQty ?? 0) + 10)))
                }
              >
                +10 למלאי
              </button>
            )}
          </div>
        </form>
      )}

      <div className="px-4 pb-2">
        <Toast result={result} />
      </div>
    </li>
  );
}

export function MenuManager({ categories }: { categories: MenuCategory[] }) {
  return (
    <div className="flex flex-col gap-7">
      {categories.map((cat) => (
        <section key={cat.id}>
          <div className="mb-3 flex items-baseline gap-3">
            <h2 className="text-lg font-bold">{cat.name.he}</h2>
            <span className="ltr text-[.8rem] text-fg-subtle">{cat.name.en}</span>
            <span className="chip ms-auto">{cat.items.length} מנות</span>
          </div>
          <ul className="overflow-hidden rounded-card border border-line bg-bg">
            {cat.items.map((item) => <ItemRow key={item.id} item={item} />)}
          </ul>
        </section>
      ))}
    </div>
  );
}
