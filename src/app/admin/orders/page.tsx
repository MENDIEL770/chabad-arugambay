import { getActiveOrders, getTodaySummary } from '@/lib/data/orders';
import { OrdersBoard } from '@/components/admin/orders-board';
import { formatLkr } from '@/lib/config';

export const dynamic = 'force-dynamic';
// Orders change constantly; until Realtime is wired the board refreshes itself.
export const revalidate = 0;

export default async function AdminOrdersPage() {
  const [orders, summary] = await Promise.all([getActiveOrders(), getTodaySummary()]);

  return (
    <div className="wrap">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-[-.015em]">הזמנות</h1>
          <p className="mt-1 text-sm text-fg-muted">
            {orders.length > 0
              ? `${orders.length} הזמנות פתוחות.`
              : 'אין כרגע הזמנות פתוחות.'}
          </p>
        </div>

        <dl className="flex gap-6">
          <div>
            <dt className="text-[.75rem] text-fg-subtle">היום</dt>
            <dd className="clock text-[1.3rem] font-bold">{summary.count}</dd>
          </div>
          <div>
            <dt className="text-[.75rem] text-fg-subtle">הכנסות</dt>
            <dd className="money text-[1.3rem] font-bold">{formatLkr(summary.revenueLkr)}</dd>
          </div>
          <div>
            <dt className="text-[.75rem] text-fg-subtle">מזומן לגבות</dt>
            <dd className="money text-[1.3rem] font-bold">{formatLkr(summary.cashOwedLkr)}</dd>
          </div>
        </dl>
      </div>

      <OrdersBoard orders={orders} />
    </div>
  );
}
