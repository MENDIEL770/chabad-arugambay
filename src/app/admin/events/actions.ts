'use server';

import { revalidatePath } from 'next/cache';
import { hasSupabase } from '@/lib/config';
import { NotAuthorized, requireRole } from '@/lib/auth';
import { generateShabbatEvents } from '@/lib/data/events';

export interface ActionResult {
  ok: boolean;
  message: string;
}

/** Same gate as every other admin module — see src/lib/auth.ts. */
async function guarded(
  min: Parameters<typeof requireRole>[0],
  run: () => Promise<ActionResult>,
): Promise<ActionResult> {
  if (!hasSupabase()) return { ok: false, message: 'אין חיבור ל-Supabase.' };
  try {
    await requireRole(min);
  } catch (e) {
    if (e instanceof NotAuthorized) return { ok: false, message: e.message };
    throw e;
  }
  return run();
}

/**
 * Open the next N shabbatot and chagim for registration.
 *
 * Safe to press repeatedly: generation is keyed by occasion, and an event
 * somebody has edited by hand is never touched.
 */
export async function generateEvents(count = 24): Promise<ActionResult> {
  return guarded('staff', async () => {
  try {
    const r = await generateShabbatEvents(count);
    revalidatePath('/admin/events');
    revalidatePath('/shabbat');

    if (r.created.length === 0) {
      return {
        ok: true,
        message: `אין מה לפתוח — ${r.skipped.length + r.handEdited.length} אירועים כבר קיימים.`,
      };
    }
    return {
      ok: true,
      message:
        `נפתחו ${r.created.length} אירועים חדשים.` +
        (r.handEdited.length ? ` ${r.handEdited.length} שנערכו ידנית נשארו כמו שהם.` : ''),
    };
  } catch (e) {
    const msg = (e as Error).message;
    if (/schema cache|does not exist/i.test(msg)) {
      return { ok: false, message: 'חסרה המיגרציה 0007_events.sql. הריצו אותה ב-SQL Editor.' };
    }
    return { ok: false, message: `נכשל: ${msg}` };
  }
  });
}
