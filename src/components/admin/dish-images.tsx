'use client';

import Image from 'next/image';
import { useRef, useState, useTransition } from 'react';
import { Icon } from '@/components/ui/icon';
import type { DishImage } from '@/lib/data/types';
import { deleteDishImage, moveDishImage, uploadDishImage,
  type ActionResult,
} from '@/app/admin/restaurant/menu/image-actions';
import { DISH_IMAGE_SPEC } from '@/lib/spec/dish-image';

/**
 * Several photos per dish, ordered.
 *
 * The first one is the thumbnail every list uses, so reordering is a real
 * editorial decision rather than decoration — hence the arrows rather than
 * drag, which is fiddly on the phone the kitchen actually uses.
 */
export function DishImages({
  itemId,
  images,
  onResult,
}: {
  itemId: string;
  images: DishImage[];
  onResult: (r: ActionResult) => void;
}) {
  const [pending, start] = useTransition();
  const [queued, setQueued] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  function pick(files: FileList) {
    const list = Array.from(files).slice(0, DISH_IMAGE_SPEC.maxPerDish - images.length);
    if (list.length === 0) {
      onResult({ ok: false, message: `אפשר עד ${DISH_IMAGE_SPEC.maxPerDish} תמונות למנה.` });
      return;
    }
    setQueued(list.map((f) => URL.createObjectURL(f)));

    start(async () => {
      // One at a time: the order they were chosen becomes the order shown,
      // and a single failure does not take the rest of the batch with it.
      for (const file of list) {
        const dims = await new Promise<{ w: number; h: number } | null>((resolve) => {
          const url = URL.createObjectURL(file);
          const img = new window.Image();
          img.onload = () => { URL.revokeObjectURL(url); resolve({ w: img.naturalWidth, h: img.naturalHeight }); };
          img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
          img.src = url;
        });

        const fd = new FormData();
        fd.set('itemId', itemId);
        fd.set('image', file);
        if (dims) { fd.set('width', String(dims.w)); fd.set('height', String(dims.h)); }

        const r = await uploadDishImage(fd);
        if (!r.ok) { onResult(r); break; }
        onResult(r);
      }
      setQueued([]);
    });
  }

  const full = images.length >= DISH_IMAGE_SPEC.maxPerDish;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {images.map((img, i) => (
          <div key={img.id} className="group relative">
            <div className="relative size-[72px] overflow-hidden rounded-input border border-line">
              <Image src={img.url} alt="" fill sizes="72px" className="object-cover" />
            </div>

            {i === 0 && (
              <span className="absolute -top-1.5 start-1/2 -translate-x-1/2 rounded-pill bg-accent px-1.5 text-[.6rem] font-medium text-fg-on-accent">
                ראשית
              </span>
            )}

            <div className="mt-1 flex justify-center gap-0.5">
              <button
                type="button"
                aria-label="הזז אחורה"
                disabled={pending || i === 0}
                onClick={() => start(async () => onResult(await moveDishImage(img.id, -1)))}
                className="grid size-5 place-items-center rounded text-[.7rem] text-fg-subtle hover:bg-surface disabled:opacity-30"
              >
                ›
              </button>
              <button
                type="button"
                aria-label="מחק תמונה"
                disabled={pending}
                onClick={() => start(async () => onResult(await deleteDishImage(img.id)))}
                className="grid size-5 place-items-center rounded text-fg-subtle hover:bg-danger/10 hover:text-danger"
              >
                <Icon name="x" size={11} />
              </button>
              <button
                type="button"
                aria-label="הזז קדימה"
                disabled={pending || i === images.length - 1}
                onClick={() => start(async () => onResult(await moveDishImage(img.id, 1)))}
                className="grid size-5 place-items-center rounded text-[.7rem] text-fg-subtle hover:bg-surface disabled:opacity-30"
              >
                ‹
              </button>
            </div>
          </div>
        ))}

        {queued.map((src) => (
          <div key={src} className="relative size-[72px] overflow-hidden rounded-input border border-dashed border-accent">
            {/* A blob: URL from the file the user just picked. next/image
                cannot optimise one, and there is nothing to optimise — it
                never leaves the browser. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="" className="size-full object-cover opacity-50" />
            <span className="absolute inset-0 grid place-items-center bg-bg/60 text-[.65rem]">
              מעלה…
            </span>
          </div>
        ))}

        {!full && (
          <button
            type="button"
            disabled={pending}
            onClick={() => inputRef.current?.click()}
            className="grid size-[72px] place-items-center rounded-input border border-dashed border-line-strong text-fg-subtle transition-colors hover:border-accent hover:bg-accent-soft hover:text-accent-strong disabled:opacity-50"
          >
            <span className="flex flex-col items-center gap-0.5">
              <Icon name="image" size={18} />
              <span className="text-[.62rem] leading-none">הוסיפו</span>
            </span>
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept={DISH_IMAGE_SPEC.formats.join(',')}
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) pick(e.target.files);
          e.target.value = '';
        }}
      />

      <p className="text-[.72rem] text-fg-subtle">
        עד <span className="money">{DISH_IMAGE_SPEC.maxPerDish}</span> תמונות. הראשונה היא
        זו שמופיעה ברשימות. אפשר לבחור כמה בבת אחת.
      </p>
    </div>
  );
}
