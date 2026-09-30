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
  return { ok: true, message };
}

const KIND = z.enum(['includes', 'single', 'multi']);

const GroupSchema = z.object({
  itemId: z.string().uuid(),
  nameHe: z.string().trim().min(1, 'צריך שם לקבוצה'),
  nameEn: z.string().trim().default(''),
  kind: KIND,
  minSelect: z.coerce.number().int().min(0).max(20),
  maxSelect: z.coerce.number().int().min(0).max(99),
});

export async function addModifierGroup(formData: FormData): Promise<ActionResult> {
  return guarded('staff', async () => {
    const parsed = GroupSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) {
      return { ok: false, message: parsed.error.issues[0]?.message ?? 'קלט לא תקין' };
    }
    const v = parsed.data;
    if (v.maxSelect < v.minSelect) {
      return { ok: false, message: 'המקסימום חייב להיות לפחות כמו המינימום.' };
    }

    const sb = db();
    const { data: last } = await sb
      .from('item_modifier_groups')
      .select('sort')
      .eq('item_id', v.itemId)
      .order('sort', { ascending: false })
      .limit(1)
      .maybeSingle();

    const { error } = await sb.from('item_modifier_groups').insert({
      tenant_id: TENANT_ID,
      item_id: v.itemId,
      name: { he: v.nameHe, en: v.nameEn || v.nameHe },
      kind: v.kind,
      min_select: v.minSelect,
      max_select: v.maxSelect,
      sort: ((last?.sort as number) ?? 0) + 1,
    });

    if (error) return { ok: false, message: `ההוספה נכשלה: ${error.message}` };
    return done('הקבוצה נוספה.');
  });
}

export async function deleteModifierGroup(groupId: string): Promise<ActionResult> {
  return guarded('staff', async () => {
    // Options go with it through the cascade; orders keep their snapshot, so
    // removing a group never rewrites what somebody already ordered.
    const { error } = await db()
      .from('item_modifier_groups')
      .delete()
      .eq('id', groupId)
      .eq('tenant_id', TENANT_ID);
    if (error) return { ok: false, message: error.message };
    return done('הקבוצה נמחקה.');
  });
}

const OptionSchema = z.object({
  groupId: z.string().uuid(),
  nameHe: z.string().trim().min(1, 'צריך שם לאפשרות'),
  nameEn: z.string().trim().default(''),
  priceDeltaLkr: z.coerce.number().int().min(0).max(1_000_000),
  isDefault: z.union([z.literal('on'), z.literal('')]).optional(),
  allowSide: z.union([z.literal('on'), z.literal('')]).optional(),
});

export async function addModifierOption(formData: FormData): Promise<ActionResult> {
  return guarded('staff', async () => {
    const parsed = OptionSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) {
      return { ok: false, message: parsed.error.issues[0]?.message ?? 'קלט לא תקין' };
    }
    const v = parsed.data;

    const sb = db();
    const { data: last } = await sb
      .from('item_modifier_options')
      .select('sort')
      .eq('group_id', v.groupId)
      .order('sort', { ascending: false })
      .limit(1)
      .maybeSingle();

    const { error } = await sb.from('item_modifier_options').insert({
      tenant_id: TENANT_ID,
      group_id: v.groupId,
      name: { he: v.nameHe, en: v.nameEn || v.nameHe },
      price_delta_lkr: v.priceDeltaLkr,
      is_default: v.isDefault === 'on',
      allow_side: v.allowSide === 'on',
      sort: ((last?.sort as number) ?? 0) + 1,
    });

    if (error) return { ok: false, message: `ההוספה נכשלה: ${error.message}` };
    return done('האפשרות נוספה.');
  });
}

export async function updateModifierOption(
  optionId: string,
  patch: { isDefault?: boolean; allowSide?: boolean; isAvailable?: boolean; priceDeltaLkr?: number },
): Promise<ActionResult> {
  return guarded('kitchen', async () => {
    const fields: Record<string, unknown> = {};
    if (patch.isDefault !== undefined) fields.is_default = patch.isDefault;
    if (patch.allowSide !== undefined) fields.allow_side = patch.allowSide;
    if (patch.isAvailable !== undefined) fields.is_available = patch.isAvailable;
    if (patch.priceDeltaLkr !== undefined) {
      if (!Number.isInteger(patch.priceDeltaLkr) || patch.priceDeltaLkr < 0) {
        return { ok: false, message: 'מחיר לא תקין.' };
      }
      fields.price_delta_lkr = patch.priceDeltaLkr;
    }
    if (Object.keys(fields).length === 0) return { ok: true, message: '' };

    const { error } = await db()
      .from('item_modifier_options')
      .update(fields)
      .eq('id', optionId)
      .eq('tenant_id', TENANT_ID);

    if (error) return { ok: false, message: error.message };
    return done('עודכן.');
  });
}

export async function deleteModifierOption(optionId: string): Promise<ActionResult> {
  return guarded('staff', async () => {
    const { error } = await db()
      .from('item_modifier_options')
      .delete()
      .eq('id', optionId)
      .eq('tenant_id', TENANT_ID);
    if (error) return { ok: false, message: error.message };
    return done('האפשרות נמחקה.');
  });
}

/**
 * The salad-and-sauces group in one click.
 *
 * Every pita and laffa on the menu has the same eight removable ingredients,
 * and typing them out per dish is the kind of chore that ends with half the
 * menu missing them. Skips anything the dish already has.
 */
export async function addStandardSaladGroup(itemId: string): Promise<ActionResult> {
  return guarded('staff', async () => {
    const INSIDE = [
      ['צ׳יפס', 'Chips'], ['חומוס', 'Hummus'], ['טחינה', 'Tahini'],
      ['חריף', 'Spicy'], ['עגבניה', 'Tomato'], ['מלפפון', 'Cucumber'],
      ['בצל', 'Onion'], ['חמוצים', 'Pickles'],
    ];

    const sb = db();
    const { data: exists } = await sb
      .from('item_modifier_groups')
      .select('id')
      .eq('item_id', itemId)
      .eq('kind', 'includes')
      .maybeSingle();

    if (exists) return { ok: false, message: 'כבר יש למנה הזו קבוצת ״מה בפנים״.' };

    const { data: group, error: gErr } = await sb
      .from('item_modifier_groups')
      .insert({
        tenant_id: TENANT_ID,
        item_id: itemId,
        name: { he: 'מה בפנים', en: 'What is inside' },
        kind: 'includes',
        min_select: 0,
        max_select: 99,
        sort: 2,
      })
      .select('id')
      .single();

    if (gErr || !group) return { ok: false, message: `נכשל: ${gErr?.message}` };

    const { error: oErr } = await sb.from('item_modifier_options').insert(
      INSIDE.map(([he, en], i) => ({
        tenant_id: TENANT_ID,
        group_id: group.id,
        name: { he, en },
        price_delta_lkr: 0,
        is_default: true,
        allow_side: true,
        sort: i + 1,
      })),
    );

    if (oErr) return { ok: false, message: `נכשל: ${oErr.message}` };
    return done('נוספו 8 רכיבים שאפשר להוריד או לבקש בצד.');
  });
}
