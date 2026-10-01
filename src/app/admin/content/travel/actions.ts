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
  revalidatePath('/admin/content/travel');
  revalidatePath('/travel');
  return { ok: true, message };
}

function fail(error: { message: string }): ActionResult {
  if (/schema cache|does not exist/i.test(error.message)) {
    return { ok: false, message: 'חסרה המיגרציה 0016_travel.sql. הריצו אותה ב-SQL Editor.' };
  }
  return { ok: false, message: error.message };
}

const TIERS = ['luxury', 'standard', 'backpacker', 'family'] as const;

const StaySchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2, 'צריך שם למקום'),
  blurbHe: z.string().trim().max(400).default(''),
  blurbEn: z.string().trim().max(400).default(''),
  nightlyUsd: z.coerce.number().int().min(0).max(100000).optional(),
  walkMinutes: z.coerce.number().int().min(0).max(600).optional(),
  bookingUrl: z.string().trim().max(2000).default(''),
  isAffiliate: z.string().optional(),
  icon: z.string().trim().default('bed'),
  imagePath: z.string().trim().max(400).optional(),
});

export async function saveStay(formData: FormData): Promise<ActionResult> {
  return guarded('staff', async () => {
    const raw = Object.fromEntries(formData) as Record<string, string>;
    const parsed = StaySchema.safeParse({
      ...raw,
      nightlyUsd: raw.nightlyUsd === '' ? undefined : raw.nightlyUsd,
      walkMinutes: raw.walkMinutes === '' ? undefined : raw.walkMinutes,
    });
    if (!parsed.success) {
      return { ok: false, message: parsed.error.issues[0]?.message ?? 'קלט לא תקין' };
    }
    const v = parsed.data;

    const url = v.bookingUrl.trim();
    if (url && !/^https:\/\//i.test(url)) {
      return { ok: false, message: 'הקישור חייב להתחיל ב-https://' };
    }
    // The database enforces this too; catching it here gives a sentence
    // instead of a constraint violation.
    if (v.isAffiliate === 'on' && !url) {
      return { ok: false, message: 'אי אפשר לסמן קישור שותף בלי קישור.' };
    }

    const tiers = TIERS.filter((t) => formData.get(`tier_${t}`) === 'on');

    const row = {
      tenant_id: TENANT_ID,
      name: v.name,
      blurb: { he: v.blurbHe, en: v.blurbEn || v.blurbHe },
      tiers,
      nightly_usd: v.nightlyUsd ?? null,
      walk_minutes: v.walkMinutes ?? null,
      booking_url: url || null,
      is_affiliate: v.isAffiliate === 'on',
      icon: v.icon,
      // Absent means leave the picture alone; an empty string means remove
      // it. Collapsing those would wipe the photo on every unrelated edit.
      ...(formData.has('imagePath')
        ? { image_path: String(formData.get('imagePath')) || null }
        : {}),
    };

    const sb = createServiceClient();

    if (v.id) {
      const { error } = await sb.from('stays').update(row).eq('id', v.id).eq('tenant_id', TENANT_ID);
      if (error) return fail(error);
      return done('נשמר.');
    }

    const { data: last } = await sb
      .from('stays').select('sort').eq('tenant_id', TENANT_ID)
      .order('sort', { ascending: false }).limit(1).maybeSingle();

    const { error } = await sb
      .from('stays')
      .insert({ ...row, sort: ((last?.sort as number) ?? 0) + 1 });
    if (error) return fail(error);
    return done('המקום נוסף.');
  });
}

export async function toggleStay(id: string, active: boolean): Promise<ActionResult> {
  return guarded('staff', async () => {
    const { error } = await createServiceClient()
      .from('stays').update({ is_active: active }).eq('id', id).eq('tenant_id', TENANT_ID);
    if (error) return fail(error);
    return done(active ? 'מוצג באתר.' : 'הוסתר.');
  });
}

export async function deleteStay(id: string): Promise<ActionResult> {
  return guarded('staff', async () => {
    const { error } = await createServiceClient()
      .from('stays').delete().eq('id', id).eq('tenant_id', TENANT_ID);
    if (error) return fail(error);
    return done('נמחק.');
  });
}

