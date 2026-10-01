/**
 * The parts of the reports a browser may hold.
 *
 * Split from the loader because the report screen is a client
 * component. Importing a label map from the module that also calls
 * createServiceClient drags next/headers into the client bundle and
 * fails the build with an error naming neither file.
 */
import { DateTime } from 'luxon';
import { TENANT } from '@/lib/config';

export interface ReportSummary {
  orders: number;
  revenueLkr: number;
  avgOrderLkr: number;
  itemsSold: number;
  deliveryLkr: number;
  cancelled: number;
  unpaidLkr: number;
}

export interface DayRow { day: string; orders: number; revenueLkr: number }
export interface DishRow { dish: string; qty: number; revenueLkr: number; orders: number }
export interface SplitRow { kind: string; label: string; orders: number; revenueLkr: number }
export interface HourRow { hour: number; orders: number; revenueLkr: number }

export interface Report {
  from: string;
  to: string;
  summary: ReportSummary;
  byDay: DayRow[];
  byDish: DishRow[];
  splits: SplitRow[];
  byHour: HourRow[];
  /** True when the migration has not been run; the page says so plainly. */
  unavailable: boolean;
}

export type Preset = 'today' | 'week' | 'month' | 'quarter' | 'year' | 'custom';

/**
 * Turn a preset into dates in the tenant's own timezone.
 *
 * Doing this with `new Date()` would resolve against the server's clock,
 * which on Vercel is UTC: at 2am in Arugam Bay "today" would already be
 * yesterday. The whole product has had this bug once already.
 */
export function rangeFor(preset: Preset, from?: string, to?: string): { from: string; to: string } {
  const now = DateTime.now().setZone(TENANT.point.timezone);

  switch (preset) {
    case 'today':
      return { from: now.toISODate()!, to: now.toISODate()! };
    case 'week':
      // Sunday to Saturday: the week a Chabad house actually runs on.
      return {
        from: now.minus({ days: (now.weekday % 7) }).toISODate()!,
        to: now.toISODate()!,
      };
    case 'month':
      return { from: now.startOf('month').toISODate()!, to: now.toISODate()! };
    case 'quarter':
      return { from: now.minus({ months: 3 }).toISODate()!, to: now.toISODate()! };
    case 'year':
      return { from: now.startOf('year').toISODate()!, to: now.toISODate()! };
    case 'custom':
      return {
        from: from || now.startOf('month').toISODate()!,
        to: to || now.toISODate()!,
      };
  }
}




export const FULFILLMENT_LABEL: Record<string, string> = {
  delivery: 'משלוח',
  pickup: 'איסוף עצמי',
  dine_in: 'ישיבה במקום',
};

export const PAYMENT_LABEL: Record<string, string> = {
  cash_lkr_at_counter: 'מזומן בדלפק',
  cash_lkr_to_driver: 'מזומן לשליח',
  card_online: 'כרטיס אונליין',
  bank_transfer: 'העברה בנקאית',
};

export const CHANNEL_LABEL: Record<string, string> = {
  web: 'אתר',
  phone: 'טלפון',
  walk_in: 'בדלפק',
  whatsapp: 'וואטסאפ',
};
