'use client';

import Image from 'next/image';
import { useRef, useState, useTransition } from 'react';
import { Icon } from '@/components/ui/icon';
import type { MediaItem } from '@/lib/data/gallery';
import { GALLERY_IMAGE_SPEC, ALBUM_SUGGESTIONS } from '@/lib/spec/gallery-image';
import { runAction } from '@/lib/run-action';
import {
  addVideo, deleteMedia, editMedia, moveMedia, toggleFeatured, uploadPhoto,
  type ActionResult,
} from '@/app/admin/content/gallery/actions';

function AlbumList({ albums }: { albums: string[] }) {
  return (
    <datalist id="albums">
      {[...new Set([...ALBUM_SUGGESTIONS, ...albums])].map((a) => (
        <option key={a} value={a} />
      ))}
    </datalist>
  );
}

function Uploader({ onDone }: { onDone: (r: ActionResult) => void }) {
  const [pending, start] = useTransition();
  const [preview, setPreview] = useState<string | null>(null);
  const [warn, setWarn] = useState<string | null>(null);
  const dims = useRef<{ w: number; h: number } | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function pick(file: File | undefined) {
    setWarn(null);
    dims.current = null;
    if (!file) { setPreview(null); return; }

    const url = URL.createObjectURL(file);
    setPreview(url);

    // Measured in the browser so the dimensions go up with the row and the
    // grid can reserve the right space instead of reflowing on load.
    const img = new window.Image();
    img.onload = () => {
      dims.current = { w: img.naturalWidth, h: img.naturalHeight };
      if (img.naturalWidth < GALLERY_IMAGE_SPEC.minWidth) {
        setWarn(`התמונה צרה (${img.naturalWidth}px). מתחת ל-${GALLERY_IMAGE_SPEC.minWidth}px היא תיראה מטושטשת.`);
      } else if (file.size > GALLERY_IMAGE_SPEC.warnBytes) {
        setWarn(`${Math.round(file.size / 1024)}KB — תיטען לאט בחיבור חלש. כדאי לדחוס.`);
      }
    };
    img.src = url;
  }

  return (
    <form
      ref={formRef}
      className="grid grid-cols-[13rem_1fr] gap-4 rounded-input border border-line bg-surface p-4 max-[760px]:grid-cols-1"
      action={(fd) => start(async () => {
        if (dims.current) {
          fd.set('width', String(dims.current.w));
          fd.set('height', String(dims.current.h));
        }
        const r = await runAction(() => uploadPhoto(fd)) as ActionResult;
        onDone(r);
        if (r.ok) { formRef.current?.reset(); setPreview(null); setWarn(null); }
      })}
    >
      <div>
        <div className="grid aspect-[4/3] place-items-center overflow-hidden rounded-input border border-dashed border-line bg-bg">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" className="size-full object-cover" />
          ) : (
            <span className="text-fg-subtle"><Icon name="camera" size={28} /></span>
          )}
        </div>
        <input
          type="file"
          name="photo"
          required
          accept={GALLERY_IMAGE_SPEC.formats.join(',')}
          onChange={(e) => pick(e.target.files?.[0])}
          className="mt-2 block w-full text-[.78rem] file:me-2 file:rounded-input file:border-0 file:bg-accent-soft file:px-3 file:py-1.5 file:text-accent-strong"
        />
      </div>

      <div className="grid grid-cols-2 gap-3 max-[560px]:grid-cols-1">
        <label className="col-span-2 max-[560px]:col-span-1">
          <span className="label !mb-1">כיתוב</span>
          <input className="field" name="caption" placeholder="סעודת ליל שבת, אוקטובר" />
        </label>
        <label>
          <span className="label !mb-1">אלבום</span>
          <input className="field" name="album" list="albums" placeholder="שבתות" />
        </label>
        <label>
          <span className="label !mb-1">תאריך הצילום</span>
          <input className="field" name="takenOn" type="date" />
        </label>
        <label className="col-span-2 flex items-center gap-2 text-[.85rem] max-[560px]:col-span-1">
          <input type="checkbox" name="featured" className="size-4 accent-[var(--accent)]" />
          להציג גם ברצועת התמונות בעמוד הראשי
        </label>

        {warn && (
          <p className="col-span-2 rounded-input bg-accent-soft px-3 py-2 text-[.8rem] max-[560px]:col-span-1">
            {warn}
          </p>
        )}

        <div className="col-span-2 max-[560px]:col-span-1">
          <button type="submit" className="btn btn-accent btn-sm" disabled={pending}>
            {pending ? 'מעלה…' : 'העלאה'}
          </button>
        </div>
      </div>
    </form>
  );
}

