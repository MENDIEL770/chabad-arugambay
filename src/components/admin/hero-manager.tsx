'use client';

import Image from 'next/image';
import { useRef, useState, useTransition } from 'react';
import { Icon } from '@/components/ui/icon';
import { HERO_IMAGE_SPEC, HERO_INTERVAL_SECONDS, type HeroSlide } from '@/lib/data/hero-spec';
import {
  commitHeroSlide, deleteHeroSlide, moveHeroSlide, saveHeroSlide, toggleHeroSlide,
  type ActionResult,
} from '@/app/admin/settings/hero/actions';
import { createUploadTicket, type Ticket } from '@/app/admin/upload-actions';
import { measureImage, uploadToTicket } from '@/lib/upload';
import { runAction } from '@/lib/run-action';

const KB = (b: number | null) => (b ? `${Math.round(b / 1024)} KB` : '—');

function Toast({ result }: { result: ActionResult | null }) {
  if (!result) return null;
  return (
    <p
      role="status"
      className={`mt-2 rounded-input px-3 py-2 text-[.82rem] ${
        result.ok ? 'bg-accent-soft' : 'bg-danger/10 text-danger'
      }`}
    >
      {result.message}
    </p>
  );
}

/**
 * Plain form, no client-side work.
 *
 * The previous version measured the image in the browser before posting,
 * which meant creating a promise during a transition — the likely source of
 * the React #441 this page was failing with in production. Simpler is worth
 * more here than a pre-flight dimension check.
 */
function Uploader({ onResult }: { onResult: (r: ActionResult) => void }) {
  const [pending, start] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      className="card"
      action={(fd) => start(async () => {
        const chosen = inputRef.current?.files?.[0];
        if (!chosen) { onResult({ ok: false, message: 'לא נבחרה תמונה.' }); return; }

        // Ask, upload, record. The bytes never pass through a server
        // action: Next caps that body at 1MB and Vercel at 4.5MB, and a
        // hero image is routinely larger than both.
        const ticket = await runAction(() =>
          createUploadTicket('hero', chosen.type, chosen.size));
        if (!ticket.ok) { onResult(ticket as ActionResult); return; }

        const up = await uploadToTicket(ticket as Ticket, chosen);
        if (!up.ok) { onResult(up); return; }

        const dims = await measureImage(chosen);
        fd.set('path', up.path);
        fd.set('bytes', String(chosen.size));
        if (dims) {
          fd.set('width', String(dims.width));
          fd.set('height', String(dims.height));
        }

        const r = await runAction(() => commitHeroSlide(fd)) as ActionResult;
        onResult(r);
        if (r.ok) formRef.current?.reset();
      })}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-bold">הוספת תמונת רקע</h2>
          <ul className="mt-2 flex flex-col gap-1 text-[.82rem] text-fg-muted">
            <li>
              מומלץ{' '}
              <b className="money">
                {HERO_IMAGE_SPEC.recommendedWidth}×{HERO_IMAGE_SPEC.recommendedHeight}
              </b>{' '}
              פיקסלים (יחס {HERO_IMAGE_SPEC.aspect}).
            </li>
            <li>
              מינימום <b className="money">{HERO_IMAGE_SPEC.minWidth}px</b> רוחב — צר מזה
              ייראה רך במסך גדול.
            </li>
            <li>
              עד <b className="money">{(HERO_IMAGE_SPEC.maxBytes / 1024 / 1024).toFixed(0)}MB</b>,
              רצוי מתחת ל-<b className="money">{Math.round(HERO_IMAGE_SPEC.warnBytes / 1024)}KB</b>.
            </li>
            <li>{HERO_IMAGE_SPEC.formatLabel}</li>
          </ul>
        </div>

        <button
          type="button"
          className="btn btn-accent"
          disabled={pending}
          onClick={() => inputRef.current?.click()}
        >
          <Icon name="image" size={17} />
          {pending ? 'מעלה…' : 'בחרו תמונה'}
        </button>
      </div>

      <input
        ref={inputRef}
        name="image"
        type="file"
        accept={HERO_IMAGE_SPEC.formats.join(',')}
        className="hidden"
        onChange={() => formRef.current?.requestSubmit()}
      />
    </form>
  );
}

