'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/server';
import { hasSupabase, TENANT_ID } from '@/lib/config';
import { NotAuthorized, requireRole, type AppRole } from '@/lib/auth';

export interface ActionResult {
  ok: boolean;
  message: string;
}

const NOT_CONFIGURED: ActionResult = {
  ok: false,
  message:
    'אין חיבור ל-Supabase. הגדירו NEXT_PUBLIC_SUPABASE_URL ו-SUPABASE_SERVICE_ROLE_KEY והריצו מחדש.',
};

/**
 * Every mutation goes through the service client and pins tenant_id itself.
 * The tenant is never taken from the form — a hidden field is user input, and
 * once this system is replicated, trusting it would let one shliach edit
 * another's menu.
 */
function db() {
  return createServiceClient();
}

/**
 * Authorise, then run.
 *
 * A Server Action is a public HTTP endpoint. Living under /admin protects
 * nothing, and the proxy cannot help either — an action can be invoked
 * directly without matching a route. Since every mutation below uses the
 * service-role client, which bypasses RLS completely, this check IS the
 * access control. Without it anyone who finds the endpoint can rewrite
 * prices and stock.
 */
async function guarded(
  min: AppRole,
  run: () => Promise<ActionResult>,
): Promise<ActionResult> {
  if (!hasSupabase()) return NOT_CONFIGURED;
  try {
    await requireRole(min);
  } catch (e) {
    if (e instanceof NotAuthorized) return { ok: false, message: e.message };
    throw e;
  }
  return run();
}

const PriceSchema = z.coerce.number().int().min(0).max(10_000_000);

const ItemSchema = z.object({
  id: z.string().uuid(),
  nameHe: z.string().trim().min(1, 'צריך שם בעברית'),
  nameEn: z.string().trim().min(1, 'צריך שם באנגלית'),
  descriptionHe: z.string().trim().default(''),
  descriptionEn: z.string().trim().default(''),
  priceLkr: PriceSchema,
  kosher: z.enum(['meat', 'dairy', 'pareve']),
  station: z.enum(['grill', 'cold', 'bar', 'bakery']),
  prepMinutes: z.coerce.number().int().min(0).max(240),
  stock: z.enum(['none', 'count', 'daily_limit']),
  stockQty: z.coerce.number().int().min(0).nullable().optional(),
  dailyLimit: z.coerce.number().int().min(0).nullable().optional(),
});

export async function saveItem(formData: FormData): Promise<ActionResult> {
  return guarded('staff', async () => {
    const raw = Object.fromEntries(formData) as Record<string, string>;
    const parsed = ItemSchema.safeParse({
      ...raw,
      stockQty: raw.stockQty === '' ? null : raw.stockQty,
      dailyLimit: raw.dailyLimit === '' ? null : raw.dailyLimit,
    });

    if (!parsed.success) {
      return {
        ok: false,
        message: parsed.error.issues[0]?.message ?? 'קלט לא תקין',
      };
    }
    const v = parsed.data;

    // The database checks these too, but failing here gives a usable message
    // instead of a constraint violation.
    if (v.stock === 'count' && v.stockQty == null) {
      return { ok: false, message: 'מלאי לפי כמות דורש מספר יחידות.' };
    }
    if (v.stock === 'daily_limit' && v.dailyLimit == null) {
      return { ok: false, message: 'מגבלה יומית דורשת מספר.' };
    }

    const { error } = await db()
      .from('menu_items')
      .update({
        name: { he: v.nameHe, en: v.nameEn },
        description: { he: v.descriptionHe, en: v.descriptionEn },
        price_lkr: v.priceLkr,
        kosher: v.kosher,
        station: v.station,
        prep_minutes: v.prepMinutes,
        stock: v.stock,
        stock_qty: v.stock === 'count' ? v.stockQty : null,
        daily_limit: v.stock === 'daily_limit' ? v.dailyLimit : null,
      })
      .eq('id', v.id)
      .eq('tenant_id', TENANT_ID);

    if (error) return { ok: false, message: `השמירה נכשלה: ${error.message}` };

    revalidatePath('/admin/restaurant/menu');
    revalidatePath('/menu');
    return { ok: true, message: 'נשמר.' };
  });
}

