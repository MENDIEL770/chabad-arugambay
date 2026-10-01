'use client';

import { useId, useRef, useState } from 'react';
import { Icon, type IconName } from '@/components/ui/icon';
import { RichText } from '@/components/ui/rich-text';

/**
 * A textarea with a small formatting bar.
 *
 * Uncontrolled on purpose. The textarea owns its value and the toolbar
 * edits it through setRangeText, which keeps the browser's own undo stack
 * intact — a controlled React textarea throws that away, and losing ⌘Z
 * halfway through writing a paragraph is worse than having no toolbar.
 *
 * The preview re-reads the DOM rather than mirroring every keystroke into
 * state, so typing stays cheap and there is no render-loop to get wrong.
 */

type Mark = { label: string; icon: IconName; wrap: [string, string]; hint: string };

const MARKS: Mark[] = [
  { label: 'מודגש', icon: 'bold', wrap: ['**', '**'], hint: 'טקסט מודגש' },
  { label: 'נטוי', icon: 'italic', wrap: ['*', '*'], hint: 'טקסט נטוי' },
];

export function RichTextField({
  name, defaultValue = '', rows = 5, label, hint, dir = 'rtl', required = false,
}: {
  name: string;
  defaultValue?: string;
  rows?: number;
  label: string;
  hint?: string;
  dir?: 'rtl' | 'ltr';
  required?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const id = useId();
  const [preview, setPreview] = useState<string | null>(null);

  function apply(before: string, after: string, placeholder: string) {
    const el = ref.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e } = el;
    const chosen = el.value.slice(s, e) || placeholder;

    el.focus();
    el.setRangeText(before + chosen + after, s, e, 'select');
    // Put the caret inside the marks when nothing was selected, so the next
    // keystroke lands where the writer expects.
    if (s === e) {
      el.setSelectionRange(s + before.length, s + before.length + chosen.length);
    }
    // React does not see setRangeText; this tells the form the value moved.
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function addLink() {
    const el = ref.current;
    if (!el) return;
    const selected = el.value.slice(el.selectionStart, el.selectionEnd);
    const url = window.prompt('כתובת הקישור:', 'https://');
    if (!url || url === 'https://') return;
    if (!/^(https?:\/\/|mailto:|tel:|\/)/i.test(url)) {
      window.alert('הקישור חייב להתחיל ב-https:// (או mailto: / tel:)');
      return;
    }
    apply('[', `](${url})`, selected || 'לחצו כאן');
  }

  return (
    <div>
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <label className="label !mb-0" htmlFor={id}>{label}</label>

        <div className="flex items-center gap-1">
          {MARKS.map((m) => (
            <button
              key={m.label}
              type="button"
              title={m.label}
              aria-label={m.label}
              className="grid size-7 place-items-center rounded-input text-fg-muted hover:bg-accent-soft hover:text-accent-strong"
              onClick={() => apply(m.wrap[0], m.wrap[1], m.hint)}
            >
              <Icon name={m.icon} size={15} />
            </button>
          ))}
          <button
            type="button" title="קישור" aria-label="הוספת קישור"
            className="grid size-7 place-items-center rounded-input text-fg-muted hover:bg-accent-soft hover:text-accent-strong"
            onClick={addLink}
          >
            <Icon name="link" size={15} />
          </button>
          <button
            type="button" title="רשימה" aria-label="רשימת תבליטים"
            className="grid size-7 place-items-center rounded-input text-fg-muted hover:bg-accent-soft hover:text-accent-strong"
            onClick={() => apply('\n- ', '', 'פריט')}
          >
            <Icon name="list" size={15} />
          </button>

          <span className="mx-1 h-4 w-px bg-line" />

          <button
            type="button"
            className="rounded-input px-2 py-1 text-[.74rem] text-fg-muted hover:bg-accent-soft hover:text-accent-strong"
            onClick={() => setPreview(preview === null ? (ref.current?.value ?? '') : null)}
          >
            {preview === null ? 'תצוגה מקדימה' : 'חזרה לעריכה'}
          </button>
        </div>
      </div>

      {/* The textarea stays mounted while previewing — unmounting it would
          drop the value out of the form and lose the draft. */}
      <div className={preview === null ? '' : 'hidden'}>
        <textarea
          id={id}
          ref={ref}
          name={name}
          rows={rows}
          dir={dir}
          required={required}
          defaultValue={defaultValue}
          className={`field ${dir === 'ltr' ? 'ltr' : ''}`}
        />
      </div>

      {preview !== null && (
        <div className="min-h-[6rem] rounded-input border border-dashed border-line bg-surface p-3 text-sm">
          {preview.trim()
            ? <RichText source={preview} />
            : <span className="text-fg-subtle">אין טקסט להצגה.</span>}
        </div>
      )}

      <p className="mt-1 text-[.72rem] text-fg-subtle">
        {hint ? `${hint} · ` : ''}
        <code className="ltr">**מודגש**</code> · <code className="ltr">*נטוי*</code> ·{' '}
        <code className="ltr">[טקסט](כתובת)</code> · שורה שמתחילה ב-<code className="ltr">-</code> היא תבליט
      </p>
    </div>
  );
}
