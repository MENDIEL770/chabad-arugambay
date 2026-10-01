import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';
import { formatLkr, hasSupabase, TENANT_ID } from '@/lib/config';
import { greenApi } from './green-api';
import { NullProvider, type WhatsAppProvider } from './provider';
import { type OrderMessageContext } from './messages';
import { eventForOrderStatus } from './catalogue';
import { renderFor } from './templates';

export { messageForStatus } from './messages';
export type { OrderMessageContext } from './messages';
export { getTemplates, renderFor } from './templates';

const HOUSE_NAME = 'בית חב״ד ארוגם ביי';

const FULFILLMENT_LABEL: Record<OrderMessageContext['fulfillment'], string> = {
  delivery: 'משלוח',
  pickup: 'איסוף עצמי',
  dine_in: 'ישיבה במקום',
};

export function provider(): WhatsAppProvider {
  return greenApi.isConfigured() ? greenApi : NullProvider;
}

export function whatsappStatus(): { configured: boolean; provider: string } {
  const p = provider();
  return { configured: p.isConfigured(), provider: p.id };
}

/**
 * Notify a customer about their order, and never let that fail the order.
 *
 * Called from status transitions, which are the thing that must succeed. A
 * provider outage, a logged-out WhatsApp session or a malformed number all
 * end up as a logged row rather than an exception reaching the caller.
 */
export async function notifyOrderStatus(
  orderId: string,
  status: string,
  ctx: OrderMessageContext & { phone: string },
): Promise<void> {
  // The wording comes from the editable template, falling back to the
  // catalogue default. An event with no template — 'preparing',
  // 'completed' — still sends nothing: messaging on every transition
  // trains people to ignore the messages that matter.
  const event = eventForOrderStatus(status);
  if (!event) return;

  const body = await renderFor(event, {
    name: ctx.customerName,
    code: ctx.code,
    total: formatLkr(ctx.totalLkr),
    fulfillment: FULFILLMENT_LABEL[ctx.fulfillment],
    track_url: ctx.trackUrl,
    eta: ctx.etaMinutes,
    driver: ctx.driverName,
    driver_phone: ctx.driverPhone,
    reason: ctx.rejectReason,
    cash_note: ctx.payToDriver ? `לתשלום לנהג במזומן: ${formatLkr(ctx.totalLkr)}` : null,
    house: HOUSE_NAME,
  });
  if (!body) return;

  const p = provider();
  const result = p.isConfigured()
    ? await p.sendText(ctx.phone, body)
    : { ok: false, error: 'not configured' };

  if (!hasSupabase()) return;

  try {
    await createServiceClient().from('order_events').insert({
      tenant_id: TENANT_ID,
      order_id: orderId,
      type: result.ok ? 'whatsapp:sent' : 'whatsapp:failed',
      payload: {
        status,
        provider: p.id,
        messageId: result.id ?? null,
        error: result.error ?? null,
        // Stored so staff can see exactly what the customer received.
        body,
      },
      actor: 'system',
    });
  } catch {
    // Even the audit write must not surface. The order already moved on.
  }
}
