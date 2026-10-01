import { describe, expect, it } from 'vitest';
import { messageForStatus, type OrderMessageContext } from './messages';
import { toWaNumber } from './provider';

const base: OrderMessageContext = {
  code: 'A-042',
  customerName: 'מנדי',
  totalLkr: 11900,
  fulfillment: 'delivery',
  trackUrl: 'https://example.test/order/abc',
  payToDriver: true,
};

describe('which transitions earn a message', () => {
  it('messages the moments a customer cares about', () => {
    for (const s of ['received', 'accepted', 'ready', 'dispatched', 'delivered', 'rejected']) {
      expect(messageForStatus(s, base), s).toBeTruthy();
    }
  });

  /**
   * Messaging every transition trains people to ignore the messages that
   * matter. 'preparing' and 'completed' are internal bookkeeping.
   */
  it('stays silent on internal bookkeeping', () => {
    expect(messageForStatus('preparing', base)).toBeNull();
    expect(messageForStatus('completed', base)).toBeNull();
    expect(messageForStatus('cancelled', base)).toBeNull();
  });
});

describe('message content', () => {
  it('always names the order, so two open orders are distinguishable', () => {
    for (const s of ['received', 'accepted', 'ready', 'dispatched', 'delivered', 'rejected']) {
      expect(messageForStatus(s, base), s).toContain('A-042');
    }
  });

  it('tells a delivery customer what to pay the driver', () => {
    expect(messageForStatus('dispatched', base)).toContain('11,900 LKR');
  });

  it('does not demand cash when the order was paid another way', () => {
    const paid = { ...base, payToDriver: false };
    expect(messageForStatus('dispatched', paid)).not.toContain('במזומן');
  });

  it('tells a pickup customer to come to the counter, not that a driver left', () => {
    const pickup = { ...base, fulfillment: 'pickup' as const };
    const msg = messageForStatus('ready', pickup)!;
    expect(msg).toContain('לאיסוף');
    expect(msg).not.toContain('בדרך');
  });

  it('includes the driver when one is known', () => {
    const withDriver = { ...base, driverName: 'Kumara', driverPhone: '+94771111111' };
    const msg = messageForStatus('dispatched', withDriver)!;
    expect(msg).toContain('Kumara');
    expect(msg).toContain('+94771111111');
  });

  it('reassures about money when an order is refused', () => {
    const msg = messageForStatus('rejected', { ...base, rejectReason: 'הדג נגמר' })!;
    expect(msg).toContain('הדג נגמר');
    expect(msg).toContain('לא חויבתם');
  });

  it('omits the tracking line when there is no link', () => {
    const msg = messageForStatus('received', { ...base, trackUrl: null })!;
    expect(msg).not.toContain('מעקב');
  });
});

describe('number normalisation', () => {
  it('strips punctuation a person would type', () => {
    expect(toWaNumber('+94 77 123 4567')).toBe('94771234567');
    expect(toWaNumber('+972-50-1234567')).toBe('972501234567');
  });

  it('refuses what cannot be a real international number', () => {
    expect(toWaNumber('12345')).toBeNull();
    expect(toWaNumber('')).toBeNull();
    expect(toWaNumber('+1234567890123456789')).toBeNull();
  });
});
