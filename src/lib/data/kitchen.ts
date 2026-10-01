import { createServiceClient } from '@/lib/supabase/server';
import { hasSupabase, TENANT_ID } from '@/lib/config';

export interface KitchenLine {
  name: string;
  nameEn: string;
  qty: number;
  station: string;
  note: string | null;
  /** Only the differences from the standard build reach the cook. */
  changes: { text: string; kind: 'removal' | 'side' | 'addition' | 'choice' }[];
}

export interface KitchenOrder {
  id: string;
  code: string;
  status: string;
  fulfillment: string;
  tableNo: string | null;
  customerName: string;
  etaMinutes: number | null;
  createdAt: string;
  /** Minutes since the order arrived — drives the colour of the card. */
  ageMinutes: number;
  lines: KitchenLine[];
}

type Row = Record<string, unknown>;

interface RawMod {
  name: string;
  state: 'in' | 'out' | 'side';
  is_default: boolean;
}

/**
 * Turn a stored line into what a cook needs to read.
 *
 * An ingredient that is present and was always going to be present produces
 * nothing. Printing the full build on every ticket is how the one ticket
 * that says "no onion" gets made with onion.
 */
function toChanges(mods: RawMod[] | undefined): KitchenLine['changes'] {
  if (!mods?.length) return [];
  const out: KitchenLine['changes'] = [];
  for (const m of mods) {
    if (m.is_default && m.state === 'in') continue;
    if (m.is_default && m.state === 'out') out.push({ text: `NO ${m.name}`, kind: 'removal' });
    else if (m.state === 'side') out.push({ text: `${m.name} ON SIDE`, kind: 'side' });
    else if (m.state === 'in') out.push({ text: `+ ${m.name}`, kind: 'addition' });
  }
  return out;
}

/** Orders the kitchen still has work to do on. */
export async function getKitchenOrders(): Promise<KitchenOrder[]> {
  if (!hasSupabase()) return [];

  const { data, error } = await createServiceClient()
    .from('orders')
    .select('id, code, status, fulfillment, table_no, customer_name, eta_minutes, items, created_at')
    .eq('tenant_id', TENANT_ID)
    .in('status', ['received', 'accepted', 'preparing', 'ready'])
    .order('created_at');

  if (error) {
    if (/schema cache|does not exist/i.test(error.message)) return [];
    throw new Error(`Could not load kitchen orders: ${error.message}`);
  }

  const now = Date.now();

  return (data ?? []).map((r: Row) => {
    const created = new Date(r.created_at as string).getTime();
    const items = (r.items ?? []) as Row[];
    return {
      id: r.id as string,
      code: r.code as string,
      status: r.status as string,
      fulfillment: r.fulfillment as string,
      tableNo: (r.table_no as string | null) ?? null,
      customerName: r.customer_name as string,
      etaMinutes: (r.eta_minutes as number | null) ?? null,
      createdAt: r.created_at as string,
      ageMinutes: Math.max(0, Math.round((now - created) / 60000)),
      lines: items.map((l) => ({
        name: (l.name as string) ?? '',
        nameEn: (l.name_en as string) ?? (l.name as string) ?? '',
        qty: (l.qty as number) ?? 1,
        station: (l.station as string) ?? 'grill',
        note: (l.note as string | null) ?? null,
        changes: toChanges(l.modifiers as RawMod[] | undefined),
      })),
    };
  });
}
