'use client';

import { useState, useTransition } from 'react';
import { Icon } from '@/components/ui/icon';
import {
  describeWhen, KIND_LABEL, WEEKDAYS,
  type Happening, type HappeningCycle, type HappeningKind,
} from '@/lib/data/happenings';
import { RichTextField } from '@/components/admin/rich-text-field';
import { runAction } from '@/lib/run-action';
import {
  deleteHappening, saveHappening, toggleHappening, type ActionResult,
} from '@/app/admin/content/happenings/actions';

const KINDS: HappeningKind[] = ['class', 'farbrengen', 'notice', 'event'];

const CYCLE_LABEL: Record<HappeningCycle, string> = {
  weekly: 'כל שבוע',
  monthly: 'פעם בחודש',
  once: 'פעם אחת',
};

const ANCHORS = [
  { value: '', label: 'שעה קבועה' },
  { value: 'candle_lighting', label: 'הדלקת נרות' },
  { value: 'sunset', label: 'השקיעה' },
  { value: 'tzeis', label: 'צאת הכוכבים' },
];

function Form({ item, onDone }: { item?: Happening; onDone: (r: ActionResult) => void }) {
  const [pending, start] = useTransition();
  const [cycle, setCycle] = useState<HappeningCycle>(item?.cycle ?? 'weekly');
  const [anchor, setAnchor] = useState(item?.anchor ?? '');

  return (
    <form
      className="grid grid-cols-2 gap-3 rounded-input border border-line bg-surface p-4 max-[700px]:grid-cols-1"
      action={(fd) => start(async () => onDone(await runAction(() => saveHappening(fd)) as ActionResult))}
    >
      {item && <input type="hidden" name="id" value={item.id} />}

      <label>
        <span className="label !mb-1">סוג</span>
        <select className="field" name="kind" defaultValue={item?.kind ?? 'class'}>
          {KINDS.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
        </select>
      </label>

      <label>
        <span className="label !mb-1">כל כמה זמן</span>
        <select
          className="field" name="cycle" value={cycle}
          onChange={(e) => setCycle(e.target.value as HappeningCycle)}
        >
          {(['weekly', 'monthly', 'once'] as const).map((c) => (
            <option key={c} value={c}>{CYCLE_LABEL[c]}</option>
          ))}
        </select>
      </label>

      <label className="col-span-2 max-[700px]:col-span-1">
        <span className="label !mb-1">שם הפעילות</span>
        <input className="field" name="titleHe" required defaultValue={item?.title.he}
               placeholder="שיעור תניא · מנחה · התוועדות" />
      </label>

      {cycle === 'once' ? (
        <label>
          <span className="label !mb-1">תאריך</span>
          <input className="field" name="onDate" type="date" defaultValue={item?.onDate ?? ''} />
        </label>
      ) : (
        <label>
          <span className="label !mb-1">יום בשבוע</span>
          <select className="field" name="weekday" defaultValue={item?.weekday ?? 5}>
            {WEEKDAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
          </select>
        </label>
      )}

      {cycle === 'monthly' && (
        <label>
          <span className="label !mb-1">איזה בחודש</span>
          <select className="field" name="weekOfMonth" defaultValue={item?.weekOfMonth ?? 1}>
            {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
      )}

      <label>
        <span className="label !mb-1">מתי</span>
        <select className="field" name="anchor" value={anchor} onChange={(e) => setAnchor(e.target.value)}>
          {ANCHORS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
        </select>
      </label>

      {anchor === '' ? (
        <>
          <label>
            <span className="label !mb-1">שעת התחלה</span>
            <input className="field clock" name="startsAt" type="time"
                   defaultValue={item?.startsAt?.slice(0, 5) ?? '19:00'} />
          </label>
          <label>
            <span className="label !mb-1">שעת סיום (לא חובה)</span>
            <input className="field clock" name="endsAt" type="time"
                   defaultValue={item?.endsAt?.slice(0, 5) ?? ''} />
          </label>
        </>
      ) : (
        <label className="col-span-2 max-[700px]:col-span-1">
          <span className="label !mb-1">כמה דקות ביחס לזמן</span>
          <input className="field money" name="anchorOffsetMin" inputMode="numeric"
                 defaultValue={item?.anchorOffsetMin ?? 20} />
          <span className="mt-1 block text-[.74rem] text-fg-subtle">
            מספר חיובי = אחרי, שלילי = לפני. השעון זז לבד עם השקיעה לאורך השנה,
            בלי שתצטרכו לעדכן.
          </span>
        </label>
      )}

      <label>
        <span className="label !mb-1">למי</span>
        <input className="field" name="audienceHe" defaultValue={item?.audience.he ?? ''}
               placeholder="לגברים · לכל המשפחה" />
      </label>
      <label>
        <span className="label !mb-1">איפה</span>
        <input className="field" name="locationHe" defaultValue={item?.location.he ?? ''}
               placeholder="בית חב״ד · על הגג" />
      </label>

      <div className="col-span-2 max-[700px]:col-span-1">
        <RichTextField
          name="detailsHe"
          label="פרטים"
          defaultValue={item?.details.he ?? ''}
          rows={3}
          hint="אפשר להדגיש ולהוסיף קישור"
        />
      </div>

      <div className="col-span-2 max-[700px]:col-span-1">
        <button type="submit" className="btn btn-accent btn-sm" disabled={pending}>
          {pending ? 'שומר…' : item ? 'שמירה' : 'הוספה'}
        </button>
      </div>
    </form>
  );
}

export function HappeningsManager({ items }: { items: Happening[] }) {
  const [result, setResult] = useState<ActionResult | null>(null);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<ActionResult>) =>
    start(async () => setResult(await runAction(fn) as ActionResult));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-fg-muted">
          {items.length === 0 ? 'עוד אין פעילויות בלוח.' : `${items.length} פעילויות`}
        </p>
        <button type="button" className="btn btn-accent btn-sm" onClick={() => setAdding(!adding)}>
          {adding ? 'ביטול' : <><Icon name="plus" size={15} /> פעילות חדשה</>}
        </button>
      </div>

      {adding && <Form onDone={(r) => { setResult(r); if (r.ok) setAdding(false); }} />}

      <ul className="flex flex-col gap-3">
        {items.map((h) => (
          <li key={h.id} className={`card !p-0 overflow-hidden ${h.isActive ? '' : 'opacity-60'}`}>
            <div className="flex flex-wrap items-center gap-3 p-4">
              <span className="grid size-10 shrink-0 place-items-center rounded-input bg-accent-soft text-accent-strong">
                <Icon name={h.kind === 'class' ? 'sparkle' : h.kind === 'farbrengen' ? 'candle' : 'calendar'} size={18} />
              </span>

              <div className="min-w-[13rem] flex-1">
                <b className="block">{h.title.he}</b>
                <span className="block text-[.8rem] text-fg-muted">{describeWhen(h)}</span>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  <span className="chip">{KIND_LABEL[h.kind]}</span>
                  {h.audience.he && <span className="chip">{h.audience.he}</span>}
                  {h.location.he && <span className="chip">{h.location.he}</span>}
                  {!h.isActive && <span className="chip chip-out">מופסק</span>}
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  className={`btn btn-sm ${h.isActive ? 'btn-ghost' : 'btn-accent'}`}
                  disabled={pending}
                  onClick={() => run(() => toggleHappening(h.id, !h.isActive))}
                >
                  {h.isActive ? 'הפסק' : 'הפעל'}
                </button>
                <button
                  type="button" className="btn btn-ghost btn-sm"
                  onClick={() => setEditing(editing === h.id ? null : h.id)}
                >
                  {editing === h.id ? 'סגור' : 'ערוך'}
                </button>
                <button
                  type="button" className="btn btn-ghost btn-sm text-danger" disabled={pending}
                  onClick={() => {
                    if (confirm(`למחוק את "${h.title.he}"?`)) run(() => deleteHappening(h.id));
                  }}
                >
                  מחק
                </button>
              </div>
            </div>

            {editing === h.id && (
              <div className="border-t border-line p-4">
                <Form item={h} onDone={(r) => { setResult(r); if (r.ok) setEditing(null); }} />
              </div>
            )}
          </li>
        ))}
      </ul>

      {result?.message && (
        <p role="status" className={`rounded-input px-3 py-2 text-[.85rem] ${
          result.ok ? 'bg-accent-soft' : 'bg-danger/10 text-danger'}`}>
          {result.message}
        </p>
      )}
    </div>
  );
}

