'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/server';
import { hasSupabase, TENANT_ID } from '@/lib/config';
import { NotAuthorized, requireRole } from '@/lib/auth';
import type { TemplateMeal } from '@/lib/data/event-template';
import { knownChoices } from '@/lib/data/meal-choices';

export interface ActionResult {
  ok: boolean;
  message: string;
}

const TypeSchema = z.object({
  nameHe: z.string().trim().min(1),
  nameEn: z.string().trim().default(''),
  kind: z.enum(['adult', 'child', 'infant', 'donation']),
  price: z.coerce.number().min(0).max(100000),
  seats: z.coerce.number().int().min(0).max(10),
});

const MealSchema = z.object({
  key: z.string().trim().min(1),
  nameHe: z.string().trim().min(1, 'צריך שם לסעודה'),
  nameEn: z.string().trim().default(''),
  servesOffsetMin: z.coerce.number().int().min(-720).max(4320),
  capacity: z.union([z.coerce.number().int().min(1).max(2000), z.literal('')]).optional(),
  types: z.array(TypeSchema).min(1, 'צריך לפחות סוג נרשם אחד'),
});

const TemplateSchema = z.object({
  introHe: z.string().trim().max(600).default(''),
  introEn: z.string().trim().max(600).default(''),
  meals: z.array(MealSchema).max(12),
  askEmail: z.boolean(),
  askNationality: z.boolean(),
  askNotes: z.boolean(),
  askParticipants: z.boolean(),
  donationAmounts: z.array(z.coerce.number().int().min(0).max(100000)).max(8),
  mealChoices: z.array(z.string()).max(8),
  weeksAhead: z.coerce.number().int().min(1).max(104),
  closesHoursBefore: z.coerce.number().int().min(0).max(336),
});

export type TemplateInput = z.input<typeof TemplateSchema>;

/**
 * Save the defaults every newly generated form starts from.
 *
 * Deliberately does NOT touch events that already exist. Rewriting live
 * forms from a template change would alter prices under people who have
 * already registered; the generator applies the new template to the next
 * batch instead.
 */
export async function saveEventTemplate(input: TemplateInput): Promise<ActionResult> {
  try {
    await requireRole('staff');
  } catch (e) {
    if (e instanceof NotAuthorized) return { ok: false, message: e.message };
    throw e;
  }
  if (!hasSupabase()) return { ok: false, message: 'אין חיבור ל-Supabase.' };

  const parsed = TemplateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? 'קלט לא תקין' };
  }
  const v = parsed.data;

  const keys = v.meals.map((m) => m.key);
  if (new Set(keys).size !== keys.length) {
    return { ok: false, message: 'שתי סעודות עם אותו מזהה.' };
  }

  const meals: TemplateMeal[] = v.meals.map((m, i) => ({
    key: m.key,
    name: { he: m.nameHe, en: m.nameEn || m.nameHe },
    sort: i + 1,
    servesOffsetMin: m.servesOffsetMin,
    capacity: m.capacity === '' || m.capacity === undefined ? null : m.capacity,
    types: m.types.map((t) => ({
      name: { he: t.nameHe, en: t.nameEn || t.nameHe },
      kind: t.kind,
      price: t.price,
      seats: t.seats,
    })),
  }));

  const { error } = await createServiceClient()
    .from('event_template')
    .upsert(
      {
        tenant_id: TENANT_ID,
        intro: { he: v.introHe, en: v.introEn || v.introHe },
        meals,
        ask_email: v.askEmail,
        ask_nationality: v.askNationality,
        ask_notes: v.askNotes,
        ask_participants: v.askParticipants,
        donation_amounts: v.donationAmounts,
        // Filtered against the catalogue so a key nothing understands
        // cannot reach a form as an unlabelled radio button.
        meal_choices: knownChoices(v.mealChoices),
        weeks_ahead: v.weeksAhead,
        closes_hours_before: v.closesHoursBefore,
      },
      { onConflict: 'tenant_id' },
    );

  if (error) {
    if (/schema cache|does not exist/i.test(error.message)) {
      return { ok: false, message: 'חסרה המיגרציה 0017_event_template.sql.' };
    }
    return { ok: false, message: `השמירה נכשלה: ${error.message}` };
  }

  revalidatePath('/admin/events');
  return {
    ok: true,
    message: 'נשמר. ההגדרות יחולו על הטפסים הבאים שייווצרו, לא על קיימים.',
  };
}
