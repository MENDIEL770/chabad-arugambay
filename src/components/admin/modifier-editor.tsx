'use client';

import { useState, useTransition } from 'react';
import { Icon } from '@/components/ui/icon';
import { formatLkr } from '@/lib/config';
import type { ModifierGroup, ModifierKind } from '@/lib/data/modifiers';
import { advanceOnEnter, digitsOnlyInput } from '@/lib/form-keyboard';
import {
  addModifierGroup, addModifierOption, addStandardSaladGroup,
  deleteModifierGroup, deleteModifierOption, updateModifierOption,
  type ActionResult,
} from '@/app/admin/restaurant/menu/modifier-actions';

const KIND_HELP: Record<ModifierKind, { label: string; help: string }> = {
  includes: {
    label: 'מה בפנים',
    help: 'רכיבים שהמנה מגיעה איתם. הלקוח יכול להוריד או לבקש בצד. לא מחייב תשלום.',
  },
  single: {
    label: 'בחירה אחת',
    help: 'הלקוח בוחר בדיוק אחד — לחם, גודל, רמת חריפות.',
  },
  multi: {
    label: 'תוספות',
    help: 'תוספות בתשלום שאפשר לסמן כמה מהן.',
  },
};

function Toast({ r }: { r: ActionResult | null }) {
  if (!r?.message) return null;
  return (
    <p
      role="status"
      className={`mt-2 rounded-input px-3 py-2 text-[.8rem] ${
        r.ok ? 'bg-accent-soft' : 'bg-danger/10 text-danger'
      }`}
    >
      {r.message}
    </p>
  );
}

function OptionRow({
  option, kind, onResult,
}: {
  option: ModifierGroup['options'][number];
  kind: ModifierKind;
  onResult: (r: ActionResult) => void;
}) {
  const [pending, start] = useTransition();

  return (
    <li className="flex flex-wrap items-center gap-2 border-b border-line py-2 last:border-b-0">
      <span className="min-w-0 flex-1 text-[.9rem]">{option.name.he}</span>

      {option.priceDeltaLkr > 0 ? (
        <span className="money text-[.8rem] text-fg-subtle">+{formatLkr(option.priceDeltaLkr)}</span>
      ) : (
        <span className="text-[.78rem] text-fg-subtle">ללא תוספת מחיר</span>
      )}

      {/* Only an 'includes' group has a meaningful notion of "comes with it"
          or "can be on the side". */}
      {kind === 'includes' && (
        <>
          <label className="flex items-center gap-1.5 text-[.76rem]">
            <input
              type="checkbox"
              className="size-3.5 accent-[var(--accent)]"
              checked={option.isDefault}
              disabled={pending}
              onChange={(e) =>
                start(async () =>
                  onResult(await updateModifierOption(option.id, { isDefault: e.target.checked })),
                )
              }
            />
            בא עם המנה
          </label>
          <label className="flex items-center gap-1.5 text-[.76rem]">
            <input
              type="checkbox"
              className="size-3.5 accent-[var(--accent)]"
              checked={option.allowSide}
              disabled={pending}
              onChange={(e) =>
                start(async () =>
                  onResult(await updateModifierOption(option.id, { allowSide: e.target.checked })),
                )
              }
            />
            אפשר בצד
          </label>
        </>
      )}

      <button
        type="button"
        disabled={pending}
        className={`chip ${option.isAvailable ? '' : 'chip-out'}`}
        onClick={() =>
          start(async () =>
            onResult(await updateModifierOption(option.id, { isAvailable: !option.isAvailable })),
          )
        }
      >
        {option.isAvailable ? 'זמין' : 'אזל'}
      </button>

      <button
        type="button"
        disabled={pending}
        aria-label={`מחק ${option.name.he}`}
        className="grid size-7 place-items-center rounded-full text-fg-subtle hover:bg-danger/10 hover:text-danger"
        onClick={() => start(async () => onResult(await deleteModifierOption(option.id)))}
      >
        <Icon name="x" size={13} />
      </button>
    </li>
  );
}

