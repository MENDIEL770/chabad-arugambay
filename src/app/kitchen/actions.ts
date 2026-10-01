'use server';

import { getKitchenOrders, type KitchenOrder } from '@/lib/data/kitchen';
import { NotAuthorized, requireRole } from '@/lib/auth';
import { advanceOrder } from '@/app/admin/orders/actions';

/** Poll target for the board. Authorised like everything else. */
export async function refreshKitchen(): Promise<KitchenOrder[]> {
  try {
    await requireRole('kitchen');
  } catch (e) {
    // An expired session returns nothing rather than throwing, so the board
    // shows "reconnecting" instead of a crash on a screen nobody is watching.
    if (e instanceof NotAuthorized) return [];
    throw e;
  }
  return getKitchenOrders();
}

/** Both delegate to advanceOrder, which authorises and checks the state
 *  machine before writing. */
export async function bumpOrder(orderId: string, to: string) {
  await requireRole('kitchen');
  return advanceOrder(orderId, to);
}

export async function acceptOrder(orderId: string, etaMinutes: number) {
  await requireRole('kitchen');
  return advanceOrder(orderId, 'accepted', { etaMinutes });
}
