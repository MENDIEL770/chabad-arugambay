/**
 * Enter moves to the next field instead of submitting.
 *
 * On a phone the on-screen keyboard shows a "next"/"go" key, and the
 * instinct is to press it after every field. The browser default is to
 * submit the whole form on the first one, which sends a half-empty order.
 * Enter now advances; only the last field, or an explicit submit button,
 * actually submits.
 *
 * Textareas keep Enter as a newline — somebody writing delivery notes means
 * a line break, not "next".
 */
const FOCUSABLE =
  'input:not([type=hidden]):not([disabled]),select:not([disabled]),textarea:not([disabled]),button[type=submit]';

export function advanceOnEnter(e: React.KeyboardEvent<HTMLFormElement>): void {
  if (e.key !== 'Enter') return;

  const target = e.target as HTMLElement;
  if (target instanceof HTMLTextAreaElement) return;
  if (target instanceof HTMLButtonElement) return;

  const form = e.currentTarget;
  const fields = Array.from(form.querySelectorAll<HTMLElement>(FOCUSABLE));
  const index = fields.indexOf(target);
  if (index === -1) return;

  const next = fields[index + 1];
  // Nothing after this one: let the browser submit as it normally would.
  if (!next) return;

  e.preventDefault();

  if (next instanceof HTMLButtonElement) {
    next.focus();
    return;
  }
  next.focus();
  if (next instanceof HTMLInputElement && next.type !== 'checkbox' && next.type !== 'radio') {
    // Put the caret at the end rather than selecting, so a half-typed value
    // is not wiped by the next keystroke.
    const v = next.value;
    next.setSelectionRange?.(v.length, v.length);
  }
}

/** Keep only digits, for fields that are numbers and nothing else. */
export function digitsOnlyInput(e: React.FormEvent<HTMLInputElement>): void {
  const el = e.currentTarget;
  const cleaned = el.value.replace(/\D/g, '');
  if (cleaned !== el.value) {
    const pos = el.selectionStart ?? cleaned.length;
    el.value = cleaned;
    el.setSelectionRange?.(Math.max(0, pos - 1), Math.max(0, pos - 1));
  }
}
