'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/server';
import { hasSupabase, TENANT_ID } from '@/lib/config';
import { NotAuthorized, requireRole } from '@/lib/auth';
import { objectExists } from '@/app/admin/upload-actions';
import type { AppRole } from '@/lib/roles';

export interface ActionResult {
  ok: boolean;
  message: string;
}

const NOT_CONFIGURED: ActionResult = {
  ok: false,
  message: 'אין חיבור ל-Supabase.',
};

function db() {
  return createServiceClient();
}

/** Same gate as the menu actions: a Server Action is a public endpoint. */
async function guarded(min: AppRole, run: () => Promise<ActionResult>): Promise<ActionResult> {
  if (!hasSupabase()) return NOT_CONFIGURED;
  try {
    await requireRole(min);
  } catch (e) {
    if (e instanceof NotAuthorized) return { ok: false, message: e.message };
    throw e;
  }
  return run();
}

/** Empty strings from a form mean "no override", not an empty headline. */
function i18nOrNull(he: string, en: string) {
  const h = he.trim();
  const e = en.trim();
  if (!h && !e) return null;
  return { he: h, en: e || h };
}

/**
 * Record a hero image that has already landed in Storage.
 *
 * The bytes come straight from the browser with a one-shot token. A note
 * here used to blame measuring dimensions for a production React #441 and
 * removed that measurement; the diagnosis was wrong. The real cause was the
 * 1MB server-action body limit — a 5MB hero image never reached this
 * function at all. Dimensions are measured in the browser again, because
 * they were never the problem.
 */
export async function commitHeroSlide(formData: FormData): Promise<ActionResult> {
  return guarded('admin', async () => {
    const path = String(formData.get('path') ?? '');
    if (!path.startsWith(`${TENANT_ID}/`)) {
      return { ok: false, message: 'נתיב לא תקין.' };
    }
    if (!(await objectExists('hero', path))) {
      return { ok: false, message: 'הקובץ לא נמצא באחסון. נסו להעלות שוב.' };
    }

    const sb = db();

    // New slides go last so an upload never silently reorders the rotation.
    const { data: last } = await sb
      .from('hero_slides')
      .select('sort')
      .eq('tenant_id', TENANT_ID)
      .order('sort', { ascending: false })
      .limit(1)
      .maybeSingle();

    const { error: rowErr } = await sb.from('hero_slides').insert({
      tenant_id: TENANT_ID,
      image_path: path,
      sort: ((last?.sort as number) ?? 0) + 1,
      width_px: Number(formData.get('width')) || null,
      height_px: Number(formData.get('height')) || null,
      bytes: Number(formData.get('bytes')) || null,
    });

    if (rowErr) {
      await sb.storage.from('hero').remove([path]);
      return { ok: false, message: `שמירת השורה נכשלה: ${rowErr.message}` };
    }

    revalidatePath('/admin/settings/hero');
    revalidatePath('/');
    return { ok: true, message: 'התמונה נוספה.' };
  });
}

const SlideSchema = z.object({
  id: z.string().uuid(),
  headlineHe: z.string().default(''),
  headlineEn: z.string().default(''),
  subheadHe: z.string().default(''),
  subheadEn: z.string().default(''),
  ctaLabelHe: z.string().default(''),
  ctaHref: z.string().default(''),
  focalX: z.coerce.number().int().min(0).max(100),
  focalY: z.coerce.number().int().min(0).max(100),
  overlay: z.coerce.number().int().min(0).max(80),
});

export async function saveHeroSlide(formData: FormData): Promise<ActionResult> {
  return guarded('admin', async () => {
    const parsed = SlideSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) {
      return { ok: false, message: parsed.error.issues[0]?.message ?? 'קלט לא תקין' };
    }
    const v = parsed.data;

    const ctaLabel = i18nOrNull(v.ctaLabelHe, '');
    const href = v.ctaHref.trim();

    // The column pair is constrained both-or-neither, so catch it here with a
    // sentence instead of surfacing a constraint violation.
    if (Boolean(ctaLabel) !== Boolean(href)) {
      return { ok: false, message: 'כפתור צריך גם טקסט וגם קישור, או שניהם ריקים.' };
    }
    if (href && !href.startsWith('/')) {
      return { ok: false, message: 'הקישור צריך להתחיל ב-/ (נתיב באתר).' };
    }

    const { error } = await db()
      .from('hero_slides')
      .update({
        headline: i18nOrNull(v.headlineHe, v.headlineEn),
        subhead: i18nOrNull(v.subheadHe, v.subheadEn),
        cta_label: ctaLabel,
        cta_href: href || null,
        focal_x: v.focalX,
        focal_y: v.focalY,
        overlay: v.overlay,
      })
      .eq('id', v.id)
      .eq('tenant_id', TENANT_ID);

    if (error) return { ok: false, message: `השמירה נכשלה: ${error.message}` };

    revalidatePath('/admin/settings/hero');
    revalidatePath('/');
    return { ok: true, message: 'נשמר.' };
  });
}

export async function toggleHeroSlide(id: string, active: boolean): Promise<ActionResult> {
  return guarded('admin', async () => {
    const { error } = await db()
      .from('hero_slides')
      .update({ is_active: active })
      .eq('id', id)
      .eq('tenant_id', TENANT_ID);
    if (error) return { ok: false, message: error.message };
    revalidatePath('/admin/settings/hero');
    revalidatePath('/');
    return { ok: true, message: active ? 'התמונה מוצגת.' : 'התמונה הוסתרה.' };
  });
}

export async function moveHeroSlide(id: string, direction: -1 | 1): Promise<ActionResult> {
  return guarded('admin', async () => {
    const sb = db();
    const { data: all } = await sb
      .from('hero_slides')
      .select('id, sort')
      .eq('tenant_id', TENANT_ID)
      .order('sort');

    const list = all ?? [];
    const at = list.findIndex((r) => r.id === id);
    const to = at + direction;
    if (at === -1 || to < 0 || to >= list.length) {
      return { ok: false, message: 'אי אפשר להזיז לשם.' };
    }

    // Swap the two sort values rather than renumbering everything.
    const a = list[at];
    const b = list[to];
    await sb.from('hero_slides').update({ sort: b.sort }).eq('id', a.id).eq('tenant_id', TENANT_ID);
    await sb.from('hero_slides').update({ sort: a.sort }).eq('id', b.id).eq('tenant_id', TENANT_ID);

    revalidatePath('/admin/settings/hero');
    revalidatePath('/');
    return { ok: true, message: 'הסדר עודכן.' };
  });
}

export async function deleteHeroSlide(id: string): Promise<ActionResult> {
  return guarded('admin', async () => {
    const sb = db();
    const { data: row } = await sb
      .from('hero_slides')
      .select('image_path')
      .eq('id', id)
      .eq('tenant_id', TENANT_ID)
      .maybeSingle();

    const { error } = await sb
      .from('hero_slides')
      .delete()
      .eq('id', id)
      .eq('tenant_id', TENANT_ID);
    if (error) return { ok: false, message: error.message };

    // Row first, then the file — a failure must not leave a slide pointing
    // at an image that is gone.
    const path = row?.image_path as string | undefined;
    if (path) await sb.storage.from('hero').remove([path]);

    revalidatePath('/admin/settings/hero');
    revalidatePath('/');
    return { ok: true, message: 'התמונה נמחקה.' };
  });
}
