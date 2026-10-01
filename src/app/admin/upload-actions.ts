'use server';

import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/server';
import { hasSupabase, TENANT_ID } from '@/lib/config';
import { NotAuthorized, requireRole } from '@/lib/auth';
import { UPLOAD_KINDS, type UploadKind } from '@/lib/spec/uploads';

export interface Ticket {
  ok: true;
  /** Present so the shape satisfies runAction; never shown on success. */
  message: string;
  bucket: string;
  path: string;
  token: string;
}

export interface Refusal {
  ok: false;
  message: string;
}

/**
 * Decide whether a file may be uploaded, and hand back a one-shot token.
 *
 * The file never passes through here — only its declared type and size. The
 * browser then sends the bytes straight to Storage. That is what keeps an
 * 8MB photo out of a request body that the platform caps at 4.5MB.
 *
 * A token is minted only after requireRole passes, so the authorisation
 * decision still happens on the server even though the transfer does not.
 */
export async function createUploadTicket(
  kind: UploadKind,
  contentType: string,
  size: number,
  scope?: string,
): Promise<Ticket | Refusal> {
  try {
    await requireRole('staff');
  } catch (e) {
    if (e instanceof NotAuthorized) return { ok: false, message: e.message };
    throw e;
  }
  if (!hasSupabase()) return { ok: false, message: 'אין חיבור ל-Supabase.' };

  const spec = UPLOAD_KINDS[kind];
  if (!spec) return { ok: false, message: 'סוג העלאה לא מוכר.' };

  if (size <= 0) return { ok: false, message: 'הקובץ ריק.' };
  if (size > spec.maxBytes) {
    const mb = Math.round(spec.maxBytes / 1024 / 1024);
    return { ok: false, message: `הקובץ גדול מ-${mb}MB. כדאי לדחוס.` };
  }
  if (!(spec.formats as readonly string[]).includes(contentType)) {
    return { ok: false, message: `פורמט לא נתמך. ${spec.formatLabel}.` };
  }

  if (spec.needsScope && !z.string().uuid().safeParse(scope).success) {
    return { ok: false, message: 'חסר מזהה.' };
  }

  // The extension comes from the declared type, never the filename: a name
  // is attacker-controlled and ends up in a public URL.
  const ext = contentType.split('/')[1].replace('jpeg', 'jpg').replace('svg+xml', 'svg');

  // Tenant folder first — the storage policies read the tenant id out of
  // the path, so a key without it is refused for anyone but the service role.
  const parts = [TENANT_ID, spec.folder, spec.needsScope ? scope : null].filter(Boolean);
  const path = `${parts.join('/')}/${Date.now()}-${Math.floor(size % 9973)}.${ext}`;

  const { data, error } = await createServiceClient()
    .storage.from(spec.bucket).createSignedUploadUrl(path);

  if (error || !data) {
    return { ok: false, message: `לא ניתן להתחיל העלאה: ${error?.message ?? 'שגיאה'}` };
  }

  return { ok: true, message: '', bucket: spec.bucket, path: data.path, token: data.token };
}

/**
 * Confirm the bytes really landed.
 *
 * The browser could call a commit action without having uploaded anything,
 * and a row pointing at a missing object is a broken image forever.
 */
export async function objectExists(bucket: string, path: string): Promise<boolean> {
  if (!hasSupabase()) return false;
  const dir = path.slice(0, path.lastIndexOf('/'));
  const name = path.slice(path.lastIndexOf('/') + 1);
  const { data } = await createServiceClient().storage.from(bucket).list(dir, { search: name });
  return !!data?.some((f) => f.name === name);
}