export function GalleryManager({
  items, albums,
}: {
  items: MediaItem[];
  albums: string[];
}) {
  const [result, setResult] = useState<ActionResult | null>(null);
  const [mode, setMode] = useState<'photo' | 'video' | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<ActionResult>) =>
    start(async () => setResult(await runAction(fn) as ActionResult));

  return (
    <div className="flex flex-col gap-5">
      <AlbumList albums={albums} />

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={`btn btn-sm ${mode === 'photo' ? 'btn-accent' : 'btn-ghost'}`}
          onClick={() => setMode(mode === 'photo' ? null : 'photo')}
        >
          <Icon name="camera" size={15} /> העלאת תמונה
        </button>
        <button
          type="button"
          className={`btn btn-sm ${mode === 'video' ? 'btn-accent' : 'btn-ghost'}`}
          onClick={() => setMode(mode === 'video' ? null : 'video')}
        >
          הוספת סרטון
        </button>
      </div>

      {mode === 'photo' && <Uploader onDone={(r) => { setResult(r); if (r.ok) setMode(null); }} />}

      {mode === 'video' && (
        <form
          className="grid grid-cols-2 gap-3 rounded-input border border-line bg-surface p-4 max-[560px]:grid-cols-1"
          action={(fd) => start(async () => {
            const r = await runAction(() => addVideo(fd)) as ActionResult;
            setResult(r);
            if (r.ok) setMode(null);
          })}
        >
          <label className="col-span-2 max-[560px]:col-span-1">
            <span className="label !mb-1">קישור ל-YouTube או Vimeo</span>
            <input className="field ltr" name="url" required placeholder="https://youtu.be/…" />
            <span className="mt-1 block text-[.74rem] text-fg-subtle">
              מספיק להדביק את הקישור הרגיל — נמיר אותו לנגן בעצמנו.
            </span>
          </label>
          <label>
            <span className="label !mb-1">כיתוב</span>
            <input className="field" name="caption" />
          </label>
          <label>
            <span className="label !mb-1">אלבום</span>
            <input className="field" name="album" list="albums" />
          </label>
          <div className="col-span-2 max-[560px]:col-span-1">
            <button type="submit" className="btn btn-accent btn-sm" disabled={pending}>הוספה</button>
          </div>
        </form>
      )}

      {items.length === 0 ? (
        <p className="card text-sm text-fg-muted">
          הגלריה ריקה. כל מה שיעלה כאן יופיע בעמוד הגלריה, ומה שיסומן
          כמומלץ יופיע גם ברצועה בעמוד הראשי.
        </p>
      ) : (
        <ul className="grid grid-cols-4 gap-3 max-[1100px]:grid-cols-3 max-[800px]:grid-cols-2 max-[520px]:grid-cols-1">
          {items.map((m, i) => (
            <li key={m.id} className="card !p-0 overflow-hidden">
              <div className="relative aspect-[4/3] bg-bg">
                {m.kind === 'photo' ? (
                  <Image
                    src={m.url}
                    alt={m.caption?.he ?? ''}
                    fill
                    sizes="(max-width: 800px) 50vw, 25vw"
                    className="object-cover"
                  />
                ) : (
                  <div className="grid size-full place-items-center text-fg-subtle">
                    <span className="text-[.78rem]">סרטון</span>
                  </div>
                )}
                {m.isFeatured && (
                  <span className="absolute end-1.5 top-1.5 chip chip-kosher !text-[.66rem]">
                    בעמוד הראשי
                  </span>
                )}
              </div>

              <div className="p-3">
                <p className="truncate text-[.84rem] font-medium">
                  {m.caption?.he || <span className="text-fg-subtle">ללא כיתוב</span>}
                </p>
                <p className="mt-0.5 text-[.72rem] text-fg-subtle">{m.album}</p>

                <div className="mt-2 flex flex-wrap items-center gap-1">
                  <button
                    type="button" className="btn btn-ghost !px-2 !py-1 !text-[.72rem]"
                    onClick={() => setEditing(editing === m.id ? null : m.id)}
                  >
                    {editing === m.id ? 'סגור' : 'ערוך'}
                  </button>
                  <button
                    type="button" className="btn btn-ghost !px-2 !py-1 !text-[.72rem]"
                    disabled={pending}
                    onClick={() => run(() => toggleFeatured(m.id, !m.isFeatured))}
                  >
                    {m.isFeatured ? 'הסר מהראשי' : 'לעמוד הראשי'}
                  </button>
                  <span className="flex-1" />
                  <button
                    type="button" aria-label="הזז אחורה" title="הזז אחורה"
                    className="grid size-6 place-items-center rounded-input text-fg-muted hover:bg-accent-soft disabled:opacity-30"
                    disabled={pending || i === 0}
                    onClick={() => run(() => moveMedia(m.id, 'up'))}
                  >
                    <Icon name="arrow" size={13} />
                  </button>
                  <button
                    type="button" aria-label="הזז קדימה" title="הזז קדימה"
                    className="grid size-6 rotate-180 place-items-center rounded-input text-fg-muted hover:bg-accent-soft disabled:opacity-30"
                    disabled={pending || i === items.length - 1}
                    onClick={() => run(() => moveMedia(m.id, 'down'))}
                  >
                    <Icon name="arrow" size={13} />
                  </button>
                  <button
                    type="button" aria-label="מחיקה" title="מחיקה"
                    className="grid size-6 place-items-center rounded-input text-danger hover:bg-danger/10"
                    disabled={pending}
                    onClick={() => {
                      if (confirm('למחוק את התמונה מהגלריה?')) run(() => deleteMedia(m.id));
                    }}
                  >
                    <Icon name="trash" size={13} />
                  </button>
                </div>

                {editing === m.id && (
                  <form
                    className="mt-2 flex flex-col gap-2 border-t border-line pt-2"
                    action={(fd) => start(async () => {
                      const r = await runAction(() => editMedia(fd)) as ActionResult;
                      setResult(r);
                      if (r.ok) setEditing(null);
                    })}
                  >
                    <input type="hidden" name="id" value={m.id} />
                    <input className="field !py-1.5 !text-[.82rem]" name="caption"
                           defaultValue={m.caption?.he ?? ''} placeholder="כיתוב" />
                    <input className="field !py-1.5 !text-[.82rem]" name="album" list="albums"
                           defaultValue={m.album} placeholder="אלבום" />
                    <input className="field !py-1.5 !text-[.82rem]" name="takenOn" type="date"
                           defaultValue={m.takenOn ?? ''} />
                    <button type="submit" className="btn btn-accent btn-sm" disabled={pending}>
                      שמירה
                    </button>
                  </form>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {result?.message && (
        <p role="status" className={`rounded-input px-3 py-2 text-[.85rem] ${
          result.ok ? 'bg-accent-soft' : 'bg-danger/10 text-danger'}`}>
          {result.message}
        </p>
      )}
    </div>
  );
}
