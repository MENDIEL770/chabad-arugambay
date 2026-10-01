'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/server';
import { hasSupabase, TENANT_ID } from '@/lib/config';
import { NotAuthorized, requireRole } from '@/lib/auth';

export interface ActionResult {
  ok: boolean;
  message: string;
}

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

const DaySchema = z.object({
  weekday: z.coerce.number().int().min(0).max(6),
  opens: z.string().regex(TIME, 'שעה לא תקינה'),
  closes: z.string().regex(TIME, 'שעה לא תקינה'),
  closed: z.string().optional(),
});

export async function saveOpeningHours(formData: FormData): Promise<ActionResult> {
  try {
    await requireRole('staff');
  } catch (e) {
    if (e instanceof NotAuthorized) return { ok: false, message: e.message };
    throw e;
  }
  if (!hasSupabase()) return { ok: false, message: 'אין חיבור ל-Supabase.' };

  const rows: {
    tenant_id: string; weekday: number; opens: string; closes: string; is_closed: boolean;
  }[] = [];

  for (let d = 0; d <= 6; d++) {
    const parsed = DaySchema.safeParse({
      weekday: d,
      opens: formData.get(`opens_${d}`),
      closes: formData.get(`closes_${d}`),
      closed: formData.get(`closed_${d}`) ?? undefined,
    });
    if (!parsed.success) {
      return { ok: false, message: `${DAY_NAMES[d]}: ${parsed.error.issues[0]?.message}` };
    }
    const v = parsed.data;
    const isClosed = v.closed === 'on';

    // A closing time earlier than the opening time would silently mean the
    // restaurant is never open, which reads as a bug rather than a typo.
    if (!isClosed && v.closes <= v.opens) {
      return { ok: false, message: `${DAY_NAMES[d]}: שעת הסגירה חייבת להיות אחרי שעת הפתיחה.` };
    }

    rows.push({
      tenant_id: TENANT_ID,
      weekday: d,
      opens: v.opens,
      closes: v.closes,
      is_closed: isClosed,
    });
  }

  const { error } = await createServiceClient()
    .from('opening_hours')
    .upsert(rows, { onConflict: 'tenant_id,weekday' });

  if (error) return { ok: false, message: `השמירה נכשלה: ${error.message}` };

  // Every page shows the open/closed pill, so the whole site is revalidated.
  revalidatePath('/', 'layout');
  return { ok: true, message: 'שעות הפתיחה נשמרו.' };
}

export const DAY_NAMES = [
  'ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת',
] as const;
