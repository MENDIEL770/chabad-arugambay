import { createServiceClient } from '@/lib/supabase/server';
import { hasSupabase, TENANT_ID } from '@/lib/config';
import type {
  Report, ReportSummary,
} from './reports-view';

export * from './reports-view';

const EMPTY: ReportSummary = {
  orders: 0, revenueLkr: 0, avgOrderLkr: 0, itemsSold: 0,
  deliveryLkr: 0, cancelled: 0, unpaidLkr: 0,
};

function missing(msg: string): boolean {
  return /report_|schema cache|does not exist/i.test(msg);
}

export async function getReport(from: string, to: string): Promise<Report> {
  const blank: Report = {
    from, to, summary: EMPTY, byDay: [], byDish: [], splits: [], byHour: [],
    unavailable: false,
  };

  if (!hasSupabase()) return blank;

  const sb = createServiceClient();
  const args = { p_tenant: TENANT_ID, p_from: from, p_to: to };

  const [sum, days, dishes, splits, hours] = await Promise.all([
    sb.rpc('report_summary', args),
    sb.rpc('report_by_day', args),
    sb.rpc('report_by_dish', args),
    sb.rpc('report_by_split', args),
    sb.rpc('report_by_hour', args),
  ]);

  if (sum.error) {
    if (missing(sum.error.message)) return { ...blank, unavailable: true };
    throw new Error(`Could not build the report: ${sum.error.message}`);
  }

  // report_summary returns a single row as a one-element set.
  const s = (sum.data as Record<string, unknown>[] | null)?.[0];

  return {
    from,
    to,
    unavailable: false,
    summary: s
      ? {
          orders: Number(s.orders ?? 0),
          revenueLkr: Number(s.revenue_lkr ?? 0),
          avgOrderLkr: Number(s.avg_order_lkr ?? 0),
          itemsSold: Number(s.items_sold ?? 0),
          deliveryLkr: Number(s.delivery_lkr ?? 0),
          cancelled: Number(s.cancelled ?? 0),
          unpaidLkr: Number(s.unpaid_lkr ?? 0),
        }
      : EMPTY,
    byDay: ((days.data as Record<string, unknown>[]) ?? []).map((r) => ({
      day: String(r.day),
      orders: Number(r.orders ?? 0),
      revenueLkr: Number(r.revenue_lkr ?? 0),
    })),
    byDish: ((dishes.data as Record<string, unknown>[]) ?? []).map((r) => ({
      dish: String(r.dish ?? '—'),
      qty: Number(r.qty ?? 0),
      revenueLkr: Number(r.revenue_lkr ?? 0),
      orders: Number(r.orders ?? 0),
    })),
    splits: ((splits.data as Record<string, unknown>[]) ?? []).map((r) => ({
      kind: String(r.kind),
      label: String(r.label),
      orders: Number(r.orders ?? 0),
      revenueLkr: Number(r.revenue_lkr ?? 0),
    })),
    byHour: ((hours.data as Record<string, unknown>[]) ?? []).map((r) => ({
      hour: Number(r.hour ?? 0),
      orders: Number(r.orders ?? 0),
      revenueLkr: Number(r.revenue_lkr ?? 0),
    })),
  };
}