function SlideCard({
  slide, index, count, onResult,
}: {
  slide: HeroSlide;
  index: number;
  count: number;
  onResult: (r: ActionResult) => void;
}) {
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [focal, setFocal] = useState({ x: slide.focalX, y: slide.focalY });
  const [result, setResult] = useState<ActionResult | null>(null);

  const heavy = (slide.bytes ?? 0) > HERO_IMAGE_SPEC.warnBytes;
  const small = (slide.widthPx ?? 9999) < HERO_IMAGE_SPEC.minWidth;
  const hasText = Boolean(slide.headline?.he);

  const report = (r: ActionResult) => {
    setResult(r);
    onResult(r);
  };

  return (
    <li className="card !p-0 overflow-hidden">
      <div className="flex gap-4 p-4 max-[700px]:flex-col">
        {/* Click to set the focal point, so cropping keeps the subject. */}
        <button
          type="button"
          title="לחצו על הנקודה שחייבת להישאר בקדר"
          onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            const x = Math.round(((e.clientX - r.left) / r.width) * 100);
            const y = Math.round(((e.clientY - r.top) / r.height) * 100);
            setFocal({ x, y });
            setOpen(true);
          }}
          className="relative block aspect-[2/1] w-[260px] shrink-0 overflow-hidden rounded-input max-[700px]:w-full"
        >
          <Image
            src={slide.imageUrl}
            alt=""
            fill
            sizes="260px"
            className="object-cover"
            style={{ objectPosition: `${focal.x}% ${focal.y}%` }}
          />
          <span className="absolute inset-0 bg-ink-panel" style={{ opacity: slide.overlay / 100 }} />
          <span
            className="absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-accent shadow"
            style={{ left: `${focal.x}%`, top: `${focal.y}%` }}
          />
          {!slide.isActive && (
            <span className="absolute inset-0 grid place-items-center bg-bg/70 text-sm font-medium">
              מוסתר
            </span>
          )}
        </button>

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="chip">#{index + 1}</span>
            {hasText ? (
              <span className="chip chip-kosher">טקסט משלה</span>
            ) : (
              <span className="chip">משתמשת בטקסט הראשי</span>
            )}
            {slide.widthPx && (
              <span className={`chip ${small ? 'chip-out' : ''}`}>
                <span className="money">{slide.widthPx}×{slide.heightPx}</span>
              </span>
            )}
            <span className={`chip ${heavy ? 'chip-out' : ''}`}>{KB(slide.bytes)}</span>
          </div>

          {hasText && (
            <p className="truncate text-sm">
              <b>{slide.headline!.he}</b>
              {slide.subhead?.he && <span className="text-fg-muted"> — {slide.subhead.he}</span>}
            </p>
          )}
          {heavy && (
            <p className="text-[.78rem] text-danger">
              כבדה מדי. דחסו ל-WebP כדי שהדף ייטען מהר גם ברשת חלשה.
            </p>
          )}

          <div className="mt-auto flex flex-wrap gap-2">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen((o) => !o)}>
              {open ? 'סגור' : 'טקסט ומיקום'}
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={pending || index === 0}
              onClick={() => start(async () => report(await moveHeroSlide(slide.id, -1)))}
            >
              קודם
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={pending || index === count - 1}
              onClick={() => start(async () => report(await moveHeroSlide(slide.id, 1)))}
            >
              אחר כך
            </button>
            <button
              type="button"
              className={`btn btn-sm ${slide.isActive ? 'btn-ghost' : 'btn-accent'}`}
              disabled={pending}
              onClick={() => start(async () => report(await toggleHeroSlide(slide.id, !slide.isActive)))}
            >
              {slide.isActive ? 'הסתר' : 'הצג'}
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm ms-auto text-danger"
              disabled={pending}
              onClick={() => {
                if (confirm('למחוק את התמונה? אי אפשר לבטל.')) {
                  start(async () => report(await deleteHeroSlide(slide.id)));
                }
              }}
            >
              מחק
            </button>
          </div>
        </div>
      </div>

      {open && (
        <form
          className="grid grid-cols-2 gap-3 border-t border-line bg-surface p-4 max-[700px]:grid-cols-1"
          action={(fd) => start(async () => report(await saveHeroSlide(fd)))}
        >
          <input type="hidden" name="id" value={slide.id} />
          <input type="hidden" name="focalX" value={focal.x} />
          <input type="hidden" name="focalY" value={focal.y} />

          <p className="col-span-2 text-[.8rem] text-fg-muted max-[700px]:col-span-1">
            כותרת ריקה = התמונה מציגה את הטקסט הראשי של הדף. כותרת מלאה =
            הטקסט הזה מחליף אותו כל עוד התמונה על המסך.
          </p>

          <label>
            <span className="label">כותרת (עברית)</span>
            <input className="field" name="headlineHe" defaultValue={slide.headline?.he ?? ''} />
          </label>
          <label>
            <span className="label">כותרת (English)</span>
            <input className="field ltr" name="headlineEn" defaultValue={slide.headline?.en ?? ''} />
          </label>

          <label>
            <span className="label">משפט משנה (עברית)</span>
            <input className="field" name="subheadHe" defaultValue={slide.subhead?.he ?? ''} />
          </label>
          <label>
            <span className="label">משפט משנה (English)</span>
            <input className="field ltr" name="subheadEn" defaultValue={slide.subhead?.en ?? ''} />
          </label>

          <label>
            <span className="label">טקסט כפתור</span>
            <input className="field" name="ctaLabelHe" defaultValue={slide.ctaLabel?.he ?? ''} />
          </label>
          <label>
            <span className="label">קישור הכפתור</span>
            <input
              className="field ltr"
              name="ctaHref"
              placeholder="/shabbat"
              defaultValue={slide.ctaHref ?? ''}
            />
          </label>

          <label>
            <span className="label">
              כהות הרקע: <span className="money">{slide.overlay}%</span>
            </span>
            <input
              className="w-full accent-[var(--accent)]"
              type="range"
              name="overlay"
              min={0}
              max={80}
              defaultValue={slide.overlay}
            />
          </label>

          <div className="flex items-end">
            <p className="text-[.78rem] text-fg-subtle">
              נקודת מיקוד: <span className="money">{focal.x}% / {focal.y}%</span> —
              לחצו על התמונה כדי לשנות.
            </p>
          </div>

          <div className="col-span-2 max-[700px]:col-span-1">
            <button type="submit" className="btn btn-accent btn-sm" disabled={pending}>
              {pending ? 'שומר…' : 'שמירה'}
            </button>
          </div>
        </form>
      )}

      <div className="px-4 pb-2">
        <Toast result={result} />
      </div>
    </li>
  );
}

export function HeroManager({ slides }: { slides: HeroSlide[] }) {
  const [top, setTop] = useState<ActionResult | null>(null);
  const active = slides.filter((s) => s.isActive).length;

  return (
    <div className="flex flex-col gap-5">
      <Uploader onResult={setTop} />
      <Toast result={top} />

      {slides.length === 0 ? (
        <p className="card text-sm text-fg-muted">
          אין עדיין תמונות רקע. בלעדיהן הדף מציג רקע מצויר — זה תקין, אבל
          תמונה אמיתית של הבית תעשה הרבה יותר.
        </p>
      ) : (
        <>
          <p className="text-[.84rem] text-fg-muted">
            {active > 1
              ? `${active} תמונות מתחלפות כל ${HERO_INTERVAL_SECONDS} שניות, לפי הסדר כאן.`
              : active === 1
                ? 'תמונה אחת פעילה — היא תוצג קבוע. הוסיפו עוד כדי שיתחלפו.'
                : 'כל התמונות מוסתרות. הדף יציג את הרקע המצויר.'}
          </p>
          <ul className="flex flex-col gap-4">
            {slides.map((s, i) => (
              <SlideCard key={s.id} slide={s} index={i} count={slides.length} onResult={setTop} />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
