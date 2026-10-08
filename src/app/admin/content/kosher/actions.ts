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
  revalidatePath('/admin/content/kosher');
  revalidatePath('/kosher');
  return { ok: true, message };
}

function fail(error: { message: string }): ActionResult {
  if (/kosher_|schema cache|does not exist/i.test(error.message)) {
    return { ok: false, message: 'חסרה המיגרציה 0024_kosher.sql. הריצו אותה ב-SQL Editor.' };
  }
  return { ok: false, message: error.message };
}

async function nextSort(table: string): Promise<number> {
  const { data } = await createServiceClient()
    .from(table).select('sort').eq('tenant_id', TENANT_ID)
    .order('sort', { ascending: false }).limit(1).maybeSingle();
  return ((data?.sort as number) ?? -1) + 1;
}

// ------------------------------------------------------------- categories

const CategorySchema = z.object({
  id: z.string().uuid().optional(),
  nameHe: z.string().trim().min(1, 'צריך שם לקטגוריה'),
  nameEn: z.string().trim().default(''),
  icon: z.string().trim().default('dish'),
});

export async function saveCategory(formData: FormData): Promise<ActionResult> {
  return guarded('staff', async () => {
    const parsed = CategorySchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) {
      return { ok: false, message: parsed.error.issues[0]?.message ?? 'קלט לא תקין' };
    }
    const v = parsed.data;
    const row = {
      tenant_id: TENANT_ID,
      name: { he: v.nameHe, en: v.nameEn || v.nameHe },
      icon: v.icon,
    };

    const sb = createServiceClient();
    if (v.id) {
      const { error } = await sb.from('kosher_categories').update(row)
        .eq('id', v.id).eq('tenant_id', TENANT_ID);
      if (error) return fail(error);
      return done('נשמר.');
    }

    const { error } = await sb.from('kosher_categories')
      .insert({ ...row, sort: await nextSort('kosher_categories') });
    if (error) return fail(error);
    return done('הקטגוריה נוספה.');
  });
}

export async function deleteCategory(id: string): Promise<ActionResult> {
  return guarded('staff', async () => {
    // Products are not deleted with it — the column is ON DELETE SET NULL,
    // so they fall into "ללא קטגוריה" rather than vanishing. Losing a
    // researched ruling because a group was tidied away would be worse
    // than an untidy list.
    const { error } = await createServiceClient()
      .from('kosher_categories').delete().eq('id', id).eq('tenant_id', TENANT_ID);
    if (error) return fail(error);
    return done('הקטגוריה נמחקה. המוצרים שלה נשארו, בלי שיוך.');
  });
}

export async function moveCategory(id: string, direction: 'up' | 'down'): Promise<ActionResult> {
  return guarded('staff', async () => {
    const sb = createServiceClient();
    const { data: all } = await sb.from('kosher_categories')
      .select('id, sort').eq('tenant_id', TENANT_ID).order('sort');
    if (!all) return { ok: false, message: 'לא נמצאו קטגוריות.' };

    const i = all.findIndex((r) => r.id === id);
    const j = direction === 'up' ? i - 1 : i + 1;
    if (i < 0 || j < 0 || j >= all.length) return { ok: true, message: '' };

    // Swap two values rather than renumbering, so two editors reordering
    // at once cannot renumber each other's work away.
    await Promise.all([
      sb.from('kosher_categories').update({ sort: all[j].sort }).eq('id', all[i].id).eq('tenant_id', TENANT_ID),
      sb.from('kosher_categories').update({ sort: all[i].sort }).eq('id', all[j].id).eq('tenant_id', TENANT_ID),
    ]);
    return done('');
  });
}

// --------------------------------------------------------------- products

const ProductSchema = z.object({
  id: z.string().uuid().optional(),
  categoryId: z.string().trim().default(''),
  nameHe: z.string().trim().min(1, 'צריך שם למוצר'),
  nameEn: z.string().trim().default(''),
  brand: z.string().trim().max(80).default(''),
  status: z.enum(['kosher', 'not_kosher', 'check']),
  certification: z.string().trim().max(120).default(''),
  kosherType: z.string().trim().max(60).default(''),
  notesHe: z.string().trim().max(600).default(''),
  whereToBuy: z.string().trim().max(160).default(''),
  barcode: z.string().trim().max(32).default(''),
  verifiedOn: z.string().trim().default(''),
  imagePath: z.string().trim().max(400).optional(),
});

export async function saveProduct(formData: FormData): Promise<ActionResult> {
  return guarded('staff', async () => {
    const parsed = ProductSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) {
      return { ok: false, message: parsed.error.issues[0]?.message ?? 'קלט לא תקין' };
    }
    const v = parsed.data;

    if (v.barcode && !/^\d{8,14}$/.test(v.barcode)) {
      return { ok: false, message: 'ברקוד הוא 8 עד 14 ספרות, בלי רווחים.' };
    }

    const row = {
      tenant_id: TENANT_ID,
      category_id: v.categoryId || null,
      name: { he: v.nameHe, en: v.nameEn || v.nameHe },
      brand: v.brand || null,
      status: v.status,
      certification: v.certification || null,
      kosher_type: v.kosherType || null,
      notes: { he: v.notesHe },
      where_to_buy: v.whereToBuy || null,
      barcode: v.barcode || null,
      verified_on: v.verifiedOn || null,
      ...(formData.has('imagePath')
        ? { image_path: String(formData.get('imagePath')) || null }
        : {}),
    };

    const sb = createServiceClient();
    if (v.id) {
      const { error } = await sb.from('kosher_products').update(row)
        .eq('id', v.id).eq('tenant_id', TENANT_ID);
      if (error) return fail(error);
      return done('נשמר.');
    }

    const { error } = await sb.from('kosher_products')
      .insert({ ...row, sort: await nextSort('kosher_products') });
    if (error) return fail(error);
    return done('המוצר נוסף.');
  });
}

export async function toggleProduct(id: string, active: boolean): Promise<ActionResult> {
  return guarded('staff', async () => {
    const { error } = await createServiceClient()
      .from('kosher_products').update({ is_active: active })
      .eq('id', id).eq('tenant_id', TENANT_ID);
    if (error) return fail(error);
    return done(active ? 'מוצג באתר.' : 'הוסתר.');
  });
}

export async function deleteProduct(id: string): Promise<ActionResult> {
  return guarded('staff', async () => {
    const { error } = await createServiceClient()
      .from('kosher_products').delete().eq('id', id).eq('tenant_id', TENANT_ID);
    if (error) return fail(error);
    return done('נמחק.');
  });
}

/** Mark a ruling as rechecked today, without opening the whole form. */
export async function reverify(id: string): Promise<ActionResult> {
  return guarded('staff', async () => {
    // Written in the tenant's timezone, not the server's: at 2am in Arugam
    // Bay a UTC date would record yesterday.
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Colombo', year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date());

    const { error } = await createServiceClient()
      .from('kosher_products').update({ verified_on: today })
      .eq('id', id).eq('tenant_id', TENANT_ID);
    if (error) return fail(error);
    return done('סומן כנבדק היום.');
  });
}
