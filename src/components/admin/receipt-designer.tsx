'use client';

import { useMemo, useState, useTransition } from 'react';
import {
  PAPER_COLS, SAMPLE_ORDER, renderKitchenTicket, renderReceipt,
  type ReceiptTemplate,
} from '@/lib/receipt';
import { saveReceiptTemplate, type ActionResult } from '@/app/admin/restaurant/receipt/actions';

/**
 * Paper preview.
 *
 * Rendered from the same function the printer uses, at the same character
 * width, so what is on screen is the shape that comes out of the machine —
 * including where a long dish name will be cut off.
 */
function Paper({ lines, cols }: { lines: string[]; cols: number }) {
  return (
    <div
      className="overflow-x-auto rounded-sm bg-white p-4 shadow-lg"
      style={{ width: `${cols * 8.2 + 32}px`, maxWidth: '100%' }}
    >
      <pre
        dir="ltr"
        className="whitespace-pre font-mono text-[12px] leading-[1.45] text-black"
      >
        {lines.join('\n')}
      </pre>
    </div>
  );
}

export function ReceiptDesigner({ initial }: { initial: ReceiptTemplate }) {
  const [t, setT] = useState(initial);
  const [tab, setTab] = useState<'customer' | 'kitchen'>('customer');
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();

  const cols = PAPER_COLS[t.paperWidth] ?? 48;

  const lines = useMemo(
    () => (tab === 'customer' ? renderReceipt(t, SAMPLE_ORDER) : renderKitchenTicket(t, SAMPLE_ORDER)),
    [t, tab],
  );

  const tooLong = useMemo(
    () => lines.filter((l) => l.length > cols).length,
    [lines, cols],
  );

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-8 max-[1000px]:grid-cols-1">
      <form
        className="flex flex-col gap-4"
        action={(fd) => start(async () => setResult(await saveReceiptTemplate(fd)))}
      >
        <label>
          <span className="label">שורות כותרת</span>
          <textarea
            className="field font-mono"
            name="header"
            rows={4}
            defaultValue={t.headerLines.join('\n')}
            onChange={(e) => setT({ ...t, headerLines: e.target.value.split('\n').filter(Boolean) })}
          />
          <span className="mt-1 block text-[.75rem] text-fg-subtle">
            שורה אחת לכל שורה בקבלה. עד 8.
          </span>
        </label>

        <label>
          <span className="label">שורות סיום</span>
          <textarea
            className="field font-mono"
            name="footer"
            rows={3}
            defaultValue={t.footerLines.join('\n')}
            onChange={(e) => setT({ ...t, footerLines: e.target.value.split('\n').filter(Boolean) })}
          />
        </label>

        <label>
          <span className="label">רוחב נייר</span>
          <select
            className="field"
            name="paperWidth"
            value={t.paperWidth}
            onChange={(e) => setT({ ...t, paperWidth: Number(e.target.value) })}
          >
            <option value={80}>80 מ״מ — 48 תווים (רגיל)</option>
            <option value={58}>58 מ״מ — 32 תווים (צר)</option>
          </select>
        </label>

        <fieldset className="flex flex-col gap-2.5">
          <legend className="label">מה להדפיס</legend>
          {([
            ['showLogo', 'לוגו בראש הקבלה', t.showLogo],
            ['showQr', 'קוד QR למעקב אחרי ההזמנה', t.showQr],
            ['showPrices', 'מחירים בקבלת הלקוח', t.showPrices],
            ['kitchenShowPrices', 'מחירים גם בכרטיס המטבח', t.kitchenShowPrices],
          ] as const).map(([key, label, checked]) => (
            <label key={key} className="flex items-center gap-2.5 text-[.9rem]">
              <input
                type="checkbox"
                name={key}
                className="size-4 accent-[var(--accent)]"
                checked={checked}
                onChange={(e) => setT({ ...t, [key]: e.target.checked })}
              />
              {label}
            </label>
          ))}
          <p className="text-[.76rem] text-fg-subtle">
            כרטיס המטבח בדרך כלל בלי מחירים — הטבח לא צריך אותם, וזה עוד
            משהו לקרוא לא נכון בלחץ.
          </p>
        </fieldset>

        {tooLong > 0 && (
          <p className="rounded-input bg-danger/10 px-3 py-2 text-[.82rem] text-danger">
            {tooLong} שורות ארוכות מ-{cols} תווים וייחתכו בהדפסה.
          </p>
        )}

        <div>
          <button type="submit" className="btn btn-accent" disabled={pending}>
            {pending ? 'שומר…' : 'שמירת התבנית'}
          </button>
        </div>

        {result?.message && (
          <p
            role="status"
            className={`rounded-input px-3 py-2 text-[.84rem] ${
              result.ok ? 'bg-accent-soft' : 'bg-danger/10 text-danger'
            }`}
          >
            {result.message}
          </p>
        )}
      </form>

      <div className="flex flex-col gap-3">
        <div className="flex gap-1.5">
          {([
            ['customer', 'קבלת לקוח'],
            ['kitchen', 'כרטיס מטבח'],
          ] as const).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setTab(k)}
              aria-pressed={tab === k}
              className={`rounded-pill px-4 py-1.5 text-[.84rem] font-medium transition-colors ${
                tab === k
                  ? 'bg-accent text-fg-on-accent'
                  : 'border border-line-strong text-fg-muted hover:bg-surface'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <Paper lines={lines} cols={cols} />

        <p className="max-w-[44ch] text-[.76rem] text-fg-subtle">
          התצוגה נבנית מאותה פונקציה ששולחת למדפסת, באותו רוחב תווים — מה
          שנראה כאן הוא מה שייצא מהנייר.
        </p>
      </div>
    </div>
  );
}
