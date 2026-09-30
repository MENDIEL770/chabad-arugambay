import { describe, expect, it } from 'vitest';
import { digitsOnlyInput } from './form-keyboard';

function fakeInput(value: string) {
  const calls: number[][] = [];
  const el = {
    value,
    selectionStart: value.length,
    setSelectionRange: (a: number, b: number) => calls.push([a, b]),
  };
  return { el, calls, event: { currentTarget: el } as unknown as React.FormEvent<HTMLInputElement> };
}

describe('numeric fields reject letters', () => {
  it('strips letters typed into a number field', () => {
    const { el, event } = fakeInput('05a0b1');
    digitsOnlyInput(event);
    expect(el.value).toBe('0501');
  });

  it('strips pasted text entirely', () => {
    const { el, event } = fakeInput('abc');
    digitsOnlyInput(event);
    expect(el.value).toBe('');
  });

  it('leaves a clean number untouched, and does not move the caret', () => {
    const { el, calls, event } = fakeInput('0501234567');
    digitsOnlyInput(event);
    expect(el.value).toBe('0501234567');
    expect(calls).toHaveLength(0);
  });

  it('removes separators people paste from contacts', () => {
    const { el, event } = fakeInput('050-123 4567');
    digitsOnlyInput(event);
    expect(el.value).toBe('0501234567');
  });
});
