'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/server';
import { hasSupabase, TENANT_ID } from '@/lib/config';
import { NotAuthorized, requireRole } from '@/lib/auth';
import type { AppRole } from '@/lib/roles';
import { toEmbedUrl } from '@/lib/data/gallery';
import { objectExists } from '@/app/admin/upload-actions';

export interface ActionResult {
  ok: boolean;
  message: string;
}

const BUCKET = 'content';



async function guarded(min: AppRole, run: () => Promise<ActionResult>): Promise<ActionResult> {
  try {
    await requireRole(min);
  } catch (e) {
    if (e instanceof NotAuthorized) return { ok: false, message: e.message };
    throw e;
  }
  if (!hasSupabase()) return { ok: false, message: 'אין חיבור ל-Supabase.' };
  return run();
}

function done(message: string): ActionResult {
  revalidatePath('/admin/content/gallery');
  revalidatePath('/gallery');
  revalidatePath('/');
  return { ok: true, message };
}

function fail(error: { message: string }): ActionResult {
  if (/media_items|schema cache|does not exist/i.test(error.message)) {
    return { ok: false, message: 'חסרה המיגרציה 0008_content.sql. הריצו אותה ב-SQL Editor.' };
  }
  return { ok: false, message: error.message };
}

async function nextSort(): Promise<number> {
  const { data } = await createServiceClient()
    .from('media_items').select('sort').eq('tenant_id', TENANT_ID)
    .order('sort', { ascending: false }).limit(1).maybeSingle();
  return ((data?.sort as number) ?? -1) + 1;
}

/**
 * Record a photo that has already landed in Storage.
 *
 * Verifies the object actually exists before writing the row: a row
 * pointing at a file that never arrived is a broken image forever, and the
 * browser could call this without having uploaded anything.
 */
export async function commitPhoto(formData: FormData): Promise<ActionResult> {
  return guarded('staff', async () => {
    const path = String(formData.get('path') ?? '');
    if (!path.startsWith(`${TENANT_ID}/gallery/`)) {
      return { ok: false, message: 'נתיב לא תקין.' };
    }

    const sb = createServiceClient();

    if (!(await objectExists(BUCKET, path))) {
      return { ok: false, message: 'הקובץ לא נמצא באחסון. נסו להעלות שוב.' };
    }

    const { error } = await sb.from('media_items').insert({
      tenant_id: TENANT_ID,
      kind: 'photo',
      storage_path: path,
      caption: { he: String(formData.get('caption') ?? '').trim() },
      album: String(formData.get('album') ?? '').trim() || 'general',
      taken_on: String(formData.get('takenOn') ?? '') || null,
      is_featured: formData.get('featured') === 'on',
      width_px: Number(formData.get('width')) || null,
      height_px: Number(formData.get('height')) || null,
      bytes: Number(formData.get('bytes')) || null,
      sort: await nextSort(),
    });

    if (error) {
      // Leave no orphan file behind when the row fails.
      await sb.storage.from(BUCKET).remove([path]);
      return fail(error);
    }
    return done('התמונה נוספה לגלריה.');
  });
}

const VideoSchema = z.object({
  url: z.string().trim().url('כתובת לא תקינה'),
  caption: z.string().trim().max(300).default(''),
  album: z.string().trim().max(60).default(''),
});

export async function addVideo(formData: FormData): Promise<ActionResult> {
  return guarded('staff', async () => {
    const parsed = VideoSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) {
      return { ok: false, message: parsed.error.issues[0]?.message ?? 'קלט לא תקין' };
    }
    const { url, caption, album } = parsed.data;

    const embed = toEmbedUrl(url);
    if (embed === url && !/youtube|youtu\.be|vimeo/i.test(url)) {
      return { ok: false, message: 'נתמכים כרגע YouTube ו-Vimeo בלבד.' };
    }

    const { error } = await createServiceClient().from('media_items').insert({
      tenant_id: TENANT_ID,
      kind: 'video',
      external_url: url,
      caption: { he: caption },
      album: album || 'general',
      sort: await nextSort(),
    });
    if (error) return fail(error);
    return done('הסרטון נוסף.');
  });
}

const EditSchema = z.object({
  id: z.string().uuid(),
  caption: z.string().trim().max(300).default(''),
  album: z.string().trim().max(60).default(''),
  takenOn: z.string().trim().default(''),
});

export async function editMedia(formData: FormData): Promise<ActionResult> {
  return guarded('staff', async () => {
    const parsed = EditSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) {
      return { ok: false, message: parsed.error.issues[0]?.message ?? 'קלט לא תקין' };
    }
    const v = parsed.data;

    const { error } = await createServiceClient()
      .from('media_items')
      .update({
        caption: { he: v.caption },
        album: v.album || 'general',
        taken_on: v.takenOn || null,
      })
      .eq('id', v.id).eq('tenant_id', TENANT_ID);

    if (error) return fail(error);
    return done('נשמר.');
  });
}

export async function toggleFeatured(id: string, featured: boolean): Promise<ActionResult> {
  return guarded('staff', async () => {
    const { error } = await createServiceClient()
      .from('media_items').update({ is_featured: featured })
      .eq('id', id).eq('tenant_id', TENANT_ID);
    if (error) return fail(error);
    return done(featured ? 'מוצג גם בעמוד הראשי.' : 'הוסר מהעמוד הראשי.');
  });
}

export async function moveMedia(id: string, direction: 'up' | 'down'): Promise<ActionResult> {
  return guarded('staff', async () => {
    const sb = createServiceClient();
    const { data: all } = await sb
      .from('media_items').select('id, sort')
      .eq('tenant_id', TENANT_ID).eq('is_active', true).order('sort');
    if (!all) return { ok: false, message: 'לא נמצאו פריטים.' };

    const i = all.findIndex((r) => r.id === id);
    const j = direction === 'up' ? i - 1 : i + 1;
    if (i < 0 || j < 0 || j >= all.length) return { ok: true, message: '' };

    // Swap the two sort values rather than renumbering everything, so two
    // editors reordering at once cannot renumber each other's work away.
    await Promise.all([
      sb.from('media_items').update({ sort: all[j].sort }).eq('id', all[i].id).eq('tenant_id', TENANT_ID),
      sb.from('media_items').update({ sort: all[i].sort }).eq('id', all[j].id).eq('tenant_id', TENANT_ID),
    ]);
    return done('');
  });
}

export async function deleteMedia(id: string): Promise<ActionResult> {
  return guarded('staff', async () => {
    const sb = createServiceClient();
    const { data: row } = await sb
      .from('media_items').select('storage_path')
      .eq('id', id).eq('tenant_id', TENANT_ID).maybeSingle();

    const { error } = await sb.from('media_items').delete().eq('id', id).eq('tenant_id', TENANT_ID);
    if (error) return fail(error);

    // The row is the record; a leftover file is wasted space, not a bug, so
    // the delete is not undone when this fails.
    const path = row?.storage_path as string | null;
    if (path) await sb.storage.from(BUCKET).remove([path]);

    return done('נמחק.');
  });
}
