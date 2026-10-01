'use client';

import { useState, useTransition } from 'react';
import { Icon, type IconName } from '@/components/ui/icon';
import { TIER_LABEL, type TravelTier } from '@/lib/data/content';
import type { Stay, Tip } from '@/lib/data/travel';
import { runAction } from '@/lib/run-action';
import {
  deleteStay, deleteTip, importSeedTravel, saveStay, saveTip, toggleStay,
  type ActionResult,
} from '@/app/admin/content/travel/actions';

const TIERS: TravelTier[] = ['luxury', 'standard', 'backpacker', 'family'];
const ICONS: IconName[] = ['bed', 'palm', 'surf', 'hut', 'map', 'waves', 'binoculars', 'tuktuk', 'mountain', 'bus', 'leaf'];

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

function StayForm({
  stay, onDone,
}: {
  stay?: Stay;
  onDone: (r: ActionResult) => void;
}) {
  const [pending, start] = useTransition();
  const [affiliate, setAffiliate] = useState(stay?.isAffiliate ?? false);

  return (
    <form
      className="grid grid-cols-2 gap-3 rounded-input border border-line bg-surface p-4 max-[700px]:grid-cols-1"
      action={(fd) => start(async () => onDone(await runAction(() => saveStay(fd)) as ActionResult))}
    >
      {stay && <input type="hidden" name="id" value={stay.id} />}

      <label className="col-span-2 max-[700px]:col-span-1">
        <span className="label !mb-1">שם המקום</span>
        <input className="field ltr" name="name" defaultValue={stay?.name} required />
      </label>

      <label>
        <span className="label !mb-1">תיאור (עברית)</span>
        <input className="field" name="blurbHe" defaultValue={stay?.blurb.he} />
      </label>
      <label>
        <span className="label !mb-1">תיאור (English)</span>
        <input className="field ltr" name="blurbEn" defaultValue={stay?.blurb.en} />
      </label>

      <label>
        <span className="label !mb-1">מחיר ללילה ($)</span>
        <input className="field money" name="nightlyUsd" inputMode="numeric" defaultValue={stay?.nightlyUsd ?? ''} />
      </label>
      <label>
        <span className="label !mb-1">דקות הליכה מבית חב״ד</span>
        <input className="field money" name="walkMinutes" inputMode="numeric" defaultValue={stay?.walkMinutes ?? ''} />
      </label>

      <fieldset className="col-span-2 max-[700px]:col-span-1">
        <legend className="label !mb-1">רמת תקציב</legend>
        <div className="flex flex-wrap gap-3">
          {TIERS.map((t) => (
            <label key={t} className="flex items-center gap-1.5 text-[.85rem]">
              <input
                type="checkbox"
                name={`tier_${t}`}
                defaultChecked={stay?.tiers.includes(t)}
                className="size-4 accent-[var(--accent)]"
              />
              {TIER_LABEL[t]}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="col-span-2 max-[700px]:col-span-1">
        <span className="label !mb-1">קישור הזמנה</span>
        <input
          className="field ltr"
          name="bookingUrl"
          placeholder="https://www.booking.com/hotel/...?aid=YOUR_ID"
          defaultValue={stay?.bookingUrl ?? ''}
        />
        <span className="mt-1 block text-[.74rem] text-fg-subtle">
          הדביקו את הקישור המלא מ-Booking כולל ה-<code className="ltr">aid</code> שלכם.
        </span>
      </label>

      <label className="col-span-2 flex items-start gap-2.5 max-[700px]:col-span-1">
        <input
          type="checkbox"
          name="isAffiliate"
          checked={affiliate}
          onChange={(e) => setAffiliate(e.target.checked)}
          className="mt-0.5 size-4 accent-[var(--accent)]"
        />
        <span>
          <span className="block text-[.88rem] font-medium">זהו קישור שותף</span>
          <span className="block text-[.74rem] text-fg-subtle">
            יוצג לגולשים כגילוי נאות. חובה חוקית ברוב המדינות, וגם פשוט הוגן.
          </span>
        </span>
      </label>

      <label>
        <span className="label !mb-1">אייקון</span>
        <select className="field" name="icon" defaultValue={stay?.icon ?? 'bed'}>
          {ICONS.map((i) => <option key={i} value={i}>{i}</option>)}
        </select>
      </label>

      <div className="col-span-2 flex gap-2 max-[700px]:col-span-1">
        <button type="submit" className="btn btn-accent btn-sm" disabled={pending}>
          {pending ? 'שומר…' : stay ? 'שמירה' : 'הוספה'}
        </button>
      </div>
    </form>
  );
}

export function TravelManager({ stays, tips }: { stays: Stay[]; tips: Tip[] }) {
  const [result, setResult] = useState<ActionResult | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [addingTip, setAddingTip] = useState(false);
  const [pending, start] = useTransition();

  const empty = stays.length === 0 && tips.length === 0;

  return (
    <div className="flex flex-col gap-8">
      {empty && (
        <div className="card">
          <p className="font-medium">אין עדיין המלצות בבסיס הנתונים.</p>
          <p className="mt-1 text-[.85rem] text-fg-muted">
            דף הטיולים מציג כרגע ארבע המלצות שכתובות בקוד. אפשר לייבא אותן
            לכאן ואז לערוך אותן חופשי.
          </p>
          <button
            type="button"
            className="btn btn-accent btn-sm mt-3"
            disabled={pending}
            onClick={() => start(async () => setResult(await runAction(importSeedTravel) as ActionResult))}
          >
            ייבוא ההמלצות הקיימות
          </button>
        </div>
      )}

      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold">איפה לישון</h2>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAdding((a) => !a)}>
            {adding ? 'ביטול' : '+ מקום'}
          </button>
        </div>

        {adding && (
          <div className="mb-4">
            <StayForm onDone={(r) => { setResult(r); if (r.ok) setAdding(false); }} />
          </div>
        )}

        <ul className="flex flex-col gap-3">
          {stays.map((s) => (
            <li key={s.id} className="card !p-0 overflow-hidden">
              <div className="flex flex-wrap items-center gap-3 p-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-input bg-accent-soft text-accent-strong">
                  <Icon name={s.icon} size={19} />
                </span>

                <div className="min-w-[12rem] flex-1">
                  <b className="ltr block">{s.name}</b>
                  <span className="block text-[.8rem] text-fg-muted">{s.blurb.he}</span>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    {s.tiers.map((t) => <span key={t} className="chip">{TIER_LABEL[t]}</span>)}
                    {s.nightlyUsd !== null && <span className="chip money">${s.nightlyUsd}</span>}
                    {s.isAffiliate && <span className="chip chip-kosher">קישור שותף</span>}
                    {!s.bookingUrl && <span className="chip chip-out">אין קישור</span>}
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    className={`btn btn-sm ${s.isActive ? 'btn-ghost' : 'btn-accent'}`}
                    disabled={pending}
                    onClick={() => start(async () =>
                      setResult(await runAction(() => toggleStay(s.id, !s.isActive)) as ActionResult))}
                  >
                    {s.isActive ? 'הסתר' : 'הצג'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => setEditing(editing === s.id ? null : s.id)}
                  >
                    {editing === s.id ? 'סגור' : 'ערוך'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm text-danger"
                    disabled={pending}
                    onClick={() => {
                      if (confirm(`למחוק את ${s.name}?`)) {
                        start(async () => setResult(await runAction(() => deleteStay(s.id)) as ActionResult));
                      }
                    }}
                  >
                    מחק
                  </button>
                </div>
              </div>

              {editing === s.id && (
                <div className="border-t border-line p-4">
                  <StayForm stay={s} onDone={(r) => { setResult(r); if (r.ok) setEditing(null); }} />
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold">מה לעשות</h2>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAddingTip((a) => !a)}>
            {addingTip ? 'ביטול' : '+ המלצה'}
          </button>
        </div>

        {addingTip && (
          <form
            className="mb-4 grid grid-cols-2 gap-3 rounded-input border border-line bg-surface p-4 max-[700px]:grid-cols-1"
            action={(fd) => start(async () => {
              const r = await runAction(() => saveTip(fd)) as ActionResult;
              setResult(r);
              if (r.ok) setAddingTip(false);
            })}
          >
            <label>
              <span className="label !mb-1">כותרת (עברית)</span>
              <input className="field" name="titleHe" required />
            </label>
            <label>
              <span className="label !mb-1">כותרת (English)</span>
              <input className="field ltr" name="titleEn" />
            </label>
            <label className="col-span-2 max-[700px]:col-span-1">
              <span className="label !mb-1">תוכן (עברית)</span>
              <textarea className="field" name="bodyHe" rows={3} />
            </label>
            <label>
              <span className="label !mb-1">תגיות (מופרדות בפסיק)</span>
              <input className="field" name="tags" placeholder="גלישה, מתחילים" />
            </label>
            <label>
              <span className="label !mb-1">אייקון</span>
              <select className="field" name="icon" defaultValue="map">
                {ICONS.map((i) => <option key={i} value={i}>{i}</option>)}
              </select>
            </label>
            <div className="col-span-2 max-[700px]:col-span-1">
              <button type="submit" className="btn btn-accent btn-sm" disabled={pending}>הוספה</button>
            </div>
          </form>
        )}

        <ul className="flex flex-col gap-2">
          {tips.map((t) => (
            <li key={t.id} className="card flex items-start gap-3 !p-4">
              <span className="grid size-9 shrink-0 place-items-center rounded-input bg-accent-soft text-accent-strong">
                <Icon name={t.icon} size={17} />
              </span>
              <div className="min-w-0 flex-1">
                <b className="block">{t.title.he}</b>
                <span className="block text-[.82rem] text-fg-muted">{t.body.he}</span>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {t.tags.map((tag) => <span key={tag} className="chip">{tag}</span>)}
                </div>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm text-danger"
                disabled={pending}
                onClick={() => {
                  if (confirm(`למחוק את "${t.title.he}"?`)) {
                    start(async () => setResult(await runAction(() => deleteTip(t.id)) as ActionResult));
                  }
                }}
              >
                מחק
              </button>
            </li>
          ))}
        </ul>
      </section>

      <Toast r={result} />
    </div>
  );
}
