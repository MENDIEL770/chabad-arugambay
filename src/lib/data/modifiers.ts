import type { I18n } from './types';

export type ModifierKind = 'includes' | 'single' | 'multi';

/** What the customer decided about one option. */
export type OptionState = 'in' | 'out' | 'side';

export interface ModifierOption {
  id: string;
  name: I18n;
  priceDeltaLkr: number;
  /** Part of the standard build (kind = 'includes'). */
  isDefault: boolean;
  allowSide: boolean;
  isAvailable: boolean;
}

export interface ModifierGroup {
  id: string;
  name: I18n;
  kind: ModifierKind;
  minSelect: number;
  maxSelect: number;
  options: ModifierOption[];
}

/** option id → state. Absent means "not chosen" for single/multi groups. */
export type Selection = Record<string, OptionState>;

/** The state an option sits in before the customer touches anything. */
export function defaultStateFor(group: ModifierGroup, option: ModifierOption): OptionState {
  if (group.kind === 'includes') return option.isDefault ? 'in' : 'out';
  return 'out';
}

export function defaultSelection(groups: ModifierGroup[]): Selection {
  const sel: Selection = {};
  for (const g of groups) {
    for (const o of g.options) sel[o.id] = defaultStateFor(g, o);
    // A 'single' group with a required choice starts on its first available
    // option, so the customer is never blocked by an empty required group
    // they did not notice.
    if (g.kind === 'single' && g.minSelect > 0) {
      const first = g.options.find((o) => o.isAvailable);
      if (first) sel[first.id] = 'in';
    }
  }
  return sel;
}

export function priceDelta(groups: ModifierGroup[], sel: Selection): number {
  let delta = 0;
  for (const g of groups) {
    for (const o of g.options) {
      const state = sel[o.id] ?? defaultStateFor(g, o);
      // Removing something never refunds, and "on the side" is not an upsell.
      if (state === 'out') continue;
      if (g.kind === 'includes' && o.isDefault) continue;
      delta += o.priceDeltaLkr;
    }
  }
  return delta;
}

export interface Modification {
  text: I18n;
  /** 'removal' and 'side' are exceptions the kitchen must not miss. */
  kind: 'removal' | 'side' | 'addition' | 'choice';
}

/**
 * Describe only what differs from the standard build.
 *
 * This is the whole point of the feature. A cook reading "חומוס, טחינה,
 * חריף, עגבניה, מלפפון, בצל, צ׳יפס" on every ticket stops reading it, and
 * the one ticket that says "בלי בצל" gets made with onion. So an 'includes'
 * option that is still 'in' produces nothing at all.
 */
export function describeModifications(
  groups: ModifierGroup[],
  sel: Selection,
): Modification[] {
  const out: Modification[] = [];

  for (const g of groups) {
    for (const o of g.options) {
      const state = sel[o.id] ?? defaultStateFor(g, o);

      if (g.kind === 'includes') {
        if (o.isDefault && state === 'out') {
          out.push({ text: { he: `בלי ${o.name.he}`, en: `No ${o.name.en}` }, kind: 'removal' });
        } else if (state === 'side') {
          out.push({ text: { he: `${o.name.he} בצד`, en: `${o.name.en} on the side` }, kind: 'side' });
        } else if (!o.isDefault && state === 'in') {
          out.push({ text: { he: `תוספת ${o.name.he}`, en: `Add ${o.name.en}` }, kind: 'addition' });
        }
        continue;
      }

      if (state === 'in') {
        out.push({
          text: { he: o.name.he, en: o.name.en },
          kind: g.kind === 'single' ? 'choice' : 'addition',
        });
      } else if (state === 'side') {
        out.push({ text: { he: `${o.name.he} בצד`, en: `${o.name.en} on the side` }, kind: 'side' });
      }
    }
  }

  return out;
}

export interface ValidationError {
  groupId: string;
  message: string;
}

/** Enforce min/max on choice groups before the line can enter the cart. */
export function validateSelection(
  groups: ModifierGroup[],
  sel: Selection,
): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const g of groups) {
    if (g.kind === 'includes') continue;
    const chosen = g.options.filter((o) => {
      const s = sel[o.id];
      return s === 'in' || s === 'side';
    }).length;

    if (chosen < g.minSelect) {
      errors.push({
        groupId: g.id,
        message:
          g.minSelect === 1
            ? `צריך לבחור ${g.name.he}`
            : `צריך לבחור לפחות ${g.minSelect} מתוך ${g.name.he}`,
      });
    }
    if (chosen > g.maxSelect) {
      errors.push({
        groupId: g.id,
        message: `אפשר לבחור עד ${g.maxSelect} מתוך ${g.name.he}`,
      });
    }
  }

  return errors;
}

/**
 * Stable identity for a cart line.
 *
 * Two laffas, one without onion, must be two lines — not one with qty 2.
 * Sorting keeps the key stable regardless of the order the customer clicked.
 */
export function selectionKey(itemId: string, sel: Selection): string {
  const parts = Object.entries(sel)
    .filter(([, s]) => s !== 'out')
    .map(([id, s]) => `${id}:${s}`)
    .sort();
  return parts.length ? `${itemId}|${parts.join(',')}` : itemId;
}
