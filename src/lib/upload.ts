'use client';

import { createBrowserClient } from '@/lib/supabase/browser';

export interface UploadTicket {
  ok: true;
  bucket: string;
  path: string;
  token: string;
}

/**
 * Send the file straight to Storage with a one-shot token.
 *
 * Returns the storage path, which is the only thing the follow-up action
 * needs. If this fails the caller must not write a row — a row pointing at
 * a file that never arrived shows as a broken image forever.
 */
export async function uploadToTicket(
  ticket: UploadTicket,
  file: File,
): Promise<{ ok: true; path: string } | { ok: false; message: string }> {
  const sb = createBrowserClient();

  const { error } = await sb.storage
    .from(ticket.bucket)
    .uploadToSignedUrl(ticket.path, ticket.token, file, { contentType: file.type });

  if (error) {
    return { ok: false, message: `ההעלאה נכשלה: ${error.message}` };
  }
  return { ok: true, path: ticket.path };
}

/** Width and height, measured before upload so the grid can reserve space. */
export function measureImage(file: File): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      resolve(null);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  });
}
