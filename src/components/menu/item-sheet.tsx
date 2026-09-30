'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { MenuItem } from '@/lib/data/types';
import { formatLkr } from '@/lib/config';
import {
  defaultSelection, defaultStateFor, describeModifications, priceDelta,
  validateSelection, type ModifierGroup, type ModifierOption,
  type OptionState, type Selection,
} from '@/lib/data/modifiers';

const STATES: { v: OptionState; label: string }[] = [
  { v: 'in', label: 'בפנים' },
  { v: 'side', label: 'בצד' },
  { v: 'out', label: 'בלי' },
];

/**
 * An ingredient the dish already comes with. Three states, because "on the
 * side" is a genuinely different instruction to the kitchen than "in" or
 * "out" — it is the single most common request and it has nowhere to live in
 * a checkbox.
 */
function IncludedRow({
  option, value, onChange,
}: {
  option: ModifierOption;
  value: OptionState;
  onChange: (s: OptionState) => void;
}) {
  const states = option.allowSide ? STATES : STATES.filter((s) => s.v !== 'side');

  return (
    <div className="flex items-center gap-3 border-b border-line py-2.5 last:border-b-0">
      <span className="min-w-0 flex-1">{option.name.he}</span>
      <div
        className="flex shrink-0 overflow-hidden rounded-pill border border-line-strong"
        role="radiogroup"
        aria-label={option.name.he}
      >
        {states.map((st) => {
          const on = value === st.v;
          return (
            <button
              key={st.v}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange(st.v)}
              className={`px-3 py-1.5 text-[.78rem] font-medium transition-colors ${
                on
                  ? st.v === 'out'
                    ? 'bg-danger text-white'
                    : 'bg-accent text-fg-on-accent'
                  : 'bg-bg text-fg-muted hover:bg-surface'
              }`}
            >
              {st.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** A paid or optional extra: off by default, on when asked for. */
function ExtraRow({
  option, value, onChange,
}: {
  option: ModifierOption;
  value: OptionState;
  onChange: (s: OptionState) => void;
}) {
  const on = value === 'in' || value === 'side';
  return (
    <label className="flex cursor-pointer items-center gap-3 border-b border-line py-2.5 last:border-b-0">
      <input
        type="checkbox"
        checked={on}
        onChange={(e) => onChange(e.target.checked ? 'in' : 'out')}
        className="size-4 shrink-0 accent-[var(--accent)]"
      />
      <span className="min-w-0 flex-1">{option.name.he}</span>
      {option.priceDeltaLkr > 0 && (
        <span className="money shrink-0 text-[.82rem] text-fg-subtle">
          +{formatLkr(option.priceDeltaLkr)}
        </span>
      )}
    </label>
  );
}

/** Exactly one of these. A radio, because that is what it is. */
function ChoiceRow({
  option, name, checked, onChange,
}: {
  option: ModifierOption;
  name: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3 border-b border-line py-2.5 last:border-b-0">
      <input
        type="radio"
        name={name}
        checked={checked}
        onChange={onChange}
        className="size-4 shrink-0 accent-[var(--accent)]"
      />
      <span className="min-w-0 flex-1">{option.name.he}</span>
      {option.priceDeltaLkr > 0 && (
        <span className="money shrink-0 text-[.82rem] text-fg-subtle">
          +{formatLkr(option.priceDeltaLkr)}
        </span>
      )}
    </label>
  );
}

export function ItemSheet({
  item, onClose, onAdd,
}: {
  item: MenuItem;
  onClose: () => void;
  onAdd: (selection: Selection, qty: number) => void;
}) {
  const groups = item.modifierGroups;
  const [sel, setSel] = useState<Selection>(() => defaultSelection(groups));
  const [qty, setQty] = useState(1);
  const [showErrors, setShowErrors] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    // Stop the page behind the sheet from scrolling under the thumb.
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const errors = useMemo(() => validateSelection(groups, sel), [groups, sel]);
  const mods = useMemo(() => describeModifications(groups, sel), [groups, sel]);
  const unit = item.priceLkr + priceDelta(groups, sel);

  function setOption(group: ModifierGroup, option: ModifierOption, state: OptionState) {
    setSel((prev) => {
      const next = { ...prev, [option.id]: state };
      // A single-choice group holds exactly one selection.
      if (group.kind === 'single' && state !== 'out') {
        for (const o of group.options) if (o.id !== option.id) next[o.id] = 'out';
      }
      return next;
    });
  }

  function submit() {
    if (errors.length > 0) { setShowErrors(true); return; }
    onAdd(sel, qty);
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/45 sm:items-center"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={item.name.he}
        className="flex max-h-[92dvh] w-full max-w-[540px] flex-col rounded-t-card bg-bg sm:rounded-card"
      >
        <header className="flex items-start gap-3 border-b border-line p-5">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold">{item.name.he}</h2>
            <p className="mt-0.5 text-[.85rem] text-fg-muted">{item.description.he}</p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="סגור"
            className="grid size-9 shrink-0 place-items-center rounded-full border border-line-strong hover:bg-surface"
          >
            ✕
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-5">
          {groups.map((g) => {
            const err = showErrors ? errors.find((e) => e.groupId === g.id) : undefined;
            return (
              <section key={g.id} className="mb-6 last:mb-0">
                <div className="mb-1.5 flex items-baseline gap-2">
                  <h3 className="font-medium">{g.name.he}</h3>
                  {g.kind === 'single' && g.minSelect > 0 && (
                    <span className="chip">חובה</span>
                  )}
                  {g.kind === 'includes' && g.options.some((o) => o.isDefault) && (
                    <span className="text-[.75rem] text-fg-subtle">
                      הכול בפנים — סמנו מה להוריד
                    </span>
                  )}
                </div>

                {err && (
                  <p role="alert" className="mb-2 text-[.82rem] text-danger">{err.message}</p>
                )}

                <div className="rounded-input border border-line px-3.5">
                  {g.options
                    .filter((o) => o.isAvailable)
                    .map((o) => {
                      const state = sel[o.id] ?? defaultStateFor(g, o);

                      if (g.kind === 'single') {
                        return (
                          <ChoiceRow
                            key={o.id}
                            option={o}
                            name={g.id}
                            checked={state !== 'out'}
                            onChange={() => setOption(g, o, 'in')}
                          />
                        );
                      }
                      // Inside an 'includes' group, an option that is not part
                      // of the standard build is an extra, not a removal.
                      if (g.kind === 'includes' && o.isDefault) {
                        return (
                          <IncludedRow
                            key={o.id}
                            option={o}
                            value={state}
                            onChange={(st) => setOption(g, o, st)}
                          />
                        );
                      }
                      return (
                        <ExtraRow
                          key={o.id}
                          option={o}
                          value={state}
                          onChange={(st) => setOption(g, o, st)}
                        />
                      );
                    })}
                </div>
              </section>
            );
          })}
        </div>

        <footer className="border-t border-line p-5">
          {mods.length > 0 && (
            <p className="mb-3 text-[.82rem] text-fg-muted">
              <span className="font-medium text-fg">שינויים: </span>
              {mods.map((m) => m.text.he).join(' · ')}
            </p>
          )}

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 rounded-pill border border-line-strong">
              <button
                type="button"
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                aria-label="פחות"
                className="grid size-9 place-items-center rounded-full hover:bg-surface"
                disabled={qty <= 1}
              >
                −
              </button>
              <span className="clock w-6 text-center">{qty}</span>
              <button
                type="button"
                onClick={() => setQty((q) => Math.min(20, q + 1))}
                aria-label="עוד"
                className="grid size-9 place-items-center rounded-full hover:bg-surface"
              >
                +
              </button>
            </div>

            <button type="button" onClick={submit} className="btn btn-accent flex-1 justify-center">
              הוסף לעגלה · <span className="money">{formatLkr(unit * qty)}</span>
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
