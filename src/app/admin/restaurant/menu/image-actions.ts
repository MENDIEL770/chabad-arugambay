'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/server';
import { hasSupabase, TENANT_ID } from '@/lib/config';
import { NotAuthorized, requireRole } from '@/lib/auth';
import type { AppRole } from '@/lib/roles';
import { DISH_IMAGE_SPEC } from '@/lib/spec/dish-image';
import { objectExists } from '@/app/admin/upload-actions';

export interface ActionResult {
  ok: boolean;
  message: string;
}


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

/**
 * Record a dish photo that has already landed in Storage.
 *
 * The bytes go straight from the browser to Storage with a one-shot token
 * from createUploadTicket. They must not come through here: Next caps an
 * action body at 1MB by default and Vercel caps a serverless request body
 * at 4.5MB, so the 8MB this screen offers could never have arrived — the
 * upload failed as a redacted React #441 with no mention of size.
 */
export async function commitDishImage(formData: FormData): Promise<ActionResult> {
  return guarded('staff', async () => {
    const itemId = String(formData.get('itemId') ?? '');
    const path = String(formData.get('path') ?? '');

    if (!z.string().uuid().safeParse(itemId).success) {
      return { ok: false, message: 'מנה לא מזוהה.' };
    }
    // The path is minted server-side and must still match this dish, so a
    // forged request cannot attach someone else's file to a menu item.
    if (!path.startsWith(`${TENANT_ID}/${itemId}/`)) {
      return { ok: false, message: 'נתיב לא תקין.' };
    }
    if (!(await objectExists('menu', path))) {
      return { ok: false, message: 'הקובץ לא נמצא באחסון. נסו להעלות שוב.' };
    }

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
      await sb.storage.from('menu').remove([path]);
      return {
        ok: false,
        message: `יש כבר ${DISH_IMAGE_SPEC.maxPerDish} תמונות למנה. מחקו אחת קודם.`,
      };
    }

    const nextSort = ((existing?.[0]?.sort as number) ?? -1) + 1;

    const { error: rowErr } = await sb.from('menu_item_images').insert({
      tenant_id: TENANT_ID,
      item_id: itemId,
      storage_path: path,
      sort: nextSort,
      width_px: Number(formData.get('width')) || null,
      height_px: Number(formData.get('height')) || null,
      bytes: Number(formData.get('bytes')) || null,
    });

    if (rowErr) {
      await sb.storage.from('menu').remove([path]);
      return { ok: false, message: `שמירת הנתיב נכשלה: ${rowErr.message}` };
    }

    // The first photo also becomes the thumbnail used in lists.
    if (nextSort === 0) {
      await sb.from('menu_items').update({ image_path: path }).eq('id', itemId).eq('tenant_id', TENANT_ID);
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
