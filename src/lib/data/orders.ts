import { createServiceClient } from '@/lib/supabase/server';
import { hasSupabase, TENANT_ID } from '@/lib/config';
import type { OrderStatus } from '@/lib/order-flow';

export interface OrderLine {
  name: string;
  name_en?: string;
  station?: string;
  qty: number;
  unit: number;
  line_total: number;
  modifiers?: { name: string; state: string; is_default: boolean }[];
  note?: string | null;
}

export interface AdminOrder {
  id: string;
  code: string;
  status: OrderStatus;
  channel: string;
  fulfillment: string;
  tableNo: string | null;
  customerName: string;
  customerPhone: string;
  addressText: string | null;
  addressNotes: string | null;
  items: OrderLine[];
  subtotalLkr: number;
  deliveryFeeLkr: number;
  totalLkr: number;
  payMethod: string;
  payStatus: string;
  etaMinutes: number | null;
  createdAt: string;
}

/** Live orders for the board: everything not yet closed out. */
export async function getActiveOrders(): Promise<AdminOrder[]> {
  if (!hasSupabase()) return [];

  const { data, error } = await createServiceClient()
    .from('orders')
    .select('*')
    .eq('tenant_id', TENANT_ID)
    .in('status', ['received', 'accepted', 'preparing', 'ready', 'dispatched'])
    .order('created_at');

  if (error) {
    // The table exists from 0003; a failure here is real and should surface.
    throw new Error(`Could not load orders: ${error.message}`);
  }

  return (data ?? []).map((r) => ({
    id: r.id as string,
    code: r.code as string,
    status: r.status as OrderStatus,
    channel: r.channel as string,
    fulfillment: r.fulfillment as string,
    tableNo: (r.table_no as string | null) ?? null,
    customerName: r.customer_name as string,
    customerPhone: r.customer_phone as string,
    addressText: (r.address_text as string | null) ?? null,
    addressNotes: (r.address_notes as string | null) ?? null,
    items: (r.items ?? []) as OrderLine[],
    subtotalLkr: (r.subtotal_lkr as number) ?? 0,
    deliveryFeeLkr: (r.delivery_fee_lkr as number) ?? 0,
    totalLkr: (r.total_lkr as number) ?? 0,
    payMethod: r.pay_method as string,
    payStatus: r.pay_status as string,
    etaMinutes: (r.eta_minutes as number | null) ?? null,
    createdAt: r.created_at as string,
  }));
}

/** Today's closed orders, for the summary strip. */
export async function getTodaySummary() {
  if (!hasSupabase()) return { count: 0, revenueLkr: 0, cashOwedLkr: 0 };

  const { data } = await createServiceClient()
    .from('orders')
    .select('total_lkr, status, pay_status')
    .eq('tenant_id', TENANT_ID)
    .gte('created_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString());

  const rows = data ?? [];
  const settled = rows.filter((r) => !['cancelled', 'rejected'].includes(r.status as string));

  return {
    count: settled.length,
    revenueLkr: settled.reduce((s, r) => s + ((r.total_lkr as number) ?? 0), 0),
    // Cash the drivers and counter still owe us.
    cashOwedLkr: settled
      .filter((r) => r.pay_status === 'cod_pending')
      .reduce((s, r) => s + ((r.total_lkr as number) ?? 0), 0),
  };
}
