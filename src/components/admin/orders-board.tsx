'use client';

import { useState, useTransition } from 'react';
import { Icon } from '@/components/ui/icon';
import { formatLkr } from '@/lib/config';
import type { AdminOrder } from '@/lib/data/orders';
import {
  BOARD_COLUMNS, FULFILLMENT_LABEL, NEXT_STATUS, STATUS_LABEL,
  type OrderStatus,
} from '@/lib/order-flow';
import { advanceOrder, type ActionResult } from '@/app/admin/orders/actions';

/** Minutes since the order arrived — the number the kitchen actually works to. */
function ageMinutes(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
}

function AgeBadge({ minutes }: { minutes: number }) {
  // Colour by how long it has been waiting, not by status: an order sitting
  // unaccepted for 20 minutes is the problem, whatever column it is in.
  const tone =
    minutes >= 25 ? 'chip-out' : minutes >= 12 ? '!bg-accent !text-fg-on-accent !border-transparent' : '';
  return <span className={`chip ${tone}`}>{minutes} דק׳</span>;
}

function OrderCard({ order, onResult }: { order: AdminOrder; onResult: (r: ActionResult) => void }) {
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const moves = NEXT_STATUS[order.status] ?? [];
  const age = ageMinutes(order.createdAt);

  function move(to: OrderStatus) {
    const eta = to === 'accepted' ? Number(prompt('זמן הכנה משוער בדקות?', '20')) : undefined;
    if (to === 'accepted' && (!eta || eta < 1)) return;
    const reason =
      to === 'rejected' || to === 'cancelled'
        ? prompt('סיבה (תישלח ללקוח):') ?? undefined
        : undefined;
    if ((to === 'rejected' || to === 'cancelled') && !reason) return;
    start(async () => onResult(await advanceOrder(order.id, to, { etaMinutes: eta, reason })));
  }

  return (
    <li className="card !p-3.5">
      <div className="flex items-start gap-2">
        <span className="money text-[1.05rem] font-bold">#{order.code}</span>
        <AgeBadge minutes={age} />
        <span className="chip ms-auto">{FULFILLMENT_LABEL[order.fulfillment] ?? order.fulfillment}</span>
      </div>

      <p className="mt-1.5 truncate text-sm font-medium">{order.customerName}</p>
      <a
        href={`https://wa.me/${order.customerPhone.replace(/[^\d]/g, '')}`}
        target="_blank"
        rel="noopener noreferrer"
        className="ltr inline-flex items-center gap-1.5 text-[.8rem] text-fg-muted hover:text-accent-strong"
      >
        <Icon name="whatsapp" size={13} />
        {order.customerPhone}
      </a>

      <ul className="mt-2.5 flex flex-col gap-1.5 border-t border-line pt-2.5">
        {order.items.map((l, i) => (
          <li key={i} className="text-[.85rem]">
            <div className="flex gap-2">
              <span className="clock shrink-0 text-fg-subtle">{l.qty}×</span>
              <span className="min-w-0 flex-1">{l.name}</span>
            </div>
            {/* Only the exceptions. A cook reading the full build on every
                ticket stops reading, and misses the one that matters. */}
            {l.modifiers && l.modifiers.some((m) => !(m.is_default && m.state === 'in')) && (
              <div className="mt-0.5 flex flex-wrap gap-1 ps-6">
                {l.modifiers
                  .filter((m) => !(m.is_default && m.state === 'in'))
                  .map((m, j) => (
                    <span
                      key={j}
                      className={`chip !py-0 !text-[.66rem] ${m.state === 'out' ? 'chip-out' : ''}`}
                    >
                      {m.state === 'out' ? `בלי ${m.name}` : m.state === 'side' ? `${m.name} בצד` : m.name}
                    </span>
                  ))}
              </div>
            )}
            {l.note && <p className="ps-6 text-[.75rem] text-accent-strong">״{l.note}״</p>}
          </li>
        ))}
      </ul>

      {open && (
        <div className="mt-2.5 border-t border-line pt-2.5 text-[.8rem] text-fg-muted">
          {order.addressText && <p>{order.addressText}</p>}
          {order.addressNotes && <p className="text-fg-subtle">{order.addressNotes}</p>}
          {order.tableNo && <p>שולחן {order.tableNo}</p>}
          <p className="mt-1">
            {order.payStatus === 'cod_pending' ? 'לגבות במזומן: ' : 'שולם: '}
            <b className="money">{formatLkr(order.totalLkr)}</b>
          </p>
        </div>
      )}

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5 border-t border-line pt-2.5">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="chip hover:bg-bg"
          aria-expanded={open}
        >
          {open ? 'פחות' : 'פרטים'}
        </button>
        <span className="money ms-auto text-[.85rem]">{formatLkr(order.totalLkr)}</span>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {moves.map((to) => {
          const destructive = to === 'rejected' || to === 'cancelled';
          return (
            <button
              key={to}
              type="button"
              disabled={pending}
              onClick={() => move(to)}
              className={`btn btn-sm ${destructive ? 'btn-ghost !text-danger' : 'btn-accent'}`}
            >
              {STATUS_LABEL[to]}
            </button>
          );
        })}
      </div>
    </li>
  );
}

export function OrdersBoard({ orders }: { orders: AdminOrder[] }) {
  const [result, setResult] = useState<ActionResult | null>(null);

  return (
    <>
      {result && (
        <p
          role="status"
          className={`mb-4 rounded-input px-3 py-2 text-[.84rem] ${
            result.ok ? 'bg-accent-soft' : 'bg-danger/10 text-danger'
          }`}
        >
          {result.message}
        </p>
      )}

      <div className="grid grid-cols-5 gap-4 max-[1200px]:grid-cols-3 max-[800px]:grid-cols-1">
        {BOARD_COLUMNS.map((col) => {
          const inCol = orders.filter((o) => o.status === col.status);
          return (
            <section key={col.status} className="min-w-0">
              <div className="mb-2.5 flex items-baseline gap-2">
                <h2 className="font-bold">{col.title}</h2>
                <span className="chip">{inCol.length}</span>
              </div>
              {inCol.length === 0 ? (
                <p className="rounded-card border border-dashed border-line px-3 py-6 text-center text-[.8rem] text-fg-subtle">
                  ריק
                </p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {inCol.map((o) => (
                    <OrderCard key={o.id} order={o} onResult={setResult} />
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </>
  );
}
