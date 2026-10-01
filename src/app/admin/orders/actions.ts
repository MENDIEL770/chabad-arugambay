'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/server';
import { hasSupabase, TENANT_ID } from '@/lib/config';
import { NotAuthorized, requireRole } from '@/lib/auth';
import type { AppRole } from '@/lib/roles';
import { NEXT_STATUS } from '@/lib/order-flow';
import { notifyOrderStatus } from '@/lib/whatsapp';

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

const STATUS = z.enum([
  'received', 'accepted', 'preparing', 'ready',
  'dispatched', 'delivered', 'completed', 'cancelled', 'rejected',
]);
type Status = z.infer<typeof STATUS>;

/**
 * Legal moves are re-checked here, not just hidden in the UI. An order that
 * jumped from 'received' straight to 'delivered' would skip the stock
 * deduction that fires on 'accepted', and the customer would never see that
 * it was being made.
 */
const NEXT = NEXT_STATUS;

export async function advanceOrder(
  orderId: string,
  to: string,
  opts?: { etaMinutes?: number; reason?: string },
): Promise<ActionResult> {
  return guarded('kitchen', async () => {
    const id = z.string().uuid().safeParse(orderId);
    const next = STATUS.safeParse(to);
    if (!id.success || !next.success) return { ok: false, message: 'בקשה לא תקינה.' };

    const sb = db();
    const { data: order } = await sb
      .from('orders')
      .select('status, code, timeline, customer_name, customer_phone, total_lkr, fulfillment, pay_method, track_token')
      .eq('id', orderId)
      .eq('tenant_id', TENANT_ID)
      .maybeSingle();

    if (!order) return { ok: false, message: 'ההזמנה לא נמצאה.' };

    const from = order.status as Status;
    if (!NEXT[from].includes(next.data)) {
      return { ok: false, message: `אי אפשר לעבור מ״${from}״ ל״${next.data}״.` };
    }

    const entry = {
      status: next.data,
      at: new Date().toISOString(),
      ...(opts?.reason ? { reason: opts.reason } : {}),
    };

    const { error } = await sb
      .from('orders')
      .update({
        status: next.data,
        ...(opts?.etaMinutes ? { eta_minutes: opts.etaMinutes } : {}),
        // Append rather than replace: the timeline is the audit trail.
        timeline: [...((order.timeline as unknown[]) ?? []), entry],
        ...(next.data === 'delivered' || next.data === 'completed'
          ? { pay_status: 'cod_collected' as const }
          : {}),
      })
      .eq('id', orderId)
      .eq('tenant_id', TENANT_ID);

    if (error) return { ok: false, message: `העדכון נכשל: ${error.message}` };

    await sb.from('order_events').insert({
      tenant_id: TENANT_ID,
      order_id: orderId,
      type: `status:${next.data}`,
      payload: entry,
      actor: 'admin',
    });

    // Fire-and-forget by design: the status change is already committed and
    // a messaging outage must not undo it or block the board.
    await notifyOrderStatus(orderId, next.data, {
      code: order.code as string,
      customerName: order.customer_name as string,
      phone: order.customer_phone as string,
      totalLkr: (order.total_lkr as number) ?? 0,
      fulfillment: order.fulfillment as 'delivery' | 'pickup' | 'dine_in',
      etaMinutes: opts?.etaMinutes ?? null,
      payToDriver: order.pay_method === 'cash_lkr_to_driver',
      rejectReason: opts?.reason ?? null,
      trackUrl: order.track_token
        ? `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://chabad-arugambay.vercel.app'}/order/${order.track_token}`
        : null,
    });

    revalidatePath('/admin/orders');
    return { ok: true, message: `#${order.code} → ${next.data}` };
  });
}

