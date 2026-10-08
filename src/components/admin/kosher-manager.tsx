'use client';

import { useMemo, useState, useTransition } from 'react';
import { Icon, type IconName } from '@/components/ui/icon';
import type { KosherCategory, KosherProduct } from '@/lib/data/kosher';
import { STATUS, STATUS_ORDER, searchable, fold } from '@/lib/data/kosher-view';
import { ImageField } from '@/components/admin/image-field';
import { runAction } from '@/lib/run-action';
import {
  deleteCategory, deleteProduct, moveCategory, reverify, saveCategory, saveProduct,
  toggleProduct, type ActionResult,
} from '@/app/admin/content/kosher/actions';

const ICONS: IconName[] = ['dish', 'utensils', 'leaf', 'palm', 'waves', 'image', 'sparkle', 'bus'];

function ProductForm({
  product, categories, onDone,
}: {
  product?: KosherProduct;
  categories: KosherCategory[];
  onDone: (r: ActionResult) => void;
}) {
  const [pending, start] = useTransition();

  return (
    <form
      className="grid grid-cols-2 gap-3 rounded-input border border-line bg-surface p-4 max-[700px]:grid-cols-1"
      action={(fd) => start(async () => onDone(await runAction(() => saveProduct(fd)) as ActionResult))}
    >
      {product && <input type="hidden" name="id" value={product.id} />}

      <label>
        <span className="label !mb-1">שם המוצר</span>
        <input className="field" name="nameHe" required defaultValue={product?.name.he} />
      </label>
      <label>
        <span className="label !mb-1">שם באנגלית</span>
        <input className="field ltr" name="nameEn" defaultValue={product?.name.en}
               placeholder="כפי שכתוב על האריזה" />
      </label>

      <label>
        <span className="label !mb-1">מותג</span>
        <input className="field ltr" name="brand" defaultValue={product?.brand ?? ''} />
      </label>
      <label>
        <span className="label !mb-1">קטגוריה</span>
        <select className="field" name="categoryId" defaultValue={product?.categoryId ?? ''}>
          <option value="">ללא קטגוריה</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name.he}</option>)}
        </select>
      </label>

      <fieldset className="col-span-2 max-[700px]:col-span-1">
        <legend className="label !mb-1">הכרעה</legend>
        <div className="flex flex-wrap gap-1.5">
          {STATUS_ORDER.map((s) => (
            <label
              key={s}
              className="cursor-pointer rounded-input border border-line px-3 py-1.5 text-[.85rem] text-fg-muted has-[:checked]:border-accent has-[:checked]:bg-accent-soft has-[:checked]:text-accent-strong"
            >
              <input
                type="radio" name="status" value={s}
                defaultChecked={(product?.status ?? 'check') === s}
                className="sr-only"
              />
              {STATUS[s].label}
            </label>
          ))}
        </div>
      </fieldset>

      <label>
        <span className="label !mb-1">כשרות</span>
        <input className="field" name="certification" defaultValue={product?.certification ?? ''}
               placeholder="OU · בד״ץ · ללא צורך" />
      </label>
      <label>
        <span className="label !mb-1">חלבי / בשרי / פרווה</span>
        <input className="field" name="kosherType" defaultValue={product?.kosherType ?? ''}
               placeholder="פרווה" />
      </label>

      <label className="col-span-2 max-[700px]:col-span-1">
        <span className="label !mb-1">הערות</span>
        <textarea className="field" name="notesHe" rows={2} defaultValue={product?.notes.he ?? ''}
                  placeholder="רק האריזה הכחולה · לא הטעם בשוקולד" />
      </label>

      <label>
        <span className="label !mb-1">איפה קונים</span>
        <input className="field" name="whereToBuy" defaultValue={product?.whereToBuy ?? ''}
               placeholder="Cargills · Keells" />
      </label>
      <label>
        <span className="label !mb-1">ברקוד</span>
        <input className="field money" name="barcode" inputMode="numeric"
               defaultValue={product?.barcode ?? ''} placeholder="4792024001234" />
      </label>

      <label>
        <span className="label !mb-1">נבדק בתאריך</span>
        <input className="field" name="verifiedOn" type="date" defaultValue={product?.verifiedOn ?? ''} />
        <span className="mt-1 block text-[.72rem] text-fg-subtle">
          מופיע לגולש. מדריך בלי תאריך מזמין להסתמך על תשובה בת ארבע שנים.
        </span>
      </label>

      <div className="col-span-2 max-[700px]:col-span-1">
        <ImageField
          kind="stay"
          label="תמונת האריזה"
          currentUrl={product?.imageUrl}
          hint="עוזר לזהות על המדף"
          onError={(message) => onDone({ ok: false, message })}
        />
      </div>

      <div className="col-span-2 max-[700px]:col-span-1">
        <button type="submit" className="btn btn-accent btn-sm" disabled={pending}>
          {pending ? 'שומר…' : product ? 'שמירה' : 'הוספה'}
        </button>
      </div>
    </form>
  );
}

