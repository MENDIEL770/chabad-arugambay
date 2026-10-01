'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/server';
import { hasSupabase, TENANT_ID } from '@/lib/config';
import { NotAuthorized, requireRole } from '@/lib/auth';
import type { AppRole } from '@/lib/roles';
import { MESSAGE_BY_EVENT, placeholdersFor, type MessageEvent } from '@/lib/whatsapp/catalogue';
import { unknownTokens } from '@/lib/whatsapp/template';
import { provider, toWaNumberSafe } from '@/lib/whatsapp/admin';

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

function fail(error: { message: string }): ActionResult {
  if (/message_templates|schema cache|does not exist/i.test(error.message)) {
    return { ok: false, message: 'חסרה המיגרציה 0018_messages.sql. הריצו אותה ב-SQL Editor.' };
  }
  return { ok: false, message: error.message };
}

const Schema = z.object({
  event: z.string().min(3),
  body: z.string().max(4000).default(''),
  enabled: z.string().optional(),
  delayMin: z.coerce.number().int().min(0).max(10080).default(0),
});

export async function saveTemplate(formData: FormData): Promise<ActionResult> {
  return guarded('admin', async () => {
    const parsed = Schema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) {
      return { ok: false, message: parsed.error.issues[0]?.message ?? 'קלט לא תקין' };
    }
    const { event, body, enabled, delayMin } = parsed.data;

    const def = MESSAGE_BY_EVENT.get(event as MessageEvent);
    if (!def) return { ok: false, message: 'הודעה לא מוכרת.' };

    // Caught here rather than at send time, when the only evidence would be
    // a customer receiving a sentence with a word missing.
    const allowed = placeholdersFor(def.event).map((p) => p.key);
    const bad = unknownTokens(body, allowed);
    if (bad.length) {
      return {
        ok: false,
        message: `השדות האלה לא קיימים בהודעה הזו: ${bad.map((b) => `{{${b}}}`).join(', ')}`,
      };
    }

    const isOn = enabled === 'on';
    if (isOn && !body.trim()) {
      return { ok: false, message: 'אי אפשר להפעיל הודעה ריקה.' };
    }

    const { error } = await createServiceClient()
      .from('message_templates')
      .upsert(
        {
          tenant_id: TENANT_ID,
          event: def.event,
          channel: 'whatsapp',
          body: { he: body },
          is_enabled: isOn,
          delay_min: delayMin,
        },
        { onConflict: 'tenant_id,event,channel' },
      );

    if (error) return fail(error);

    revalidatePath('/admin/content/messages');
    return { ok: true, message: isOn ? 'נשמר ופעיל.' : 'נשמר. ההודעה כבויה.' };
  });
}

/** Put one message back to the wording that ships with the system. */
export async function resetTemplate(event: string): Promise<ActionResult> {
  return guarded('admin', async () => {
    const def = MESSAGE_BY_EVENT.get(event as MessageEvent);
    if (!def) return { ok: false, message: 'הודעה לא מוכרת.' };

    const { error } = await createServiceClient()
      .from('message_templates')
      .upsert(
        {
          tenant_id: TENANT_ID,
          event: def.event,
          channel: 'whatsapp',
          body: { he: def.defaultBody },
          is_enabled: def.onByDefault,
          delay_min: 0,
        },
        { onConflict: 'tenant_id,event,channel' },
      );

    if (error) return fail(error);
    revalidatePath('/admin/content/messages');
    return { ok: true, message: 'שוחזר הנוסח המקורי.' };
  });
}

/**
 * Send one message to a number the admin types, to prove the connection.
 *
 * Deliberately not "send to the last customer": the first test of a
 * messaging setup should not reach a real customer.
 */
export async function sendTestMessage(formData: FormData): Promise<ActionResult> {
  return guarded('admin', async () => {
    const raw = String(formData.get('phone') ?? '');
    const body = String(formData.get('body') ?? '').trim();

    const wa = toWaNumberSafe(raw);
    if (!wa) return { ok: false, message: 'מספר לא תקין. כולל קידומת מדינה, למשל ‎+972…' };
    if (!body) return { ok: false, message: 'אין טקסט לשלוח.' };

    const p = provider();
    if (!p.isConfigured()) {
      return { ok: false, message: 'WhatsApp עוד לא מחובר. הוסיפו את מפתחות Green API.' };
    }

    const r = await p.sendText(wa, `🧪 הודעת בדיקה\n\n${body}`);
    return r.ok
      ? { ok: true, message: `נשלח אל ${raw}.` }
      : { ok: false, message: `השליחה נכשלה: ${r.error ?? 'סיבה לא ידועה'}` };
  });
}
