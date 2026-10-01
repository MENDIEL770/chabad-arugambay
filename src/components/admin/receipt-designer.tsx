'use client';

import { useMemo, useRef, useState, useTransition } from 'react';
import { Icon } from '@/components/ui/icon';
import {
  PAPER_COLS, SAMPLE_ORDER, renderKitchenTicket, renderReceipt,
  type ReceiptTemplate, type RenderedLine,
} from '@/lib/receipt';
import {
  RECEIPT_IMAGE_SPEC, removeReceiptImage, saveReceiptTemplate, uploadReceiptImage,
  type ActionResult, type ReceiptImageSlot,
} from '@/app/admin/restaurant/receipt/actions';

/**
 * Paper preview.
 *
 * Rendered from the same function the printer uses, at the same character
 * width, so what is on screen is the shape that comes out of the machine —
 * including where a long dish name will be cut off.
 */
/**
 * Paper preview.
 *
 * Each line is its own element rather than one <pre>, because a single
 * left-to-right block reverses Hebrew. Grid rows stay monospace and LTR so
 * the money columns line up; centred prose is centred by CSS and takes its
 * direction from its own content, which is what lets a Hebrew header read
 * correctly beside an English one.
 */
function Paper({
  lines, cols, logoUrl, headerImageUrl, footerImageUrl,
}: {
  lines: RenderedLine[];
  cols: number;
  logoUrl?: string | null;
  headerImageUrl?: string | null;
  footerImageUrl?: string | null;
}) {
  return (
    <div
      className="overflow-x-auto rounded-sm bg-white p-4 shadow-lg"
      style={{ width: `${cols * 8.2 + 32}px`, maxWidth: '100%' }}
    >
      {headerImageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={headerImageUrl} alt="" className="mb-2 w-full" />
      )}
      {logoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt="" className="mx-auto mb-2 max-h-16 w-auto" />
      )}

      <div className="font-mono text-[12px] leading-[1.45] text-black">
        {lines.map((l, i) =>
          l.kind === 'centre' ? (
            <div key={i} dir="auto" className="text-center whitespace-pre-wrap">
              {l.text || '\u00a0'}
            </div>
          ) : (
            <div key={i} dir="ltr" className="whitespace-pre">
              {l.text || '\u00a0'}
            </div>
          ),
        )}
      </div>

      {footerImageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={footerImageUrl} alt="" className="mt-2 w-full" />
      )}
    </div>
  );
}

/** Upload, preview and clear one of the three receipt images. */
function ImageSlot({
  slot, label, hint, url, onResult,
}: {
  slot: ReceiptImageSlot;
  label: string;
  hint: string;
  url?: string | null;
  onResult: (r: ActionResult) => void;
}) {
  const [pending, start] = useTransition();
  const ref = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      action={(fd) => start(async () => onResult(await uploadReceiptImage(fd)))}
      className="flex items-center gap-3 border-b border-line py-3 last:border-b-0"
    >
      <input type="hidden" name="slot" value={slot} />

      <button
        type="button"
        onClick={() => ref.current?.click()}
        disabled={pending}
        className="grid h-14 w-20 shrink-0 place-items-center overflow-hidden rounded-input border border-dashed border-line-strong bg-surface hover:border-accent hover:bg-accent-soft disabled:opacity-50"
      >
        {url ? (
          // The stored file, shown at the size it prints at.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" className="max-h-full max-w-full object-contain" />
        ) : (
          <Icon name="image" size={18} />
        )}
      </button>

      <div className="min-w-0 flex-1">
        <b className="block text-[.88rem]">{label}</b>
        <span className="block text-[.74rem] text-fg-subtle">{hint}</span>
      </div>

      {url && (
        <button
          type="button"
          disabled={pending}
          onClick={() => start(async () => onResult(await removeReceiptImage(slot)))}
          className="text-[.76rem] text-fg-subtle hover:text-danger"
        >
          הסר
        </button>
      )}

      <input
        ref={ref}
        name="image"
        type="file"
        accept={RECEIPT_IMAGE_SPEC.formats.join(',')}
        className="hidden"
        onChange={() => formRef.current?.requestSubmit()}
      />
    </form>
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

  // Only the grid kinds can overflow; centred prose wraps instead.
  const tooLong = useMemo(
    () => lines.filter((l) => l.kind !== 'centre' && l.text.length > cols).length,
    [lines, cols],
  );

  const anyHebrew = useMemo(() => lines.some((l) => l.hasHebrew), [lines]);

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
            שורה אחת לכל שורה בקבלה. עד 8. עברית ואנגלית שתיהן בסדר.
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

        <div>
          <span className="label">לוגו ותמונות</span>
          <div className="rounded-input border border-line px-3.5">
            <ImageSlot
              slot="logo" label="לוגו" url={t.logoUrl}
              hint={`מעל שורות הכותרת. רוחב מומלץ ${RECEIPT_IMAGE_SPEC.recommendedWidth}px.`}
              onResult={setResult}
            />
            <ImageSlot
              slot="header" label="תמונה עליונה" url={t.headerImageUrl}
              hint="רצועה ברוחב מלא בראש הקבלה."
              onResult={setResult}
            />
            <ImageSlot
              slot="footer" label="תמונה תחתונה" url={t.footerImageUrl}
              hint="רצועה ברוחב מלא בתחתית."
              onResult={setResult}
            />
          </div>
          <span className="mt-1 block text-[.74rem] text-fg-subtle">
            {RECEIPT_IMAGE_SPEC.formatLabel} · עד 2MB. נייר תרמי מדפיס בשחור-לבן,
            אז לוגו עם ניגודיות גבוהה יוצא הכי טוב.
          </span>
        </div>

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

        <Paper
          lines={lines}
          cols={cols}
          logoUrl={t.logoUrl}
          headerImageUrl={t.headerImageUrl}
          footerImageUrl={t.footerImageUrl}
        />

        {anyHebrew && (
          <p className="max-w-[44ch] rounded-input bg-accent-soft px-3 py-2 text-[.76rem]">
            יש כאן עברית. מדפסת תרמית לא יודעת לכתוב עברית כטקסט, אז השורות
            האלה יודפסו כתמונה. זה עובד, פשוט מעט איטי יותר משורת טקסט.
          </p>
        )}

        <p className="max-w-[44ch] text-[.76rem] text-fg-subtle">
          התצוגה נבנית מאותה פונקציה ששולחת למדפסת, באותו רוחב תווים — מה
          שנראה כאן הוא מה שייצא מהנייר.
        </p>
      </div>
    </div>
  );
}