export function KosherManager({
  categories, products,
}: {
  categories: KosherCategory[];
  products: KosherProduct[];
}) {
  const [result, setResult] = useState<ActionResult | null>(null);
  const [tab, setTab] = useState<'products' | 'categories'>('products');
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [addingCat, setAddingCat] = useState(false);
  const [editingCat, setEditingCat] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<string>('all');
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<ActionResult>) =>
    start(async () => setResult(await runAction(fn) as ActionResult));

  const catName = useMemo(
    () => new Map(categories.map((c) => [c.id, c.name.he])),
    [categories],
  );

  const shown = useMemo(() => {
    const needle = fold(q);
    return products.filter((p) => {
      if (filter === 'none' && p.categoryId) return false;
      if (filter !== 'all' && filter !== 'none' && p.categoryId !== filter) return false;
      return !needle || searchable(p).includes(needle);
    });
  }, [products, q, filter]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-1.5">
        {([['products', `מוצרים (${products.length})`], ['categories', `קטגוריות (${categories.length})`]] as const)
          .map(([k, label]) => (
            <button
              key={k}
              type="button"
              className={`btn btn-sm ${tab === k ? 'btn-accent' : 'btn-ghost'}`}
              onClick={() => setTab(k)}
            >
              {label}
            </button>
          ))}
      </div>

      {tab === 'categories' ? (
        <>
          <div className="flex justify-end">
            <button type="button" className="btn btn-accent btn-sm" onClick={() => setAddingCat(!addingCat)}>
              {addingCat ? 'ביטול' : <><Icon name="plus" size={15} /> קטגוריה</>}
            </button>
          </div>

          {addingCat && (
            <form
              className="flex flex-wrap items-end gap-3 rounded-input border border-line bg-surface p-4"
              action={(fd) => start(async () => {
                const r = await runAction(() => saveCategory(fd)) as ActionResult;
                setResult(r);
                if (r.ok) setAddingCat(false);
              })}
            >
              <label className="min-w-[10rem] flex-1">
                <span className="label !mb-1">שם</span>
                <input className="field" name="nameHe" required placeholder="חטיפים" />
              </label>
              <label className="min-w-[10rem] flex-1">
                <span className="label !mb-1">באנגלית</span>
                <input className="field ltr" name="nameEn" placeholder="Snacks" />
              </label>
              <label>
                <span className="label !mb-1">אייקון</span>
                <select className="field" name="icon" defaultValue="dish">
                  {ICONS.map((i) => <option key={i} value={i}>{i}</option>)}
                </select>
              </label>
              <button type="submit" className="btn btn-accent btn-sm" disabled={pending}>הוספה</button>
            </form>
          )}

          <ul className="flex flex-col gap-2">
            {categories.map((c, i) => (
              <li key={c.id} className="card !p-0 overflow-hidden">
                <div className="flex flex-wrap items-center gap-3 p-3.5">
                  <span className="grid size-9 shrink-0 place-items-center rounded-input bg-accent-soft text-accent-strong">
                    <Icon name={c.icon} size={17} />
                  </span>
                  <div className="min-w-[8rem] flex-1">
                    <b className="block">{c.name.he}</b>
                    <span className="text-[.78rem] text-fg-subtle">
                      <span className="clock">{c.count}</span> מוצרים
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button type="button" aria-label="למעלה" disabled={pending || i === 0}
                            className="grid size-7 place-items-center rounded-input text-fg-muted hover:bg-accent-soft disabled:opacity-30"
                            onClick={() => run(() => moveCategory(c.id, 'up'))}>
                      <Icon name="arrow" size={14} />
                    </button>
                    <button type="button" aria-label="למטה" disabled={pending || i === categories.length - 1}
                            className="grid size-7 rotate-180 place-items-center rounded-input text-fg-muted hover:bg-accent-soft disabled:opacity-30"
                            onClick={() => run(() => moveCategory(c.id, 'down'))}>
                      <Icon name="arrow" size={14} />
                    </button>
                    <button type="button" className="btn btn-ghost btn-sm"
                            onClick={() => setEditingCat(editingCat === c.id ? null : c.id)}>
                      {editingCat === c.id ? 'סגור' : 'ערוך'}
                    </button>
                    <button type="button" className="btn btn-ghost btn-sm text-danger" disabled={pending}
                            onClick={() => {
                              if (confirm(`למחוק את "${c.name.he}"? המוצרים יישארו, בלי שיוך.`)) {
                                run(() => deleteCategory(c.id));
                              }
                            }}>
                      מחק
                    </button>
                  </div>
                </div>

                {editingCat === c.id && (
                  <form
                    className="flex flex-wrap items-end gap-3 border-t border-line p-4"
                    action={(fd) => start(async () => {
                      const r = await runAction(() => saveCategory(fd)) as ActionResult;
                      setResult(r);
                      if (r.ok) setEditingCat(null);
                    })}
                  >
                    <input type="hidden" name="id" value={c.id} />
                    <label className="min-w-[10rem] flex-1">
                      <span className="label !mb-1">שם</span>
                      <input className="field" name="nameHe" required defaultValue={c.name.he} />
                    </label>
                    <label className="min-w-[10rem] flex-1">
                      <span className="label !mb-1">באנגלית</span>
                      <input className="field ltr" name="nameEn" defaultValue={c.name.en} />
                    </label>
                    <label>
                      <span className="label !mb-1">אייקון</span>
                      <select className="field" name="icon" defaultValue={c.icon}>
                        {ICONS.map((i) => <option key={i} value={i}>{i}</option>)}
                      </select>
                    </label>
                    <button type="submit" className="btn btn-accent btn-sm" disabled={pending}>שמירה</button>
                  </form>
                )}
              </li>
            ))}
            {categories.length === 0 && (
              <li className="card text-sm text-fg-muted">
                עוד אין קטגוריות. אפשר להוסיף מוצרים גם בלעדיהן, ולשייך אחר כך.
              </li>
            )}
          </ul>
        </>
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-3">
            <label className="min-w-[12rem] flex-1">
              <span className="label !mb-1">חיפוש</span>
              <input
                className="field" value={q} onChange={(e) => setQ(e.target.value)}
                placeholder="שם, מותג, ברקוד…"
              />
            </label>
            <label>
              <span className="label !mb-1">קטגוריה</span>
              <select className="field" value={filter} onChange={(e) => setFilter(e.target.value)}>
                <option value="all">הכל</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name.he}</option>)}
                <option value="none">ללא שיוך</option>
              </select>
            </label>
            <button type="button" className="btn btn-accent btn-sm" onClick={() => setAdding(!adding)}>
              {adding ? 'ביטול' : <><Icon name="plus" size={15} /> מוצר</>}
            </button>
          </div>

          {adding && (
            <ProductForm
              categories={categories}
              onDone={(r) => { setResult(r); if (r.ok) setAdding(false); }}
            />
          )}

          <p className="text-[.8rem] text-fg-subtle">
            מוצג <span className="clock">{shown.length}</span> מתוך{' '}
            <span className="clock">{products.length}</span>
          </p>

          <ul className="flex flex-col gap-2">
            {shown.map((p) => (
              <li key={p.id} className={`card !p-0 overflow-hidden ${p.isActive ? '' : 'opacity-60'}`}>
                <div className="flex flex-wrap items-start gap-3 p-3.5">
                  {p.imageUrl ? (
                    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-input border border-line">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.imageUrl} alt="" className="size-full object-cover" />
                    </div>
                  ) : (
                    <span className="grid size-12 shrink-0 place-items-center rounded-input bg-surface-sunk text-fg-subtle">
                      <Icon name="dish" size={18} />
                    </span>
                  )}

                  <div className="min-w-[11rem] flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <b>{p.name.he}</b>
                      <span className={`chip ${STATUS[p.status].chip}`}>{STATUS[p.status].label}</span>
                      {!p.isActive && <span className="chip chip-out">מוסתר</span>}
                    </div>
                    <span className="block text-[.8rem] text-fg-muted">
                      {[p.brand, p.certification, p.kosherType, catName.get(p.categoryId ?? '')]
                        .filter(Boolean).join(' · ') || '—'}
                    </span>
                    {p.notes.he && (
                      <span className="block text-[.78rem] text-accent-strong">{p.notes.he}</span>
                    )}
                    <span className="block text-[.72rem] text-fg-subtle">
                      {p.verifiedOn
                        ? <>נבדק <span className="clock">{p.verifiedOn}</span></>
                        : 'לא צוין תאריך בדיקה'}
                      {p.barcode && <> · <span className="clock">{p.barcode}</span></>}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button type="button" className="btn btn-ghost btn-sm" disabled={pending}
                            onClick={() => run(() => reverify(p.id))}>
                      נבדק היום
                    </button>
                    <button type="button" className={`btn btn-sm ${p.isActive ? 'btn-ghost' : 'btn-accent'}`}
                            disabled={pending}
                            onClick={() => run(() => toggleProduct(p.id, !p.isActive))}>
                      {p.isActive ? 'הסתר' : 'הצג'}
                    </button>
                    <button type="button" className="btn btn-ghost btn-sm"
                            onClick={() => setEditing(editing === p.id ? null : p.id)}>
                      {editing === p.id ? 'סגור' : 'ערוך'}
                    </button>
                    <button type="button" className="btn btn-ghost btn-sm text-danger" disabled={pending}
                            onClick={() => {
                              if (confirm(`למחוק את "${p.name.he}"?`)) run(() => deleteProduct(p.id));
                            }}>
                      מחק
                    </button>
                  </div>
                </div>

                {editing === p.id && (
                  <div className="border-t border-line p-4">
                    <ProductForm
                      product={p}
                      categories={categories}
                      onDone={(r) => { setResult(r); if (r.ok) setEditing(null); }}
                    />
                  </div>
                )}
              </li>
            ))}
            {shown.length === 0 && (
              <li className="card text-sm text-fg-muted">
                {products.length === 0
                  ? 'עוד אין מוצרים. הוסיפו את הראשון — גם "לא כשר" הוא תשובה שימושית.'
                  : 'אין מוצר שתואם לחיפוש.'}
              </li>
            )}
          </ul>
        </>
      )}

      {result?.message && (
        <p role="status" className={`rounded-input px-3 py-2 text-[.85rem] ${
          result.ok ? 'bg-accent-soft' : 'bg-danger/10 text-danger'}`}>
          {result.message}
        </p>
      )}
    </div>
  );
}