export function ModifierEditor({
  itemId,
  groups,
}: {
  itemId: string;
  groups: ModifierGroup[];
}) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [newGroup, setNewGroup] = useState(false);

  return (
    <section className="border-t border-line bg-surface px-4 py-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h3 className="font-medium">תוספות ואפשרויות</h3>
        <span className="text-[.78rem] text-fg-subtle">
          צ׳יפס בפנים או בחוץ, חריף או בלי, לחם, תוספות בתשלום
        </span>
        {groups.length === 0 && (
          <button
            type="button"
            className="btn btn-accent btn-sm ms-auto"
            disabled={pending}
            onClick={() => start(async () => setResult(await addStandardSaladGroup(itemId)))}
          >
            הוסיפו סלטים וצ׳יפס
          </button>
        )}
      </div>

      {groups.length === 0 && !newGroup && (
        <p className="text-[.84rem] text-fg-muted">
          למנה הזו אין עדיין אפשרויות. הכפתור למעלה מוסיף את שמונת הרכיבים
          הרגילים בלחיצה, או אפשר לבנות קבוצה משלכם.
        </p>
      )}

      <div className="flex flex-col gap-4">
        {groups.map((g) => (
          <div key={g.id} className="rounded-input border border-line bg-bg p-3.5">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <b className="text-[.92rem]">{g.name.he}</b>
              <span className="chip">{KIND_HELP[g.kind].label}</span>
              {g.kind === 'single' && g.minSelect > 0 && <span className="chip">חובה</span>}
              <button
                type="button"
                disabled={pending}
                className="ms-auto text-[.76rem] text-fg-subtle hover:text-danger"
                onClick={() => {
                  if (confirm(`למחוק את "${g.name.he}" ואת כל האפשרויות שבה?`)) {
                    start(async () => setResult(await deleteModifierGroup(g.id)));
                  }
                }}
              >
                מחק קבוצה
              </button>
            </div>
            <p className="mb-2 text-[.76rem] text-fg-subtle">{KIND_HELP[g.kind].help}</p>

            <ul className="flex flex-col">
              {g.options.map((o) => (
                <OptionRow key={o.id} option={o} kind={g.kind} onResult={setResult} />
              ))}
            </ul>

            {addingTo === g.id ? (
              <form
                className="mt-2 flex flex-wrap items-end gap-2"
                onKeyDown={advanceOnEnter}
                action={(fd) =>
                  start(async () => {
                    setResult(await addModifierOption(fd));
                    setAddingTo(null);
                  })
                }
              >
                <input type="hidden" name="groupId" value={g.id} />
                <label className="flex-1">
                  <span className="label !mb-1">שם</span>
                  <input className="field" name="nameHe" required autoFocus placeholder="ביצה קשה" />
                </label>
                <label className="w-28">
                  <span className="label !mb-1">תוספת LKR</span>
                  <input
                    className="field money"
                    name="priceDeltaLkr"
                    defaultValue={0}
                    inputMode="numeric"
                    onInput={digitsOnlyInput}
                  />
                </label>
                {g.kind === 'includes' && (
                  <>
                    <label className="flex items-center gap-1.5 pb-2.5 text-[.78rem]">
                      <input type="checkbox" name="isDefault" className="size-3.5 accent-[var(--accent)]" />
                      בא עם המנה
                    </label>
                    <label className="flex items-center gap-1.5 pb-2.5 text-[.78rem]">
                      <input type="checkbox" name="allowSide" defaultChecked className="size-3.5 accent-[var(--accent)]" />
                      אפשר בצד
                    </label>
                  </>
                )}
                <button type="submit" className="btn btn-accent btn-sm" disabled={pending}>
                  הוסף
                </button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAddingTo(null)}>
                  ביטול
                </button>
              </form>
            ) : (
              <button
                type="button"
                className="btn btn-ghost btn-sm mt-2"
                onClick={() => setAddingTo(g.id)}
              >
                + אפשרות
              </button>
            )}
          </div>
        ))}
      </div>

      {newGroup ? (
        <form
          className="mt-4 flex flex-wrap items-end gap-2 rounded-input border border-line bg-bg p-3.5"
          onKeyDown={advanceOnEnter}
          action={(fd) =>
            start(async () => {
              setResult(await addModifierGroup(fd));
              setNewGroup(false);
            })
          }
        >
          <input type="hidden" name="itemId" value={itemId} />
          <label className="flex-1">
            <span className="label !mb-1">שם הקבוצה</span>
            <input className="field" name="nameHe" required autoFocus placeholder="רמת חריפות" />
          </label>
          <label>
            <span className="label !mb-1">סוג</span>
            <select className="field" name="kind" defaultValue="single">
              {(Object.keys(KIND_HELP) as ModifierKind[]).map((k) => (
                <option key={k} value={k}>{KIND_HELP[k].label}</option>
              ))}
            </select>
          </label>
          <label className="w-20">
            <span className="label !mb-1">מינימום</span>
            <input className="field money" name="minSelect" defaultValue={0} inputMode="numeric" onInput={digitsOnlyInput} />
          </label>
          <label className="w-20">
            <span className="label !mb-1">מקסימום</span>
            <input className="field money" name="maxSelect" defaultValue={1} inputMode="numeric" onInput={digitsOnlyInput} />
          </label>
          <button type="submit" className="btn btn-accent btn-sm" disabled={pending}>צור</button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setNewGroup(false)}>ביטול</button>
        </form>
      ) : (
        <button type="button" className="btn btn-ghost btn-sm mt-4" onClick={() => setNewGroup(true)}>
          + קבוצה חדשה
        </button>
      )}

      <Toast r={result} />
    </section>
  );
}
