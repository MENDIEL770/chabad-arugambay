'use client';

import { useRef, useState, useTransition } from 'react';
import { Icon } from '@/components/ui/icon';
import { renderTemplate } from '@/lib/whatsapp/template';
import {
  MESSAGES, placeholdersFor, sampleValues, type MessageEvent,
} from '@/lib/whatsapp/catalogue';
import type { StoredTemplate } from '@/lib/whatsapp/templates';
import { runAction } from '@/lib/run-action';
import {
  resetTemplate, saveTemplate, sendTestMessage, type ActionResult,
} from '@/app/admin/content/messages/actions';

/** WhatsApp's own formatting, which is not the same as the site's. */
const WA_MARKS = [
  { label: 'מודגש', wrap: '*', icon: 'bold' as const },
  { label: 'נטוי', wrap: '_', icon: 'italic' as const },
];

function Bubble({ text }: { text: string }) {
  // Rendered the way WhatsApp renders it: *bold*, _italic_, ~strike~.
  const html = text
    .split('\n')
    .map((line) => line || ' ')
    .join('\n');

  return (
    <div className="rounded-[14px] rounded-se-[4px] bg-[#d9fdd3] px-3 py-2 text-[.88rem] leading-[1.45] text-[#111b21] shadow-sm dark:bg-[#005c4b] dark:text-[#e9edef]">
      <div className="whitespace-pre-wrap break-words">
        {html.split(/(\*[^*\n]+\*|_[^_\n]+_)/g).map((part, i) => {
          if (/^\*[^*\n]+\*$/.test(part)) return <b key={i}>{part.slice(1, -1)}</b>;
          if (/^_[^_\n]+_$/.test(part)) return <i key={i}>{part.slice(1, -1)}</i>;
          return <span key={i}>{part}</span>;
        })}
      </div>
      <div className="mt-0.5 text-end text-[.62rem] text-black/45 dark:text-white/50">
        <span className="clock">12:34</span> ✓✓
      </div>
    </div>
  );
}

