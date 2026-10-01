import { toWaNumber, type SendResult, type WhatsAppProvider } from './provider';

/**
 * Green API — https://green-api.com
 *
 * Sends through a linked WhatsApp account rather than the official Cloud
 * API, which means no template approval and no per-message cost, at the
 * price of depending on a session that can be logged out from the phone.
 * `getState` is exposed so the admin can show whether that session is
 * still authorised instead of silently failing to send.
 */
class GreenApiProvider implements WhatsAppProvider {
  readonly id = 'green' as const;

  private get base(): string | null {
    const url = process.env.GREEN_API_URL ?? 'https://api.green-api.com';
    const id = process.env.GREEN_API_ID_INSTANCE;
    const token = process.env.GREEN_API_TOKEN_INSTANCE;
    if (!id || !token) return null;
    return `${url.replace(/\/$/, '')}/waInstance${id}`;
  }

  isConfigured(): boolean {
    return this.base !== null;
  }

  async sendText(to: string, body: string): Promise<SendResult> {
    const base = this.base;
    const token = process.env.GREEN_API_TOKEN_INSTANCE;
    if (!base || !token) return { ok: false, error: 'GREEN_API env vars are missing' };

    const number = toWaNumber(to);
    if (!number) return { ok: false, error: `Not a usable number: ${to}` };

    try {
      const res = await fetch(`${base}/sendMessage/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: `${number}@c.us`, message: body }),
        // A slow provider must not hold an order action open.
        signal: AbortSignal.timeout(8000),
      });

      if (!res.ok) {
        return { ok: false, error: `Green API ${res.status}: ${(await res.text()).slice(0, 200)}` };
      }

      const json = (await res.json()) as { idMessage?: string };
      return { ok: true, id: json.idMessage };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'send failed' };
    }
  }

  /** `authorized` means the linked phone session is still valid. */
  async getState(): Promise<{ state: string } | { error: string }> {
    const base = this.base;
    const token = process.env.GREEN_API_TOKEN_INSTANCE;
    if (!base || !token) return { error: 'not configured' };

    try {
      const res = await fetch(`${base}/getStateInstance/${token}`, {
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) return { error: `HTTP ${res.status}` };
      const json = (await res.json()) as { stateInstance?: string };
      return { state: json.stateInstance ?? 'unknown' };
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'unreachable' };
    }
  }
}

export const greenApi = new GreenApiProvider();
