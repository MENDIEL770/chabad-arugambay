'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { KitchenOrder } from '@/lib/data/kitchen';
import { acceptOrder, bumpOrder, refreshKitchen } from '@/app/kitchen/actions';

const POLL_MS = 5000;
const ETA_CHOICES = [10, 15, 20, 30, 45];

const STATION_LABEL: Record<string, string> = {
  grill: 'GRILL',
  cold: 'COLD',
  bar: 'BAR',
  bakery: 'BAKERY',
};

/** Green under ten minutes, amber to twenty, red past that. */
function ageTone(minutes: number) {
  if (minutes < 10) return { ring: 'border-emerald-500', text: 'text-emerald-400' };
  if (minutes < 20) return { ring: 'border-amber-500', text: 'text-amber-400' };
  return { ring: 'border-red-500', text: 'text-red-400' };
}

function Card({
  order, onAccept, onBump, busy,
}: {
  order: KitchenOrder;
  onAccept: (id: string, eta: number) => void;
  onBump: (id: string, to: string) => void;
  busy: boolean;
}) {
  const tone = ageTone(order.ageMinutes);
  const isNew = order.status === 'received';

  return (
    <article className={`flex flex-col rounded-lg border-2 bg-zinc-900 ${tone.ring}`}>
      <header className="flex items-baseline gap-3 border-b border-zinc-700 px-4 py-3">
        <span className="font-mono text-2xl font-bold tabular-nums text-white">
          {order.code}
        </span>
        <span className="rounded bg-zinc-800 px-2 py-0.5 text-xs font-medium uppercase tracking-wide text-zinc-300">
          {order.fulfillment === 'dine_in'
            ? `TABLE ${order.tableNo ?? '?'}`
            : order.fulfillment === 'delivery'
              ? 'DELIVERY'
              : 'PICKUP'}
        </span>
        <span className={`ms-auto font-mono text-xl font-bold tabular-nums ${tone.text}`}>
          {order.ageMinutes}′
        </span>
      </header>

      <ul className="flex flex-1 flex-col gap-3 px-4 py-3">
        {order.lines.map((l, i) => (
          <li key={i}>
            <div className="flex items-baseline gap-2.5">
              <span className="font-mono text-2xl font-bold tabular-nums text-amber-400">
                {l.qty}×
              </span>
              <span className="text-xl font-semibold text-white">{l.nameEn}</span>
              <span className="ms-auto rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-[.65rem] text-zinc-400">
                {STATION_LABEL[l.station] ?? l.station}
              </span>
            </div>

            {l.changes.length > 0 && (
              <ul className="mt-1.5 flex flex-wrap gap-1.5">
                {l.changes.map((c, j) => (
                  <li
                    key={j}
                    className={`rounded px-2 py-1 font-mono text-sm font-bold uppercase ${
                      c.kind === 'removal'
                        ? 'bg-red-950 text-red-300'
                        : c.kind === 'side'
                          ? 'bg-amber-950 text-amber-300'
                          : 'bg-zinc-800 text-zinc-200'
                    }`}
                  >
                    {c.text}
                  </li>
                ))}
              </ul>
            )}

            {l.note && (
              <p className="mt-1.5 rounded bg-sky-950 px-2 py-1 font-mono text-sm text-sky-200">
                “{l.note}”
              </p>
            )}
          </li>
        ))}
      </ul>

      <footer className="border-t border-zinc-700 p-3">
        {isNew ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs uppercase text-zinc-400">Ready in</span>
            {ETA_CHOICES.map((m) => (
              <button
                key={m}
                type="button"
                disabled={busy}
                onClick={() => onAccept(order.id, m)}
                className="min-w-[56px] rounded bg-emerald-600 px-3 py-3 font-mono text-lg font-bold text-white active:bg-emerald-700 disabled:opacity-40"
              >
                {m}′
              </button>
            ))}
          </div>
        ) : order.status === 'ready' ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => onBump(order.id, order.fulfillment === 'delivery' ? 'dispatched' : 'completed')}
            className="w-full rounded bg-zinc-700 py-4 font-mono text-lg font-bold uppercase text-white active:bg-zinc-600 disabled:opacity-40"
          >
            {order.fulfillment === 'delivery' ? 'Sent with driver' : 'Handed over'}
          </button>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => onBump(order.id, order.status === 'accepted' ? 'preparing' : 'ready')}
            className="w-full rounded bg-amber-500 py-4 font-mono text-xl font-bold uppercase text-black active:bg-amber-600 disabled:opacity-40"
          >
            {order.status === 'accepted' ? 'Start cooking' : 'Ready'}
          </button>
        )}
      </footer>
    </article>
  );
}

export function KitchenBoard({ initial }: { initial: KitchenOrder[] }) {
  const [orders, setOrders] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [online, setOnline] = useState(true);
  const seen = useRef(new Set(initial.map((o) => o.id)));

  /**
   * Polling rather than a live socket.
   *
   * A kitchen tablet on café wi-fi drops connection constantly, and a
   * silently dead socket is worse than a five-second delay: nobody notices
   * the orders stopped arriving. A poll that fails is visible immediately.
   */
  const pull = useCallback(async () => {
    try {
      const next = await refreshKitchen();
      setOnline(true);

      const fresh = next.filter((o) => !seen.current.has(o.id));
      if (fresh.length > 0) {
        next.forEach((o) => seen.current.add(o.id));
        chime();
      }
      setOrders(next);
    } catch {
      setOnline(false);
    }
  }, []);

  useEffect(() => {
    const id = setInterval(pull, POLL_MS);
    return () => clearInterval(id);
  }, [pull]);

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    try {
      await fn();
      await pull();
    } finally {
      setBusy(false);
    }
  }

  const sorted = [...orders].sort((a, b) => b.ageMinutes - a.ageMinutes);

  return (
    <main className="min-h-dvh bg-zinc-950 p-4" dir="ltr">
      <header className="mb-4 flex items-center gap-4">
        <h1 className="font-mono text-xl font-bold uppercase tracking-wider text-white">
          Kitchen
        </h1>
        <span className="font-mono text-sm text-zinc-400">
          {orders.length} open
        </span>
        <span
          className={`ms-auto flex items-center gap-2 font-mono text-xs uppercase ${
            online ? 'text-emerald-400' : 'text-red-400'
          }`}
        >
          <span className={`size-2 rounded-full ${online ? 'bg-emerald-400' : 'bg-red-400'}`} />
          {online ? 'live' : 'reconnecting'}
        </span>
      </header>

      {sorted.length === 0 ? (
        <p className="mt-20 text-center font-mono text-lg text-zinc-600">
          No open orders.
        </p>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(340px,1fr))] gap-4">
          {sorted.map((o) => (
            <Card
              key={o.id}
              order={o}
              busy={busy}
              onAccept={(id, eta) => run(() => acceptOrder(id, eta))}
              onBump={(id, to) => run(() => bumpOrder(id, to))}
            />
          ))}
        </div>
      )}
    </main>
  );
}

/** Short tone on a new order. Built in code so there is no file to fetch. */
function chime() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.45);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.5);
    osc.onended = () => ctx.close();
  } catch {
    // Audio blocked until the screen is touched once; the cards still update.
  }
}
