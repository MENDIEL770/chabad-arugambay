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
  revalidatePath('/admin/content/happenings');
  revalidatePath('/whats-on');
  revalidatePath('/');
  return { ok: true, message };
}

function fail(error: { message: string }): ActionResult {
  if (/happenings|schema cache|does not exist/i.test(error.message)) {
    return { ok: false, message: 'חסרה המיגרציה 0010_happenings.sql. הריצו אותה ב-SQL Editor.' };
  }
  // The table's check constraints are the real rules; translate the ones a
  // person can actually hit into a sentence instead of a constraint name.
  if (/has_a_time/.test(error.message)) {
    return { ok: false, message: 'צריך שעה קבועה או עיגון לזמן היום.' };
  }
  if (/weekly_needs_weekday|monthly_needs_weekday/.test(error.message)) {
    return { ok: false, message: 'צריך לבחור יום בשבוע.' };
  }
  if (/once_needs_date/.test(error.message)) {
    return { ok: false, message: 'צריך לבחור תאריך.' };
  }
  return { ok: false, message: error.message };
}

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

const Schema = z.object({
  id: z.string().uuid().optional(),
  kind: z.enum(['class', 'farbrengen', 'notice', 'event']),
  cycle: z.enum(['once', 'weekly', 'monthly']),
  titleHe: z.string().trim().min(2, 'צריך שם לפעילות'),
  titleEn: z.string().trim().default(''),
  detailsHe: z.string().trim().max(1000).default(''),
  audienceHe: z.string().trim().max(120).default(''),
  locationHe: z.string().trim().max(120).default(''),
  weekday: z.string().default(''),
  weekOfMonth: z.string().default(''),
  onDate: z.string().default(''),
  startsAt: z.string().default(''),
  endsAt: z.string().default(''),
  anchor: z.string().default(''),
  anchorOffsetMin: z.coerce.number().int().min(-240).max(240).default(0),
});

export async function saveHappening(formData: FormData): Promise<ActionResult> {
  return guarded('staff', async () => {
    const parsed = Schema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) {
      return { ok: false, message: parsed.error.issues[0]?.message ?? 'קלט לא תקין' };
    }
    const v = parsed.data;

    const anchor = v.anchor || null;
    const startsAt = v.startsAt || null;

    // Checked here as well as in the database so the editor gets a sentence
    // rather than a constraint violation.
    if (!anchor && !startsAt) {
      return { ok: false, message: 'צריך לקבוע שעה, או לעגן לזמן היום (שקיעה / נרות / צאת הכוכבים).' };
    }
    if (startsAt && !TIME.test(startsAt)) {
      return { ok: false, message: 'שעת התחלה לא תקינה.' };
    }
    if (v.endsAt && !TIME.test(v.endsAt)) {
      return { ok: false, message: 'שעת סיום לא תקינה.' };
    }
    if (startsAt && v.endsAt && v.endsAt <= startsAt) {
      return { ok: false, message: 'שעת הסיום חייבת להיות אחרי שעת ההתחלה.' };
    }

    const weekday = v.weekday === '' ? null : Number(v.weekday);
    if ((v.cycle === 'weekly' || v.cycle === 'monthly') && weekday === null) {
      return { ok: false, message: 'צריך לבחור יום בשבוע.' };
    }
    if (v.cycle === 'once' && !v.onDate) {
      return { ok: false, message: 'צריך לבחור תאריך.' };
    }

    const row = {
      tenant_id: TENANT_ID,
      kind: v.kind,
      cycle: v.cycle,
      title: { he: v.titleHe, en: v.titleEn || v.titleHe },
      details: { he: v.detailsHe },
      audience: { he: v.audienceHe },
      location: { he: v.locationHe },
      // Fields that belong to the other cycles are cleared, not left over:
      // a weekly class that used to be a one-off would otherwise keep a
      // stale date and trip the constraint later.
      weekday: v.cycle === 'once' ? null : weekday,
      week_of_month: v.cycle === 'monthly' && v.weekOfMonth ? Number(v.weekOfMonth) : null,
      on_date: v.cycle === 'once' ? v.onDate : null,
      starts_at: startsAt,
      ends_at: v.endsAt || null,
      anchor,
      anchor_offset_min: anchor ? v.anchorOffsetMin : 0,
    };

    const sb = createServiceClient();

    if (v.id) {
      const { error } = await sb.from('happenings').update(row).eq('id', v.id).eq('tenant_id', TENANT_ID);
      if (error) return fail(error);
      return done('נשמר.');
    }

    const { data: last } = await sb
      .from('happenings').select('sort').eq('tenant_id', TENANT_ID)
      .order('sort', { ascending: false }).limit(1).maybeSingle();

    const { error } = await sb.from('happenings').insert({ ...row, sort: ((last?.sort as number) ?? 0) + 1 });
    if (error) return fail(error);
    return done('הפעילות נוספה.');
  });
}

export async function toggleHappening(id: string, active: boolean): Promise<ActionResult> {
  return guarded('staff', async () => {
    const { error } = await createServiceClient()
      .from('happenings').update({ is_active: active })
      .eq('id', id).eq('tenant_id', TENANT_ID);
    if (error) return fail(error);
    // Pausing rather than deleting is the normal move here: Arugam Bay
    // empties out between November and March and the classes come back.
    return done(active ? 'מוצג בלוח.' : 'הופסק לעונה.');
  });
}

export async function deleteHappening(id: string): Promise<ActionResult> {
  return guarded('staff', async () => {
    const { error } = await createServiceClient()
      .from('happenings').delete().eq('id', id).eq('tenant_id', TENANT_ID);
    if (error) return fail(error);
    return done('נמחק.');
  });
}
