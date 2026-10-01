import { formatLkr } from '@/lib/config';

/**
 * What the customer actually receives.
 *
 * Written as whole messages rather than assembled from fragments, because
 * a WhatsApp message is read in one glance and the tone matters: it should
 * sound like the house wrote it, not like a system emitted it.
 *
 * Every message names the order so a person with two open orders can tell
 * them apart, and none of them asks the customer to reply to a number that
 * nobody watches.
 */
export interface OrderMessageContext {
  code: string;
  customerName: string;
  totalLkr: number;
  fulfillment: 'delivery' | 'pickup' | 'dine_in';
  etaMinutes?: number | null;
  trackUrl?: string | null;
  payToDriver?: boolean;
  driverName?: string | null;
  driverPhone?: string | null;
  rejectReason?: string | null;
}

const track = (c: OrderMessageContext) => (c.trackUrl ? `\n\nמעקב: ${c.trackUrl}` : '');

export function orderReceived(c: OrderMessageContext): string {
  return (
    `שלום ${c.customerName}, קיבלנו את ההזמנה שלכם 🙂\n` +
    `מספר ${c.code} · ${formatLkr(c.totalLkr)}\n\n` +
    `נאשר אותה עוד רגע ונעדכן כמה זמן זה ייקח.` +
    track(c)
  );
}

export function orderAccepted(c: OrderMessageContext): string {
  const when = c.etaMinutes ? `מוכן בעוד כ-${c.etaMinutes} דקות.` : 'התחלנו להכין.';
  return `הזמנה ${c.code} אושרה — ${when}` + track(c);
}

export function orderReady(c: OrderMessageContext): string {
  if (c.fulfillment === 'pickup') {
    return `הזמנה ${c.code} מוכנה לאיסוף 🛍️\nמחכה לכם בדלפק.`;
  }
  if (c.fulfillment === 'dine_in') {
    return `הזמנה ${c.code} מוכנה — מגיעים אליכם לשולחן.`;
  }
  return `הזמנה ${c.code} מוכנה ויוצאת אליכם עכשיו 🛵`;
}

export function orderDispatched(c: OrderMessageContext): string {
  const driver =
    c.driverName && c.driverPhone
      ? `\nהנהג: ${c.driverName} · ${c.driverPhone}`
      : c.driverName
        ? `\nהנהג: ${c.driverName}`
        : '';
  const cash = c.payToDriver
    ? `\n\nלתשלום לנהג במזומן: ${formatLkr(c.totalLkr)}`
    : '';
  return `הזמנה ${c.code} בדרך אליכם 🛵${driver}${cash}` + track(c);
}

export function orderDelivered(c: OrderMessageContext): string {
  return `הזמנה ${c.code} נמסרה. בתיאבון! 🙏\n\nתודה שהזמנתם מבית חב״ד ארוגם ביי.`;
}

export function orderRejected(c: OrderMessageContext): string {
  const why = c.rejectReason ? `\nהסיבה: ${c.rejectReason}` : '';
  return (
    `מצטערים — לא נוכל להכין את הזמנה ${c.code}.${why}\n\n` +
    `לא חויבתם על כלום. אם זו טעות, כתבו לנו כאן ונסדר.`
  );
}

/** Which status change is worth a message, and which is noise. */
export function messageForStatus(
  status: string,
  c: OrderMessageContext,
): string | null {
  switch (status) {
    case 'received':   return orderReceived(c);
    case 'accepted':   return orderAccepted(c);
    case 'ready':      return orderReady(c);
    case 'dispatched': return orderDispatched(c);
    case 'delivered':  return orderDelivered(c);
    case 'rejected':   return orderRejected(c);
    // 'preparing' and 'completed' are internal bookkeeping. Messaging on
    // every transition trains people to ignore the messages that matter.
    default: return null;
  }
}
