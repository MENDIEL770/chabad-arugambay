import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';
import { hasSupabase, TENANT_ID } from '@/lib/config';
import { greenApi } from './green-api';
import { NullProvider, type WhatsAppProvider } from './provider';
import { messageForStatus, type OrderMessageContext } from './messages';

export { messageForStatus } from './messages';
export type { OrderMessageContext } from './messages';

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
  const body = messageForStatus(status, ctx);
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
