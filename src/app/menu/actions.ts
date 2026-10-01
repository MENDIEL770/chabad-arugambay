'use server';

import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/server';
import { hasSupabase, TENANT_ID } from '@/lib/config';
import { throttle, ORDER_LIMIT } from '@/lib/rate-limit';

/**
 * PUBLIC ACTION — intentionally not behind requireRole().
 *
 * A customer placing an order is not signed in, so there is nobody to
 * authorise. Everything that would normally be protected by a role is
 * protected differently here:
 *
 *   - Prices are never taken from the client. place_order() rebuilds every
 *     line from menu_items, so a forged total is simply ignored.
 *   - Sellability is re-checked inside the same transaction that writes the
 *     order, closing the gap between browsing and paying.
 *   - Modifier options are verified to belong to the dish they were sent with.
 *   - A per-phone rate limit keeps the endpoint from being used to fill the
 *     kitchen board with junk.
 */

const DELIVERY_FEE_LKR = 500;
const MAX_OPEN_ORDERS_PER_PHONE = 5;

export interface PlaceOrderResult {
  ok: boolean;
  message: string;
  code?: string;
  trackToken?: string;
}

const LineSchema = z.object({
  itemId: z.string().uuid(),
  qty: z.number().int().min(1).max(50),
  modifiers: z
    .array(
      z.object({
        id: z.string().uuid(),
        state: z.enum(['in', 'out', 'side']),
      }),
    )
    .max(40)
    .default([]),
  note: z.string().trim().max(200).optional(),
});

/**
 * E.164-ish. Sri Lankan and Israeli numbers both arrive here, and the
 * WhatsApp integration needs something it can dial, so a local 0-prefixed
 * number is rejected rather than silently stored.
 */
const PhoneSchema = z
  .string()
  .trim()
  .regex(/^\+[1-9]\d{7,14}$/, 'מספר טלפון צריך להתחיל ב-+ ובקידומת מדינה, למשל ‎+94771234567');

const OrderSchema = z
  .object({
    fulfillment: z.enum(['delivery', 'pickup', 'dine_in']),
    name: z.string().trim().min(2, 'צריך שם').max(80),
    phone: PhoneSchema,
    address: z.string().trim().max(300).optional(),
    addressNotes: z.string().trim().max(300).optional(),
    tableNo: z.string().trim().max(20).optional(),
    /** Dropped pin. Worth more than the address line here. */
    lat: z.number().min(-90).max(90).optional(),
    lng: z.number().min(-180).max(180).optional(),
    payMethod: z.enum(['cash_lkr_to_driver', 'cash_lkr_at_counter']),
    lines: z.array(LineSchema).min(1, 'העגלה ריקה').max(60),
  })
  .superRefine((v, ctx) => {
    if (v.fulfillment === 'delivery' && !v.address) {
      ctx.addIssue({ code: 'custom', path: ['address'], message: 'למשלוח צריך כתובת' });
    }
    if (v.fulfillment === 'dine_in' && !v.tableNo) {
      ctx.addIssue({ code: 'custom', path: ['tableNo'], message: 'צריך מספר שולחן' });
    }
    // Paying the driver only makes sense when a driver is involved.
    if (v.fulfillment !== 'delivery' && v.payMethod === 'cash_lkr_to_driver') {
      ctx.addIssue({ code: 'custom', path: ['payMethod'], message: 'אמצעי תשלום לא מתאים לאיסוף' });
    }
  });

export type OrderInput = z.input<typeof OrderSchema>;

/** Map a Postgres exception from place_order to something a person can act on. */
function explain(raw: string): string {
  if (raw.startsWith('SOLD_OUT:') || raw.includes('SOLD_OUT:')) {
    const dish = raw.split('SOLD_OUT:')[1]?.split('\n')[0]?.trim();
    return dish
      ? `${dish} אזל בזמן שמילאתם את העגלה. הסירו אותו ונסו שוב.`
      : 'אחת המנות אזלה בזמן שמילאתם את העגלה.';
  }
  if (raw.includes('EMPTY_CART')) return 'העגלה ריקה.';
  if (raw.includes('UNKNOWN_ITEM')) return 'אחת המנות כבר לא קיימת בתפריט.';
  if (raw.includes('UNKNOWN_MODIFIER')) return 'אחת התוספות כבר לא קיימת.';
  if (raw.includes('MODIFIER_UNAVAILABLE')) return 'אחת התוספות אזלה.';
  if (raw.includes('QTY_TOO_LARGE')) return 'כמות גדולה מדי למנה אחת.';
  return 'משהו השתבש בשליחת ההזמנה. נסו שוב, או שלחו לנו בוואטסאפ.';
}

export async function placeOrder(input: OrderInput): Promise<PlaceOrderResult> {
  if (!hasSupabase()) {
    return { ok: false, message: 'ההזמנות עדיין לא מחוברות. שלחו לנו בוואטסאפ.' };
  }

  const parsed = OrderSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? 'קלט לא תקין' };
  }
  const v = parsed.data;

  const sb = createServiceClient();

  // Cheap abuse guard. Not a substitute for a real rate limiter, but it stops
  // the obvious case of one browser flooding the kitchen board.
  const { count } = await sb
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', TENANT_ID)
    .eq('customer_phone', v.phone)
    .in('status', ['received', 'accepted', 'preparing', 'ready', 'dispatched']);

  // Counted per device as well as per phone, in a fixed time window. The
  // open-order cap below is a different rule — it stops one customer
  // queueing ten meals — and neither covers the other.
  const limited = await throttle(ORDER_LIMIT, v.phone);
  if (limited) return { ok: false, message: limited };

  if ((count ?? 0) >= MAX_OPEN_ORDERS_PER_PHONE) {
    return {
      ok: false,
      message: 'יש לכם כבר כמה הזמנות פתוחות. חכו שהן יגיעו, או התקשרו אלינו.',
    };
  }

  const { data, error } = await sb.rpc('place_order', {
    p_tenant: TENANT_ID,
    p_channel: 'web',
    p_fulfillment: v.fulfillment,
    p_name: v.name,
    p_phone: v.phone,
    p_lang: 'he',
    p_address: v.address ?? null,
    p_address_notes: v.addressNotes ?? null,
    p_table_no: v.tableNo ?? null,
    p_pay_method: v.payMethod,
    p_lines: v.lines.map((l) => ({
      item_id: l.itemId,
      qty: l.qty,
      modifiers: l.modifiers,
      note: l.note ?? null,
    })),
    p_lat: v.lat ?? null,
    p_lng: v.lng ?? null,
    p_delivery_fee: v.fulfillment === 'delivery' ? DELIVERY_FEE_LKR : 0,
  });

  if (error) {
    /**
     * Between deploying this code and running 0006_order_tracking.sql the
     * function does not exist. Say so plainly instead of showing a customer
     * a Postgres error about a missing routine.
     */
    if (/place_order|schema cache|does not exist/i.test(error.message)) {
      console.error('[order] place_order missing — run supabase/migrations/0006_order_tracking.sql');
      return {
        ok: false,
        message: 'ההזמנות עדיין לא פעילות. שלחו לנו בוואטסאפ ונסדר את זה מיד.',
      };
    }
    return { ok: false, message: explain(error.message) };
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.track_token) {
    return { ok: false, message: 'ההזמנה לא נשמרה. נסו שוב.' };
  }

  return {
    ok: true,
    message: 'ההזמנה התקבלה.',
    code: row.order_code as string,
    trackToken: row.track_token as string,
  };
}
