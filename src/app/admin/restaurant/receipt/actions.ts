'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/server';
import { hasSupabase, TENANT_ID } from '@/lib/config';
import { NotAuthorized, requireRole } from '@/lib/auth';
import type { AppRole } from '@/lib/roles';
import { RECEIPT_IMAGE_SPEC } from '@/lib/spec/receipt-image';

export interface ActionResult {
  ok: boolean;
  message: string;
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

const Schema = z.object({
  header: z.string().max(600),
  footer: z.string().max(600),
  paperWidth: z.coerce.number().int().refine((n) => n === 58 || n === 80, 'רוחב נייר לא נתמך'),
  showLogo: z.string().optional(),
  showQr: z.string().optional(),
  showPrices: z.string().optional(),
  kitchenShowPrices: z.string().optional(),
});

/** One line per row in the textarea; blank rows are dropped. */
function toLines(raw: string): string[] {
  return raw
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 8);
}

export async function saveReceiptTemplate(formData: FormData): Promise<ActionResult> {
  return guarded('staff', async () => {
    const parsed = Schema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) {
      return { ok: false, message: parsed.error.issues[0]?.message ?? 'קלט לא תקין' };
    }
    const v = parsed.data;

    const { error } = await createServiceClient()
      .from('receipt_template')
      .upsert(
        {
          tenant_id: TENANT_ID,
          header_lines: toLines(v.header),
          footer_lines: toLines(v.footer),
          paper_width: v.paperWidth,
          show_logo: v.showLogo === 'on',
          show_qr: v.showQr === 'on',
          show_prices: v.showPrices === 'on',
          kitchen_show_prices: v.kitchenShowPrices === 'on',
        },
        { onConflict: 'tenant_id' },
      );

    if (error) {
      if (/schema cache|does not exist/i.test(error.message)) {
        return { ok: false, message: 'חסרה המיגרציה 0011_printing.sql. הריצו אותה ב-SQL Editor.' };
      }
      return { ok: false, message: `השמירה נכשלה: ${error.message}` };
    }

    revalidatePath('/admin/restaurant/receipt');
    return { ok: true, message: 'התבנית נשמרה.' };
  });
}

const SLOTS = {
  logo: 'logo_path',
  header: 'header_image_path',
  footer: 'footer_image_path',
} as const;

export type ReceiptImageSlot = keyof typeof SLOTS;


export async function uploadReceiptImage(formData: FormData): Promise<ActionResult> {
  return guarded('staff', async () => {
    const slot = String(formData.get('slot') ?? '') as ReceiptImageSlot;
    if (!(slot in SLOTS)) return { ok: false, message: 'שדה לא מוכר.' };

    const file = formData.get('image');
    if (!(file instanceof File) || file.size === 0) {
      return { ok: false, message: 'לא נבחרה תמונה.' };
    }
    if (file.size > RECEIPT_IMAGE_SPEC.maxBytes) {
      return { ok: false, message: 'התמונה גדולה מ-2MB.' };
    }
    if (!(RECEIPT_IMAGE_SPEC.formats as readonly string[]).includes(file.type)) {
      return { ok: false, message: `פורמט לא נתמך. ${RECEIPT_IMAGE_SPEC.formatLabel}.` };
    }

    const sb = createServiceClient();
    const ext = file.type.split('/')[1].replace('jpeg', 'jpg');
    const key = `${TENANT_ID}/${slot}-${Date.now()}.${ext}`;

    const { error: upErr } = await sb.storage
      .from('receipt')
      .upload(key, file, { contentType: file.type, upsert: false });
    if (upErr) return { ok: false, message: `ההעלאה נכשלה: ${upErr.message}` };

    // Read the old key first so it can be removed only after the row points
    // at the new one — a failure in between must not leave a blank receipt.
    const { data: prev } = await sb
      .from('receipt_template')
      .select(SLOTS[slot])
      .eq('tenant_id', TENANT_ID)
      .maybeSingle();

    const { error: rowErr } = await sb
      .from('receipt_template')
      .upsert({ tenant_id: TENANT_ID, [SLOTS[slot]]: key }, { onConflict: 'tenant_id' });

    if (rowErr) {
      await sb.storage.from('receipt').remove([key]);
      return { ok: false, message: `השמירה נכשלה: ${rowErr.message}` };
    }

    const old = (prev as Record<string, string> | null)?.[SLOTS[slot]];
    if (old && old !== key) await sb.storage.from('receipt').remove([old]);

    revalidatePath('/admin/restaurant/receipt');
    return { ok: true, message: 'התמונה הועלתה.' };
  });
}

export async function removeReceiptImage(slot: ReceiptImageSlot): Promise<ActionResult> {
  return guarded('staff', async () => {
    if (!(slot in SLOTS)) return { ok: false, message: 'שדה לא מוכר.' };

    const sb = createServiceClient();
    const { data: row } = await sb
      .from('receipt_template')
      .select(SLOTS[slot])
      .eq('tenant_id', TENANT_ID)
      .maybeSingle();

    const { error } = await sb
      .from('receipt_template')
      .upsert({ tenant_id: TENANT_ID, [SLOTS[slot]]: null }, { onConflict: 'tenant_id' });
    if (error) return { ok: false, message: error.message };

    const path = (row as Record<string, string> | null)?.[SLOTS[slot]];
    if (path) await sb.storage.from('receipt').remove([path]);

    revalidatePath('/admin/restaurant/receipt');
    return { ok: true, message: 'התמונה הוסרה.' };
  });
}
