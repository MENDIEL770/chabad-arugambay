import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { createServiceClient } from '@/lib/supabase/server';
import { hasSupabase, formatLkr, TENANT } from '@/lib/config';
import { Icon } from '@/components/ui/icon';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'מעקב הזמנה' };

const STEPS = [
  { key: 'received', label: 'התקבלה' },
  { key: 'accepted', label: 'אושרה' },
  { key: 'preparing', label: 'במטבח' },
  { key: 'ready', label: 'מוכנה' },
  { key: 'dispatched', label: 'בדרך' },
  { key: 'delivered', label: 'נמסרה' },
] as const;

interface Line {
  name: string;
  qty: number;
  line_total: number;
  modifiers?: { name: string; state: string; is_default: boolean }[];
  note?: string | null;
}

/** Only what the customer needs; the rest never leaves the database. */
interface Tracking {
  code: string;
  status: string;
  fulfillment: string;
  eta_minutes: number | null;
  items: Line[];
  total_lkr: number;
  pay_method: string;
  pay_status: string;
  created_at: string;
}

export default async function OrderPage({ params }: PageProps<'/order/[token]'>) {
  const { token } = await params; // Next 16: params is a Promise
  if (!hasSupabase()) notFound();

  // Read through the security-definer function, which returns a fixed set of
  // columns. Even a leaked link cannot expose the address or phone number.
  const { data, error } = await createServiceClient().rpc('order_tracking', {
    p_token: token,
  });

  const order = (Array.isArray(data) ? data[0] : data) as Tracking | undefined;
  if (error || !order) notFound();

  const cancelled = order.status === 'cancelled' || order.status === 'rejected';
  const doneAt = STEPS.findIndex((s) => s.key === order.status);
  // Pickup and dine-in never reach "on the way".
  const steps = order.fulfillment === 'delivery' ? STEPS : STEPS.filter((s) => s.key !== 'dispatched');

  const wa = `https://wa.me/${TENANT.whatsapp.replace(/[^\d]/g, '')}`;

  return (
    <main className="wrap flex-1 py-12">
      <div className="mx-auto max-w-[560px]">
        <p className="eyebrow">הזמנה</p>
        <h1 className="mt-2 flex items-baseline gap-3 text-[clamp(1.8rem,4vw,2.4rem)] font-bold tracking-[-.02em]">
          <span className="money">#{order.code}</span>
        </h1>

        {cancelled ? (
          <div className="card mt-6 border-danger/40">
            <p className="font-medium text-danger">ההזמנה בוטלה.</p>
            <p className="mt-1.5 text-sm text-fg-muted">
              אם זו טעות — כתבו לנו ונסדר את זה.
            </p>
            <a href={wa} target="_blank" rel="noopener noreferrer" className="btn btn-accent btn-sm mt-3">
              <Icon name="whatsapp" size={16} />
              וואטסאפ
            </a>
          </div>
        ) : (
          <ol className="mt-7 flex flex-col gap-0">
            {steps.map((s, i) => {
              const index = STEPS.findIndex((x) => x.key === s.key);
              const done = doneAt >= index;
              const current = order.status === s.key;
              return (
                <li key={s.key} className="flex gap-3.5">
                  <div className="flex flex-col items-center">
                    <span
                      className={`grid size-6 place-items-center rounded-full border-2 text-[.7rem] ${
                        done
                          ? 'border-accent bg-accent text-fg-on-accent'
                          : 'border-line-strong text-fg-subtle'
                      }`}
                    >
                      {done ? '✓' : i + 1}
                    </span>
                    {i < steps.length - 1 && (
                      <span className={`w-0.5 flex-1 ${done ? 'bg-accent' : 'bg-line'}`} />
                    )}
                  </div>
                  <div className={`pb-6 ${current ? '' : 'opacity-70'}`}>
                    <p className={current ? 'font-bold' : 'font-medium'}>{s.label}</p>
                    {current && order.eta_minutes && (
                      <p className="mt-0.5 text-[.85rem] text-fg-muted">
                        בערך <span className="money">{order.eta_minutes}</span> דקות
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}

        <div className="card mt-2">
          <h2 className="mb-3 font-bold">מה הזמנתם</h2>
          <ul className="flex flex-col gap-2.5">
            {order.items.map((l, i) => (
              <li key={i} className="flex flex-col gap-1">
                <div className="flex items-baseline gap-2 text-sm">
                  <span className="clock text-fg-subtle">{l.qty}×</span>
                  <span className="min-w-0 flex-1">{l.name}</span>
                  <span className="money text-[.85rem]">{formatLkr(l.line_total)}</span>
                </div>
                {l.modifiers && l.modifiers.length > 0 && (
                  <ul className="flex flex-wrap gap-1">
                    {l.modifiers
                      .filter((m) => !(m.is_default && m.state === 'in'))
                      .map((m, j) => (
                        <li key={j} className={`chip !py-0.5 !text-[.68rem] ${m.state === 'out' ? 'chip-out' : ''}`}>
                          {m.state === 'out' ? `בלי ${m.name}` : m.state === 'side' ? `${m.name} בצד` : m.name}
                        </li>
                      ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>

          <div className="mt-4 flex justify-between border-t border-line pt-3 font-bold">
            <span>סה״כ</span>
            <span className="money">{formatLkr(order.total_lkr)}</span>
          </div>

          {order.pay_status === 'cod_pending' && (
            <p className="mt-3 rounded-input bg-accent-soft px-3 py-2 text-[.82rem]">
              {order.pay_method === 'cash_lkr_to_driver'
                ? 'תשלמו לנהג במזומן כשההזמנה מגיעה.'
                : 'תשלמו בדלפק כשתאספו.'}
            </p>
          )}
        </div>

        <p className="mt-5 text-center text-[.8rem] text-fg-subtle">
          שמרו את הקישור הזה — הוא מתעדכן לבד.
          <br />
          משהו לא בסדר?{' '}
          <a href={wa} target="_blank" rel="noopener noreferrer" className="font-medium text-accent-strong hover:underline">
            כתבו לנו
          </a>
          {' · '}
          <Link href="/menu" className="font-medium text-accent-strong hover:underline">
            להזמנה נוספת
          </Link>
        </p>
      </div>
    </main>
  );
}
