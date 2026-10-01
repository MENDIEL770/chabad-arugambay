import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getKitchenOrders } from '@/lib/data/kitchen';
import { getActor } from '@/lib/auth';
import { canAct } from '@/lib/roles';
import { hasSupabase } from '@/lib/config';
import { KitchenBoard } from '@/components/kitchen/kitchen-board';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Kitchen' };

/**
 * The screen on the restaurant computer.
 *
 * English throughout: the people reading it work here and do not read
 * Hebrew. Dark, large type, and big touch targets, because it is read at
 * arm's length with wet hands.
 */
export default async function KitchenPage() {
  if (!hasSupabase()) redirect('/admin');

  const actor = await getActor();
  if (!actor || !canAct(actor.role, 'kitchen')) {
    redirect('/admin/login?next=%2Fkitchen');
  }

  const orders = await getKitchenOrders();
  return <KitchenBoard initial={orders} />;
}
