'use client';

import { useState, useTransition } from 'react';
import { entryFor, groupedKeys, type TextKey, type TextOverrides } from '@/lib/site-text';
import { saveSiteText, type ActionResult } from '@/app/admin/settings/text/actions';

function Row({ keyName, override }: { keyName: TextKey; override?: { he: string; en: string } }) {
  const entry = entryFor(keyName);
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  const customised = Boolean(override);

  const Field = entry.multiline ? 'textarea' : 'input';

  return (
    <form
      className="border-b border-line py-4 last:border-b-0"
      action={(fd) => start(async () => setResult(await saveSiteText(fd)))}
    >
      <input type="hidden" name="key" value={keyName} />

      <div className="mb-2 flex flex-wrap items-baseline gap-2">
        <b className="text-[.92rem]">{entry.label}</b>
        <code className="ltr rounded bg-surface px-1.5 py-0.5 text-[.7rem] text-fg-subtle">
          {keyName}
        </code>
        {customised ? (
          <span className="chip chip-kosher">נערך</span>
        ) : (
          <span className="chip">ברירת מחדל</span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 max-[760px]:grid-cols-1">
        <label>
          <span className="label !mb-1">עברית</span>
          <Field
            className="field"
            name="he"
            rows={entry.multiline ? 3 : undefined}
            defaultValue={override?.he ?? entry.he}
          />
        </label>
        <label>
          <span className="label !mb-1">English</span>
          <Field
            className="field ltr"
            name="en"
            rows={entry.multiline ? 3 : undefined}
            defaultValue={override?.en ?? entry.en}
          />
        </label>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-3">
        <button type="submit" className="btn btn-accent btn-sm" disabled={pending}>
          {pending ? 'שומר…' : 'שמירה'}
        </button>
        {customised && (
          <span className="text-[.74rem] text-fg-subtle">
            כדי לחזור לטקסט המקורי — רוקנו את שני השדות ושמרו.
          </span>
        )}
        {result?.message && (
          <span className={`text-[.8rem] ${result.ok ? 'text-ok' : 'text-danger'}`}>
            {result.message}
          </span>
        )}
      </div>
    </form>
  );
}

export function TextEditor({ overrides }: { overrides: TextOverrides }) {
  const groups = groupedKeys();

  return (
    <div className="flex flex-col gap-7">
      {groups.map((g) => (
        <section key={g.group}>
          <h2 className="mb-1 text-lg font-bold">{g.group}</h2>
          <div className="rounded-card border border-line bg-bg px-4">
            {g.keys.map((k) => (
              <Row key={k} keyName={k} override={overrides[k]} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
