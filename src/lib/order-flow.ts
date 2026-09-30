/**
 * The order state machine, as plain data.
 *
 * Kept out of the 'use server' module because every export there must be an
 * async function — and because the board needs these lists during render to
 * decide which buttons exist. The server re-checks the same table before
 * writing; this copy only shapes the UI.
 */
export type OrderStatus =
  | 'received' | 'accepted' | 'preparing' | 'ready'
  | 'dispatched' | 'delivered' | 'completed' | 'cancelled' | 'rejected';

export const NEXT_STATUS: Record<OrderStatus, OrderStatus[]> = {
  received:   ['accepted', 'rejected'],
  accepted:   ['preparing', 'cancelled'],
  preparing:  ['ready', 'cancelled'],
  ready:      ['dispatched', 'delivered', 'completed'],
  dispatched: ['delivered', 'cancelled'],
  delivered:  ['completed'],
  completed:  [],
  cancelled:  [],
  rejected:   [],
};

export const STATUS_LABEL: Record<OrderStatus, string> = {
  received:   'חדשה',
  accepted:   'אושרה',
  preparing:  'במטבח',
  ready:      'מוכנה',
  dispatched: 'בדרך',
  delivered:  'נמסרה',
  completed:  'הושלמה',
  cancelled:  'בוטלה',
  rejected:   'נדחתה',
};

/** Columns on the board, in the order work actually flows. */
export const BOARD_COLUMNS: { status: OrderStatus; title: string }[] = [
  { status: 'received',   title: 'חדשות' },
  { status: 'accepted',   title: 'אושרו' },
  { status: 'preparing',  title: 'במטבח' },
  { status: 'ready',      title: 'מוכנות' },
  { status: 'dispatched', title: 'במשלוח' },
];

export const FULFILLMENT_LABEL: Record<string, string> = {
  delivery: 'משלוח',
  pickup: 'איסוף',
  dine_in: 'במקום',
};
