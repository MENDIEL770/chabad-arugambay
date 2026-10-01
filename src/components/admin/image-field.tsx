'use client';

import { useState } from 'react';
import { createUploadTicket, type Ticket } from '@/app/admin/upload-actions';
import { uploadToTicket } from '@/lib/upload';
import { runAction } from '@/lib/run-action';
import { UPLOAD_KINDS, type UploadKind } from '@/lib/spec/uploads';

/**
 * Pick a picture, send it straight to Storage, and post only its path.
 *
 * The hidden field is absent until something changes, which is how "leave
 * the existing picture alone" stays distinct from "remove it". Collapsing
 * those two would wipe the photo on every unrelated save.
 */
export function ImageField({
  kind, name = 'imagePath', currentUrl, label, hint, onError,
}: {
  kind: UploadKind;
  name?: string;
  currentUrl?: string | null;
  label: string;
  hint?: string;
  onError: (message: string) => void;
}) {
  const [preview, setPreview] = useState<string | null>(currentUrl ?? null);
  const [path, setPath] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const spec = UPLOAD_KINDS[kind];

  async function choose(file: File | undefined) {
    if (!file) return;
    setBusy(true);

    const ticket = await runAction(() => createUploadTicket(kind, file.type, file.size));
    if (!ticket.ok) { setBusy(false); onError(ticket.message); return; }

    const up = await uploadToTicket(ticket as Ticket, file);
    setBusy(false);
    if (!up.ok) { onError(up.message); return; }

    setPath(up.path);
    setPreview(URL.createObjectURL(file));
  }

  return (
    <div>
      <span className="label !mb-1">{label}</span>
      <div className="flex flex-wrap items-center gap-3">
        {preview && (
          <div className="h-20 w-28 shrink-0 overflow-hidden rounded-input border border-line">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="" className="size-full object-cover" />
          </div>
        )}
        <div className="min-w-[10rem] flex-1">
          <input
            type="file"
            accept={spec.formats.join(',')}
            disabled={busy}
            onChange={(e) => void choose(e.target.files?.[0])}
            className="block w-full text-[.78rem] file:me-2 file:rounded-input file:border-0 file:bg-accent-soft file:px-3 file:py-1.5 file:text-accent-strong"
          />
          <span className="mt-1 block text-[.72rem] text-fg-subtle">
            {busy ? 'מעלה…' : hint ?? `${spec.formatLabel} · עד ${Math.round(spec.maxBytes / 1024 / 1024)}MB`}
          </span>
        </div>
        {preview && (
          <button
            type="button"
            className="btn btn-ghost btn-sm text-danger"
            onClick={() => { setPreview(null); setPath(''); }}
          >
            הסרה
          </button>
        )}
      </div>
      {path !== null && <input type="hidden" name={name} value={path} />}
    </div>
  );
}
