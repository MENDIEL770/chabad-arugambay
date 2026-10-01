'use server';

import { getKitchenOrders, type KitchenOrder } from '@/lib/data/kitchen';
import { NotAuthorized, requireRole } from '@/lib/auth';
import { advanceOrder } from '@/app/admin/orders/actions';

/** Poll target for the board. Authorised like everything else. */
export async function refreshKitchen(): Promise<KitchenOrder[]> {
  try {
    await requireRole('kitchen');
  } catch (e) {
    if (e instanceof NotAuthorized) return [];
    throw e;
  }
  return getKitchenOrders();
}

export async function bumpOrder(orderId: string, to: string) {
  return advanceOrder(orderId, to);
}

export async function acceptOrder(orderId: string, etaMinutes: number) {
  return advanceOrder(orderId, 'accepted', { etaMinutes });
}