/** The 86 switch. Separate from saveItem so it is one click, not a form. */
export async function toggleAvailability(
  itemId: string,
  available: boolean,
): Promise<ActionResult> {
  // Kitchen, not staff: marking a dish sold out is the cook's job mid-service.
  return guarded('kitchen', async () => {
    const { error } = await db()
      .from('menu_items')
      .update({ is_available: available })
      .eq('id', itemId)
      .eq('tenant_id', TENANT_ID);

    if (error) return { ok: false, message: `העדכון נכשל: ${error.message}` };

    revalidatePath('/admin/restaurant/menu');
    revalidatePath('/menu');
    return { ok: true, message: available ? 'חזר לתפריט.' : 'סומן כאזל.' };
  });
}

/** Put stock back after a cancellation or a miscount. */
export async function restock(itemId: string, qty: number): Promise<ActionResult> {
  return guarded('kitchen', async () => {
    if (!Number.isInteger(qty) || qty < 0) {
      return { ok: false, message: 'כמות לא תקינה.' };
    }

    const { error } = await db()
      .from('menu_items')
      .update({ stock_qty: qty, is_available: qty > 0 })
      .eq('id', itemId)
      .eq('tenant_id', TENANT_ID);

    if (error) return { ok: false, message: `העדכון נכשל: ${error.message}` };

    revalidatePath('/admin/restaurant/menu');
    revalidatePath('/menu');
    return { ok: true, message: 'המלאי עודכן.' };
  });
}

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);

export async function uploadItemImage(formData: FormData): Promise<ActionResult> {
  return guarded('staff', async () => {
    const itemId = String(formData.get('id') ?? '');
    const file = formData.get('image');

    if (!z.string().uuid().safeParse(itemId).success) {
      return { ok: false, message: 'מנה לא מזוהה.' };
    }
    if (!(file instanceof File) || file.size === 0) {
      return { ok: false, message: 'לא נבחרה תמונה.' };
    }
    // Checked here and again by the bucket's own limits, because the bucket is
    // the only thing a direct upload would hit.
    if (file.size > MAX_IMAGE_BYTES) {
      return { ok: false, message: 'התמונה גדולה מ-8MB. כדאי להקטין אותה.' };
    }
    if (!ALLOWED.has(file.type)) {
      return {
        ok: false,
        message: 'פורמט לא נתמך. השתמשו ב-JPEG, PNG, WebP או AVIF.',
      };
    }

    const sb = db();
    const ext = file.type.split('/')[1].replace('jpeg', 'jpg');
    // Cache-busting name: overwriting a fixed key leaves stale CDN copies.
    const key = `${TENANT_ID}/${itemId}/${Date.now()}.${ext}`;

    const { error: upErr } = await sb.storage
      .from('menu')
      .upload(key, file, { contentType: file.type, upsert: false });

    if (upErr) return { ok: false, message: `ההעלאה נכשלה: ${upErr.message}` };

    // Read the previous key first so the old file can be removed after the row
    // points at the new one — never before, or a failure would leave no image.
    const { data: prev } = await sb
      .from('menu_items')
      .select('image_path')
      .eq('id', itemId)
      .eq('tenant_id', TENANT_ID)
      .single();

    const { error: rowErr } = await sb
      .from('menu_items')
      .update({ image_path: key })
      .eq('id', itemId)
      .eq('tenant_id', TENANT_ID);

    if (rowErr) {
      await sb.storage.from('menu').remove([key]); // don't orphan the upload
      return { ok: false, message: `שמירת הנתיב נכשלה: ${rowErr.message}` };
    }

    const old = prev?.image_path as string | undefined;
    if (old && old !== key) {
      await sb.storage.from('menu').remove([old]);
    }

    revalidatePath('/admin/restaurant/menu');
    revalidatePath('/menu');
    return { ok: true, message: 'התמונה הועלתה.' };
  });
}

export async function removeItemImage(itemId: string): Promise<ActionResult> {
  return guarded('staff', async () => {
    const sb = db();
    const { data: row } = await sb
      .from('menu_items')
      .select('image_path')
      .eq('id', itemId)
      .eq('tenant_id', TENANT_ID)
      .single();

    const { error } = await sb
      .from('menu_items')
      .update({ image_path: null })
      .eq('id', itemId)
      .eq('tenant_id', TENANT_ID);

    if (error) return { ok: false, message: `המחיקה נכשלה: ${error.message}` };

    const path = row?.image_path as string | undefined;
    if (path) await sb.storage.from('menu').remove([path]);

    revalidatePath('/admin/restaurant/menu');
    revalidatePath('/menu');
    return { ok: true, message: 'התמונה הוסרה.' };
  });
}
