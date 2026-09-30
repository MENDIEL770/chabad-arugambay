import { describe, expect, it } from 'vitest';
import { NEXT_STATUS, BOARD_COLUMNS, STATUS_LABEL, type OrderStatus } from './order-flow';

const ALL = Object.keys(NEXT_STATUS) as OrderStatus[];

describe('order state machine', () => {
  it('labels every status', () => {
    for (const s of ALL) expect(STATUS_LABEL[s]).toBeTruthy();
  });

  it('never moves backwards into a state that already fired stock deduction', () => {
    // Accepting is what decrements stock. Nothing may return to 'received'
    // or re-enter 'accepted', or the same order would deduct twice.
    for (const s of ALL) {
      expect(NEXT_STATUS[s]).not.toContain('received');
      if (s !== 'received') expect(NEXT_STATUS[s]).not.toContain('accepted');
    }
  });

  it('has no path that skips the kitchen', () => {
    // A new order cannot jump straight to delivered — the customer would
    // never see it being made, and the kitchen would never get a ticket.
    expect(NEXT_STATUS.received).not.toContain('delivered');
    expect(NEXT_STATUS.received).not.toContain('ready');
  });

  it('treats cancelled, rejected and completed as terminal', () => {
    expect(NEXT_STATUS.cancelled).toEqual([]);
    expect(NEXT_STATUS.rejected).toEqual([]);
    expect(NEXT_STATUS.completed).toEqual([]);
  });

  it('can always reach a terminal state from anywhere', () => {
    const terminal = new Set<OrderStatus>(['completed', 'cancelled', 'rejected']);
    for (const start of ALL) {
      const seen = new Set<OrderStatus>();
      const queue: OrderStatus[] = [start];
      let reached = false;
      while (queue.length) {
        const cur = queue.shift()!;
        if (terminal.has(cur)) { reached = true; break; }
        if (seen.has(cur)) continue;
        seen.add(cur);
        queue.push(...NEXT_STATUS[cur]);
      }
      expect(reached, `${start} cannot reach a terminal state`).toBe(true);
    }
  });

  it('shows only live states as board columns', () => {
    for (const c of BOARD_COLUMNS) {
      expect(['completed', 'cancelled', 'rejected']).not.toContain(c.status);
    }
  });

  it('every board column is reachable', () => {
    const reachable = new Set<OrderStatus>(['received']);
    let grew = true;
    while (grew) {
      grew = false;
      for (const s of [...reachable]) {
        for (const n of NEXT_STATUS[s]) {
          if (!reachable.has(n)) { reachable.add(n); grew = true; }
        }
      }
    }
    for (const c of BOARD_COLUMNS) expect(reachable.has(c.status)).toBe(true);
  });
});
