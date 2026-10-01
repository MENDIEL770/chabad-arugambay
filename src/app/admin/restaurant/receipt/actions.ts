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
