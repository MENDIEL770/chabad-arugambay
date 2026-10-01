/**
 * WhatsApp sending, behind one interface.
 *
 * Green API is the provider we are wiring first, but the Baileys bot that
 * already exists could implement this too, and so could the official Cloud
 * API later. Nothing above this file knows which one is in use.
 */
export interface SendResult {
  ok: boolean;
  /** Provider message id, kept so a delivery receipt can be matched later. */
  id?: string;
  error?: string;
}

export interface WhatsAppProvider {
  readonly id: 'green' | 'none';
  /** @param to E.164 with no punctuation, e.g. 94771234567 */
  sendText(to: string, body: string): Promise<SendResult>;
  isConfigured(): boolean;
}

/**
 * Used whenever no provider is configured.
 *
 * Returns a failure rather than throwing: a customer's order must still be
 * accepted when the notification cannot go out. The order is the thing that
 * matters; the message is a courtesy.
 */
export const NullProvider: WhatsAppProvider = {
  id: 'none',
  isConfigured: () => false,
  async sendText() {
    return { ok: false, error: 'WhatsApp is not configured' };
  },
};

/** Strip everything a human might type around a number. */
export function toWaNumber(phone: string): string | null {
  const digits = phone.replace(/[^\d]/g, '');
  // Too short to be a real international number; refuse rather than send
  // a message into the void.
  if (digits.length < 8 || digits.length > 15) return null;
  return digits;
}

/**
 * What a message about one order needs to know.
 *
 * Lives here rather than beside the wording, because the wording is no
 * longer in the code: it is a template the house edits, and this is the
 * shape the renderer fills in.
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
