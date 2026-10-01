'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/server';
import { hasSupabase, TENANT_ID } from '@/lib/config';
import { NotAuthorized, requireRole } from '@/lib/auth';
import type { AppRole } from '@/lib/roles';
import { knownChoices } from '@/lib/data/meal-choices';

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

function done(eventId: string, slug: string | null, message: string): ActionResult {
  revalidatePath('/admin/events');
  revalidatePath(`/admin/events/${eventId}`);
  revalidatePath('/shabbat');
  if (slug) revalidatePath(`/f/${slug}`);
  return { ok: true, message };
}

/**
 * Any hand edit marks the event so the nightly generator leaves it alone.
 *
 * Without this, a price corrected on Tuesday would be silently reset by
 * the cron that keeps forms topped up — the kind of bug that is noticed
 * only when somebody pays the wrong amount.
 */
async function markHandEdited(sb: ReturnType<typeof createServiceClient>, eventId: string) {
  await sb.from('events').update({ hand_edited: true })
    .eq('id', eventId).eq('tenant_id', TENANT_ID);
}

const EventSchema = z.object({
  id: z.string().uuid(),
  titleHe: z.string().trim().min(2, 'צריך כותרת'),
  titleEn: z.string().trim().default(''),
  introHe: z.string().trim().max(600).default(''),
  introEn: z.string().trim().max(600).default(''),
  closesHoursBefore: z.coerce.number().int().min(0).max(336),
  isOpen: z.string().optional(),
  isListed: z.string().optional(),
});

export async function saveEvent(formData: FormData): Promise<ActionResult> {
  return guarded('staff', async () => {
    const parsed = EventSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) {
      return { ok: false, message: parsed.error.issues[0]?.message ?? 'קלט לא תקין' };
    }
    const v = parsed.data;
    const sb = createServiceClient();

    const { data, error } = await sb
      .from('events')
      .update({
        title: { he: v.titleHe, en: v.titleEn || v.titleHe },
        intro: { he: v.introHe, en: v.introEn || v.introHe },
        closes_hours_before: v.closesHoursBefore,
        is_open: v.isOpen === 'on',
        is_listed: v.isListed === 'on',
        hand_edited: true,
      })
      .eq('id', v.id)
      .eq('tenant_id', TENANT_ID)
      .select('slug')
      .single();

    if (error) return { ok: false, message: `השמירה נכשלה: ${error.message}` };
    return done(v.id, data?.slug as string, 'האירוע נשמר.');
  });
}

const MealSchema = z.object({
  id: z.string().uuid(),
  eventId: z.string().uuid(),
  nameHe: z.string().trim().min(1, 'צריך שם לסעודה'),
  nameEn: z.string().trim().default(''),
  servesAt: z.string().trim().default(''),
  capacity: z.string().trim().default(''),
  isOpen: z.string().optional(),
  /** 'inherit' | 'custom'. Anything else is treated as inherit. */
  choiceMode: z.string().trim().default('inherit'),
});

export async function saveMeal(formData: FormData): Promise<ActionResult> {
  return guarded('staff', async () => {
    const parsed = MealSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) {
      return { ok: false, message: parsed.error.issues[0]?.message ?? 'קלט לא תקין' };
    }
    const v = parsed.data;

    const capacity = v.capacity === '' ? null : Number(v.capacity);
    if (capacity !== null && (!Number.isInteger(capacity) || capacity < 1)) {
      return { ok: false, message: 'קיבולת חייבת להיות מספר שלם, או ריק ללא הגבלה.' };
    }

    const sb = createServiceClient();

    // Lowering capacity below what is already booked would make the meal
    // read as over-subscribed with no way to act on it.
    if (capacity !== null) {
      const { data: taken } = await sb.rpc('meal_seats_taken', { p_meal: v.id });
      if (typeof taken === 'number' && taken > capacity) {
        return {
          ok: false,
          message: `כבר נרשמו ${taken} מקומות לסעודה הזו. אי אפשר להוריד את הקיבולת מתחת לזה.`,
        };
      }
    }

    const { error } = await sb
      .from('event_meals')
      .update({
        name: { he: v.nameHe, en: v.nameEn || v.nameHe },
        serves_at: v.servesAt ? new Date(v.servesAt).toISOString() : null,
        capacity,
        is_open: v.isOpen === 'on',
        // Three states, not two. null inherits the template; an array —
        // including an empty one — is this meal's own answer. Collapsing
        // empty into null would turn "do not ask at lunch" back into
        // "ask whatever the template says".
        meal_choices:
          v.choiceMode === 'custom'
            ? knownChoices(formData.getAll('mealChoices').map(String))
            : null,
      })
      .eq('id', v.id)
      .eq('tenant_id', TENANT_ID);

    if (error) return { ok: false, message: `השמירה נכשלה: ${error.message}` };

    await markHandEdited(sb, v.eventId);
    return done(v.eventId, null, 'הסעודה נשמרה.');
  });
}

const TypeSchema = z.object({
  id: z.string().uuid(),
  eventId: z.string().uuid(),
  nameHe: z.string().trim().min(1),
  price: z.coerce.number().min(0).max(100000),
  seats: z.coerce.number().int().min(0).max(10),
});

export async function saveRegistrantType(formData: FormData): Promise<ActionResult> {
  return guarded('staff', async () => {
    const parsed = TypeSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) {
      return { ok: false, message: parsed.error.issues[0]?.message ?? 'קלט לא תקין' };
    }
    const v = parsed.data;
    const sb = createServiceClient();

    const { error } = await sb
      .from('registrant_types')
      .update({ price_ils: v.price, seats: v.seats })
      .eq('id', v.id)
      .eq('tenant_id', TENANT_ID);

    if (error) return { ok: false, message: `השמירה נכשלה: ${error.message}` };

    await markHandEdited(sb, v.eventId);
    // Existing registrations keep the price they were charged: the amount
    // is copied onto the line, not read back from here.
    return done(v.eventId, null, 'המחיר עודכן. הרשמות קיימות לא משתנות.');
  });
}
