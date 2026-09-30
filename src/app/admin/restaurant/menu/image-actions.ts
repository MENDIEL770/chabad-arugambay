'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/server';
import { hasSupabase, TENANT_ID } from '@/lib/config';
import { NotAuthorized, requireRole } from '@/lib/auth';
import type { AppRole } from '@/lib/roles';

export interface ActionResult {
  ok: boolean;
  message: string;
}

/** Shared with the client so the guidance cannot drift from the rule. */
export const DISH_IMAGE_SPEC = {
  maxBytes: 8 * 1024 * 1024,
  warnBytes: 600 * 1024,
  maxPerDish: 8,
  minWidth: 800,
  formats: ['image/jpeg', 'image/png', 'image/webp', 'image/avif'],
  formatLabel: 'JPEG · WebP · AVIF',
} as const;

function db() {
  return createServiceClient();
}

async function guarded(min: AppRole, run: () => Promise<ActionResult>): Promise<ActionResult> {
  if (!hasSupabase()) return { ok: false, message: 'אין חיבור ל-Supabase.' };
  try {
    await requireRole(min);
  } catch (e) {
    if (e instanceof NotAuthorized) return { ok: false, message: e.message };
    throw e;
  }
  return run();
}

function done(message: string): ActionResult {
  revalidatePath('/admin/restaurant/menu');
  revalidatePath('/menu');
  revalidatePath('/');
  return { ok: true, message };
}

function missingTable(msg: string): boolean {
  return /menu_item_images|schema cache|does not exist/i.test(msg);
}

export async function uploadDishImage(formData: FormData): Promise<ActionResult> {
  return guarded('staff', async () => {
    const itemId = String(formData.get('itemId') ?? '');
    const file = formData.get('image');

    if (!z.string().uuid().safeParse(itemId).success) {
      return { ok: false, message: 'מנה לא מזוהה.' };
    }
    if (!(file instanceof File) || file.size === 0) {
      return { ok: false, message: 'לא נבחרה תמונה.' };
    }
    if (file.size > DISH_IMAGE_SPEC.maxBytes) {
      return { ok: false, message: 'התמונה גדולה מ-8MB. כדאי לדחוס.' };
    }
    if (!(DISH_IMAGE_SPEC.formats as readonly string[]).includes(file.type)) {
      return { ok: false, message: `פורמט לא נתמך. ${DISH_IMAGE_SPEC.formatLabel}.` };
    }

    const width = Number(formData.get('width')) || null;
    const height = Number(formData.get('height')) || null;

    const sb = db();

    const { data: existing, error: countErr } = await sb
      .from('menu_item_images')
      .select('id, sort')
      .eq('item_id', itemId)
      .order('sort', { ascending: false });

    if (countErr) {
      if (missingTable(countErr.message)) {
        return { ok: false, message: 'חסרה המיגרציה 0009_dish_photos.sql. הריצו אותה ב-SQL Editor.' };
      }
      return { ok: false, message: countErr.message };
    }
    if ((existing?.length ?? 0) >= DISH_IMAGE_SPEC.maxPerDish) {
      return {
        ok: false,
        message: `יש כבר ${DISH_IMAGE_SPEC.maxPerDish} תמונות למנה. מחקו אחת קודם.`,
      };
    }

    const ext = file.type.split('/')[1].replace('jpeg', 'jpg');
    const key = `${TENANT_ID}/${itemId}/${Date.now()}.${ext}`;

    const { error: upErr } = await sb.storage
      .from('menu')
      .upload(key, file, { contentType: file.type, upsert: false });
    if (upErr) return { ok: false, message: `ההעלאה נכשלה: ${upErr.message}` };

    const nextSort = ((existing?.[0]?.sort as number) ?? -1) + 1;

    const { error: rowErr } = await sb.from('menu_item_images').insert({
      tenant_id: TENANT_ID,
      item_id: itemId,
      storage_path: key,
      sort: nextSort,
      width_px: width,
      height_px: height,
      bytes: file.size,
    });

    if (rowErr) {
      await sb.storage.from('menu').remove([key]);
      return { ok: false, message: `שמירת הנתיב נכשלה: ${rowErr.message}` };
    }

    // The first photo also becomes the thumbnail used in lists.
    if (nextSort === 0) {
      await sb.from('menu_items').update({ image_path: key }).eq('id', itemId).eq('tenant_id', TENANT_ID);
    }

    return done('התמונה נוספה.');
  });
}

export async function deleteDishImage(imageId: string): Promise<ActionResult> {
  return guarded('staff', async () => {
    const sb = db();
    const { data: row } = await sb
      .from('menu_item_images')
      .select('storage_path, item_id, sort')
      .eq('id', imageId)
      .eq('tenant_id', TENANT_ID)
      .maybeSingle();

    if (!row) return { ok: false, message: 'התמונה לא נמצאה.' };

    const { error } = await sb
      .from('menu_item_images')
      .delete()
      .eq('id', imageId)
      .eq('tenant_id', TENANT_ID);
    if (error) return { ok: false, message: error.message };

    // Row first, then the file — a half-failure must never leave a card
    // pointing at an image that is gone.
    await sb.storage.from('menu').remove([row.storage_path as string]);

    // If the thumbnail was the one removed, promote whatever is now first.
    const { data: rest } = await sb
      .from('menu_item_images')
      .select('storage_path')
      .eq('item_id', row.item_id as string)
      .order('sort')
      .limit(1);

    await sb
      .from('menu_items')
      .update({ image_path: (rest?.[0]?.storage_path as string) ?? null })
      .eq('id', row.item_id as string)
      .eq('tenant_id', TENANT_ID);

    return done('התמונה נמחקה.');
  });
}

/** Move a photo one place earlier or later; the first one is the thumbnail. */
export async function moveDishImage(imageId: string, direction: -1 | 1): Promise<ActionResult> {
  return guarded('staff', async () => {
    const sb = db();
    const { data: row } = await sb
      .from('menu_item_images')
      .select('item_id')
      .eq('id', imageId)
      .eq('tenant_id', TENANT_ID)
      .maybeSingle();
    if (!row) return { ok: false, message: 'התמונה לא נמצאה.' };

    const { data: all } = await sb
      .from('menu_item_images')
      .select('id, sort, storage_path')
      .eq('item_id', row.item_id as string)
      .order('sort');

    const list = all ?? [];
    const at = list.findIndex((r) => r.id === imageId);
    const to = at + direction;
    if (at === -1 || to < 0 || to >= list.length) {
      return { ok: false, message: 'אי אפשר להזיז לשם.' };
    }

    const a = list[at];
    const b = list[to];
    await sb.from('menu_item_images').update({ sort: b.sort }).eq('id', a.id);
    await sb.from('menu_item_images').update({ sort: a.sort }).eq('id', b.id);

    // Keep the thumbnail in step with whatever is now first.
    const first = to === 0 ? a : at === 0 ? b : null;
    if (first) {
      await sb
        .from('menu_items')
        .update({ image_path: first.storage_path as string })
        .eq('id', row.item_id as string)
        .eq('tenant_id', TENANT_ID);
    }

    return done('הסדר עודכן.');
  });
}
