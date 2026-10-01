'use server';

import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/server';
import { hasSupabase, TENANT_ID } from '@/lib/config';
import { throttle, REGISTRATION_LIMIT } from '@/lib/rate-limit';

/**
 * PUBLIC ACTION — intentionally not behind requireRole().
 *
 * Registering is done by a guest. What stands in for authorisation:
 *   - Prices are never taken from the client. place_registration() rebuilds
 *     every line from registrant_types.
 *   - Capacity is re-checked inside the writing transaction, with the meal
 *     rows locked, so two people cannot take the same last seat.
 *   - A per-phone cap stops one guest booking the same event repeatedly.
 *   - A throttle keyed on the caller as well as the phone, in a fixed
 *     window, stops the form being scripted — the cap alone could not,
 *     since a different number sidesteps it.
 */

const MAX_OPEN_PER_PHONE = 4;

export interface RegisterResult {
  ok: boolean;
  message: string;
  code?: string;
  trackToken?: string;
}

const PhoneSchema = z
  .string()
  .trim()
  .regex(/^\+[1-9]\d{7,14}$/, 'מספר טלפון עם קידומת מדינה, למשל ‎+972501234567');

const RegisterSchema = z.object({
  eventId: z.string().uuid(),
  name: z.string().trim().min(2, 'צריך שם מלא').max(80),
  email: z.string().trim().email('כתובת מייל לא תקינה').max(120).optional().or(z.literal('')),
  phone: PhoneSchema,
  nationality: z.string().trim().max(60).optional(),
  notes: z.string().trim().max(500).optional(),
  donation: z.number().min(0).max(100000).default(0),
  lines: z
    .array(z.object({ typeId: z.string().uuid(), qty: z.number().int().min(1).max(20) }))
    .min(1, 'צריך לבחור לפחות סעודה אחת')
    .max(30),
  participants: z
    .array(
      z.object({
        mealId: z.string().uuid().optional(),
        fullName: z.string().trim().min(1).max(80),
        isChild: z.boolean().default(false),
        mealChoice: z.string().trim().max(60).optional(),
      }),
    )
    .max(60)
    .default([]),
});

export type RegisterInput = z.input<typeof RegisterSchema>;

function explain(raw: string): string {
  if (raw.includes('FULL:')) {
    const meal = raw.split('FULL:')[1]?.split('\n')[0]?.trim();
    return meal
      ? `${meal} התמלאה בזמן שמילאתם את הטופס. נסו כמות קטנה יותר, או כתבו לנו.`
      : 'הסעודה התמלאה בזמן שמילאתם את הטופס.';
  }
  if (raw.includes('MEAL_CLOSED:')) {
    const meal = raw.split('MEAL_CLOSED:')[1]?.split('\n')[0]?.trim();
    return `ההרשמה ל${meal ?? 'סעודה'} נסגרה.`;
  }
  if (raw.includes('CLOSED')) return 'ההרשמה לאירוע הזה נסגרה.';
  if (raw.includes('NOTHING_SELECTED')) return 'לא נבחרה אף סעודה.';
  if (raw.includes('TOO_MANY')) return 'כמות גדולה מדי להרשמה אחת. כתבו לנו ונסדר.';
  if (raw.includes('UNKNOWN_EVENT')) return 'האירוע כבר לא קיים.';
  if (/place_registration|schema cache|does not exist/i.test(raw)) {
    console.error('[register] place_registration missing — run 0007_events.sql');
    return 'ההרשמה עדיין לא פעילה. שלחו לנו בוואטסאפ ונרשום אתכם.';
  }
  return 'משהו השתבש. נסו שוב, או שלחו לנו בוואטסאפ.';
}

export async function register(input: RegisterInput): Promise<RegisterResult> {
  if (!hasSupabase()) {
    return { ok: false, message: 'ההרשמה עדיין לא מחוברת. שלחו לנו בוואטסאפ.' };
  }

  const parsed = RegisterSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? 'קלט לא תקין' };
  }
  const v = parsed.data;
  const sb = createServiceClient();

  const { count } = await sb
    .from('registrations')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', TENANT_ID)
    .eq('event_id', v.eventId)
    .eq('phone', v.phone)
    .in('state', ['pending', 'confirmed']);

  // Keyed on the caller as well as the phone: the open-registration cap
  // below resets as events pass, and a different phone number sidesteps it.
  const limited = await throttle(REGISTRATION_LIMIT, v.phone);
  if (limited) return { ok: false, message: limited };

  if ((count ?? 0) >= MAX_OPEN_PER_PHONE) {
    return {
      ok: false,
      message: 'כבר נרשמתם לאירוע הזה. לשינוי — כתבו לנו בוואטסאפ.',
    };
  }

  const { data, error } = await sb.rpc('place_registration', {
    p_tenant: TENANT_ID,
    p_event: v.eventId,
    p_name: v.name,
    p_email: v.email || null,
    p_phone: v.phone,
    p_nationality: v.nationality ?? null,
    p_notes: v.notes ?? null,
    p_lines: v.lines.map((l) => ({ type_id: l.typeId, qty: l.qty })),
    p_participants: v.participants.map((p) => ({
      meal_id: p.mealId ?? null,
      full_name: p.fullName,
      is_child: p.isChild,
      meal_choice: p.mealChoice ?? null,
    })),
    p_donation: v.donation,
  });

  if (error) return { ok: false, message: explain(error.message) };

  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.track_token) return { ok: false, message: 'ההרשמה לא נשמרה. נסו שוב.' };

  return {
    ok: true,
    message: 'נרשמתם.',
    code: row.registration_code as string,
    trackToken: row.track_token as string,
  };
}