function One({
  tpl, onDone,
}: {
  tpl: StoredTemplate;
  onDone: (r: ActionResult) => void;
}) {
  const def = MESSAGES.find((m) => m.event === tpl.event)!;
  const ref = useRef<HTMLTextAreaElement>(null);
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  // Mirrored for the preview only. The textarea stays uncontrolled so the
  // browser's undo stack survives.
  const [draft, setDraft] = useState(tpl.bodyHe);
  const [enabled, setEnabled] = useState(tpl.isEnabled);

  const fields = placeholdersFor(def.event);
  const samples = sampleValues(def.event);

  function insert(text: string) {
    const el = ref.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e } = el;
    el.focus();
    el.setRangeText(text, s, e, 'end');
    setDraft(el.value);
  }

  function wrap(mark: string) {
    const el = ref.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e } = el;
    const chosen = el.value.slice(s, e) || 'טקסט';
    el.focus();
    el.setRangeText(mark + chosen + mark, s, e, 'select');
    setDraft(el.value);
  }

  return (
    <li className="card !p-0 overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 p-4">
        <span
          className={`grid size-10 shrink-0 place-items-center rounded-input ${
            enabled ? 'bg-accent-soft text-accent-strong' : 'bg-line/40 text-fg-subtle'
          }`}
        >
          <Icon name="message" size={18} />
        </span>

        <div className="min-w-[12rem] flex-1">
          <b className="block">{def.label}</b>
          <span className="block text-[.78rem] text-fg-subtle">{def.when}</span>
        </div>

        <div className="flex items-center gap-2">
          {def.comingSoon && <span className="chip">בקרוב</span>}
          <span className={`chip ${enabled ? 'chip-kosher' : 'chip-out'}`}>
            {enabled ? 'נשלח' : 'כבוי'}
          </span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(!open)}>
            {open ? 'סגור' : 'ערוך'}
          </button>
        </div>
      </div>

      {open && (
        <form
          className="border-t border-line p-4"
          action={(fd) => start(async () => onDone(await runAction(() => saveTemplate(fd)) as ActionResult))}
        >
          <input type="hidden" name="event" value={def.event} />

          <div className="grid grid-cols-[1fr_17rem] gap-5 max-[900px]:grid-cols-1">
            <div>
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="label !mb-0">נוסח ההודעה</span>
                <div className="flex items-center gap-1">
                  {WA_MARKS.map((m) => (
                    <button
                      key={m.label}
                      type="button"
                      title={`${m.label} (וואטסאפ)`}
                      aria-label={m.label}
                      className="grid size-7 place-items-center rounded-input text-fg-muted hover:bg-accent-soft hover:text-accent-strong"
                      onClick={() => wrap(m.wrap)}
                    >
                      <Icon name={m.icon} size={15} />
                    </button>
                  ))}
                </div>
              </div>

              <textarea
                ref={ref}
                name="body"
                rows={9}
                defaultValue={tpl.bodyHe}
                onChange={(e) => setDraft(e.target.value)}
                // Prose, not a column grid: the house writes Hebrew sentences
                // here, so it gets the body font like any other text box.
                className="field text-[.88rem] leading-[1.6]"
              />

              <p className="mt-1 text-[.72rem] text-fg-subtle">
                בוואטסאפ: <code className="ltr">*מודגש*</code> ·{' '}
                <code className="ltr">_נטוי_</code> — לא כמו בשאר האתר.
              </p>

              <div className="mt-3 flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-[.85rem]">
                  <input
                    type="checkbox"
                    name="enabled"
                    checked={enabled}
                    onChange={(e) => setEnabled(e.target.checked)}
                    className="size-4 accent-[var(--accent)]"
                  />
                  שלח את ההודעה הזו
                </label>

                <label className="flex items-center gap-2 text-[.85rem]">
                  השהיה
                  <input
                    className="field money !w-20 !py-1"
                    name="delayMin"
                    inputMode="numeric"
                    defaultValue={tpl.delayMin}
                  />
                  דקות
                </label>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <button type="submit" className="btn btn-accent btn-sm" disabled={pending}>
                  {pending ? 'שומר…' : 'שמירה'}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={pending}
                  onClick={() => {
                    if (!confirm('לשחזר את הנוסח המקורי?')) return;
                    start(async () => {
                      const r = await runAction(() => resetTemplate(def.event)) as ActionResult;
                      if (r.ok) {
                        setDraft(def.defaultBody);
                        if (ref.current) ref.current.value = def.defaultBody;
                        setEnabled(def.onByDefault);
                      }
                      onDone(r);
                    });
                  }}
                >
                  שחזור הנוסח המקורי
                </button>
              </div>
            </div>

            <div>
              <span className="label">איך זה ייראה</span>
              {/* Rendered with the sample values and the real renderer, so
                  what is shown here is what a customer receives. */}
              <div className="rounded-card bg-[#efeae2] p-3 dark:bg-[#0b141a]">
                <Bubble text={renderTemplate(draft, samples) || '(ריק)'} />
              </div>

              <span className="label mt-4">שדות שאפשר לשלב</span>
              <div className="flex flex-wrap gap-1.5">
                {fields.map((f) => (
                  <button
                    key={f.key}
                    type="button"
                    title={f.label}
                    className="chip hover:bg-accent-soft hover:text-accent-strong"
                    onClick={() => insert(`{{${f.key}}}`)}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-[.72rem] text-fg-subtle">
                לחיצה משלבת את השדה בתוך הטקסט. שורה שכל השדות שבה ריקים —
                נעלמת מההודעה.
              </p>
            </div>
          </div>
        </form>
      )}
    </li>
  );
}

export function MessageEditor({
  templates, connection,
}: {
  templates: StoredTemplate[];
  connection: { configured: boolean; state: string | null; error: string | null };
}) {
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();

  const groups = ['מסעדה', 'אירועים', 'שבת'] as const;
  const live = connection.configured && connection.state === 'authorized';

  return (
    <div className="flex flex-col gap-6">
      <div className={`card ${live ? '' : 'border-accent/40 bg-accent-soft/40'}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-medium">
              {!connection.configured
                ? 'וואטסאפ עוד לא מחובר'
                : live
                  ? 'וואטסאפ מחובר ושולח'
                  : `וואטסאפ מחובר אבל לא מאושר (${connection.state ?? connection.error})`}
            </p>
            <p className="mt-1 max-w-[62ch] text-[.84rem] text-fg-muted">
              {!connection.configured ? (
                <>
                  ההודעות נשמרות ומוכנות, אבל לא יישלחו עד שיוגדרו{' '}
                  <code className="ltr">GREEN_API_ID_INSTANCE</code> ו-
                  <code className="ltr">GREEN_API_TOKEN_INSTANCE</code> ב-Vercel.
                </>
              ) : live ? (
                'הטלפון המקושר מחובר. הודעות שמסומנות כפעילות יוצאות ממספר בית חב״ד.'
              ) : (
                'הטלפון המקושר התנתק. צריך לסרוק מחדש את ה-QR בפאנל של Green API.'
              )}
            </p>
          </div>
        </div>

        {connection.configured && (
          <form
            className="mt-3 flex flex-wrap items-end gap-2 border-t border-line pt-3"
            action={(fd) => start(async () =>
              setResult(await runAction(() => sendTestMessage(fd)) as ActionResult))}
          >
            <label className="flex-1 min-w-[12rem]">
              <span className="label !mb-1">בדיקה: שליחה למספר שלכם</span>
              <input className="field ltr" name="phone" placeholder="+972…" />
            </label>
            <input type="hidden" name="body" value="החיבור עובד 🎉" />
            <button type="submit" className="btn btn-ghost btn-sm" disabled={pending}>
              שליחת בדיקה
            </button>
          </form>
        )}
      </div>

      {groups.map((g) => {
        const items = templates.filter(
          (t) => MESSAGES.find((m) => m.event === t.event)?.group === g,
        );
        if (!items.length) return null;
        return (
          <section key={g}>
            <h2 className="mb-3 text-lg font-bold">{g}</h2>
            <ul className="flex flex-col gap-3">
              {items.map((t) => (
                <One key={t.event} tpl={t} onDone={setResult} />
              ))}
            </ul>
          </section>
        );
      })}

      {result?.message && (
        <p
          role="status"
          className={`rounded-input px-3 py-2 text-[.85rem] ${
            result.ok ? 'bg-accent-soft' : 'bg-danger/10 text-danger'
          }`}
        >
          {result.message}
        </p>
      )}
    </div>
  );
}

export type { MessageEvent };
