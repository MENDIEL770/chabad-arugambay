'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/server';
import { hasSupabase, TENANT_ID } from '@/lib/config';
import { NotAuthorized, requireRole } from '@/lib/auth';
import { SITE_TEXT, type TextKey } from '@/lib/site-text';

export interface ActionResult {
  ok: boolean;
  message: string;
}

export async function saveSiteText(formData: FormData): Promise<ActionResult> {
  try {
    await requireRole('staff');
  } catch (e) {
    if (e instanceof NotAuthorized) return { ok: false, message: e.message };
    throw e;
  }
  if (!hasSupabase()) return { ok: false, message: 'אין חיבור ל-Supabase.' };

  const key = String(formData.get('key') ?? '');
  // Only keys the code knows about. An arbitrary key would be dead weight
  // nothing reads, and an invitation to store junk in the table.
  if (!(key in SITE_TEXT)) return { ok: false, message: 'מפתח לא מוכר.' };

  const he = z.string().max(2000).safeParse(formData.get('he') ?? '');
  const en = z.string().max(2000).safeParse(formData.get('en') ?? '');
  if (!he.success || !en.success) return { ok: false, message: 'טקסט ארוך מדי.' };

  const sb = createServiceClient();

  // Clearing both fields means "go back to the built-in text", which is a
  // real thing an editor wants — not an empty string on the page.
  if (!he.data.trim() && !en.data.trim()) {
    const { error } = await sb
      .from('site_text')
      .delete()
      .eq('tenant_id', TENANT_ID)
      .eq('key', key);
    if (error) return { ok: false, message: error.message };
    revalidatePath('/', 'layout');
    return { ok: true, message: 'חזר לטקסט המקורי.' };
  }

  const fallback = SITE_TEXT[key as TextKey];
  const { error } = await sb.from('site_text').upsert(
    {
      tenant_id: TENANT_ID,
      key,
      value: { he: he.data.trim() || fallback.he, en: en.data.trim() || fallback.en },
    },
    { onConflict: 'tenant_id,key' },
  );

  if (error) {
    if (/schema cache|does not exist/i.test(error.message)) {
      return { ok: false, message: 'חסרה המיגרציה 0012_site_text.sql.' };
    }
    return { ok: false, message: `השמירה נכשלה: ${error.message}` };
  }

  revalidatePath('/', 'layout');
  return { ok: true, message: 'נשמר.' };
}
