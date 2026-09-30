'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/server';
import { hasSupabase, TENANT_ID } from '@/lib/config';
import { NotAuthorized, requireRole } from '@/lib/auth';
import type { AppRole } from '@/lib/roles';
import { HERO_IMAGE_SPEC } from '@/lib/data/hero-spec';

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

export async function uploadHeroSlide(formData: FormData): Promise<ActionResult> {
  return guarded('admin', async () => {
    const file = formData.get('image');
    if (!(file instanceof File) || file.size === 0) {
      return { ok: false, message: 'לא נבחרה תמונה.' };
    }
    if (file.size > HERO_IMAGE_SPEC.maxBytes) {
      const mb = (HERO_IMAGE_SPEC.maxBytes / 1024 / 1024).toFixed(0);
      return { ok: false, message: `התמונה גדולה מ-${mb}MB. כדאי לדחוס אותה.` };
    }
    if (!(HERO_IMAGE_SPEC.formats as readonly string[]).includes(file.type)) {
      return { ok: false, message: `פורמט לא נתמך. ${HERO_IMAGE_SPEC.formatLabel}.` };
    }

    /**
     * Dimensions used to be measured in the browser and posted along. That
     * needed a promise created outside an event handler, and the admin page
     * was failing in production with React #441 — which is exactly what
     * that produces. The width guidance is now advisory text next to the
     * field instead; an undersized hero looks soft, it does not break.
     */
    const width = Number(formData.get('width')) || null;
    const height = Number(formData.get('height')) || null;

    const sb = db();
    const ext = file.type.split('/')[1].replace('jpeg', 'jpg');
    const key = `${TENANT_ID}/${Date.now()}.${ext}`;

    const { error: upErr } = await sb.storage
      .from('hero')
      .upload(key, file, { contentType: file.type, upsert: false });
    if (upErr) return { ok: false, message: `ההעלאה נכשלה: ${upErr.message}` };

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
      image_path: key,
      sort: ((last?.sort as number) ?? 0) + 1,
      width_px: width,
      height_px: height,
      bytes: file.size,
    });

    if (rowErr) {
      await sb.storage.from('hero').remove([key]);
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