const TipSchema = z.object({
  id: z.string().uuid().optional(),
  titleHe: z.string().trim().min(2, 'צריך כותרת'),
  titleEn: z.string().trim().default(''),
  bodyHe: z.string().trim().max(1000).default(''),
  bodyEn: z.string().trim().max(1000).default(''),
  tags: z.string().trim().max(200).default(''),
  icon: z.string().trim().default('map'),
  imagePath: z.string().trim().max(400).optional(),
});

export async function saveTip(formData: FormData): Promise<ActionResult> {
  return guarded('staff', async () => {
    const parsed = TipSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) {
      return { ok: false, message: parsed.error.issues[0]?.message ?? 'קלט לא תקין' };
    }
    const v = parsed.data;

    const row = {
      tenant_id: TENANT_ID,
      title: { he: v.titleHe, en: v.titleEn || v.titleHe },
      body: { he: v.bodyHe, en: v.bodyEn || v.bodyHe },
      // Comma-separated in the form, because a tag editor is more machinery
      // than this earns.
      tags: v.tags.split(',').map((t) => t.trim()).filter(Boolean).slice(0, 8),
      icon: v.icon,
      ...(formData.has('imagePath')
        ? { image_path: String(formData.get('imagePath')) || null }
        : {}),
    };

    const sb = createServiceClient();

    if (v.id) {
      const { error } = await sb.from('tips').update(row).eq('id', v.id).eq('tenant_id', TENANT_ID);
      if (error) return fail(error);
      return done('נשמר.');
    }

    const { data: last } = await sb
      .from('tips').select('sort').eq('tenant_id', TENANT_ID)
      .order('sort', { ascending: false }).limit(1).maybeSingle();

    const { error } = await sb
      .from('tips')
      .insert({ ...row, sort: ((last?.sort as number) ?? 0) + 1 });
    if (error) return fail(error);
    return done('ההמלצה נוספה.');
  });
}

export async function toggleTip(id: string, active: boolean): Promise<ActionResult> {
  return guarded('staff', async () => {
    const { error } = await createServiceClient()
      .from('tips').update({ is_active: active }).eq('id', id).eq('tenant_id', TENANT_ID);
    if (error) return fail(error);
    // Hiding beats deleting for anything seasonal: the surf school closes
    // for the monsoon and the write-up is wanted again in April.
    return done(active ? 'מוצגת באתר.' : 'הוסתרה.');
  });
}

export async function deleteTip(id: string): Promise<ActionResult> {
  return guarded('staff', async () => {
    const { error } = await createServiceClient()
      .from('tips').delete().eq('id', id).eq('tenant_id', TENANT_ID);
    if (error) return fail(error);
    return done('נמחק.');
  });
}

/**
 * Seed the tables from the hand-written list, once.
 *
 * Without this the first thing an editor sees is an empty admin beside a
 * travel page that still shows four recommendations, which reads as a bug.
 */
export async function importSeedTravel(): Promise<ActionResult> {
  return guarded('staff', async () => {
    const { STAYS, TIPS } = await import('@/lib/data/content');
    const sb = createServiceClient();

    const { data: existing } = await sb
      .from('stays').select('id').eq('tenant_id', TENANT_ID).limit(1);
    if (existing?.length) {
      return { ok: false, message: 'כבר יש המלצות. הייבוא רק למצב ריק.' };
    }

    const { error: se } = await sb.from('stays').insert(
      STAYS.map((s, i) => ({
        tenant_id: TENANT_ID,
        name: s.name,
        blurb: s.blurb,
        tiers: s.tiers,
        nightly_usd: s.nightlyUsd,
        walk_minutes: s.walkMinutes,
        booking_url: s.bookingUrl,
        is_affiliate: false,
        icon: s.icon,
        sort: i,
      })),
    );
    if (se) return fail(se);

    const { error: te } = await sb.from('tips').insert(
      TIPS.map((t, i) => ({
        tenant_id: TENANT_ID,
        title: t.title,
        body: t.body,
        tags: t.tags,
        icon: t.icon,
        sort: i,
      })),
    );
    if (te) return fail(te);

    return done(`יובאו ${STAYS.length} מקומות ו-${TIPS.length} המלצות.`);
  });
}
