import 'server-only';
import { greenApi } from './green-api';
import { NullProvider, toWaNumber, type WhatsAppProvider } from './provider';

/**
 * The provider plus a forgiving number parser, for the admin screens.
 *
 * Split out of index.ts so the actions module does not pull in the order
 * notification path — and so this stays importable without dragging the
 * whole send pipeline along.
 */
export function provider(): WhatsAppProvider {
  return greenApi.isConfigured() ? greenApi : NullProvider;
}

export function toWaNumberSafe(raw: string): string | null {
  return toWaNumber(raw);
}

/** Whether the linked phone is still authorised, for the status banner. */
export async function connectionState(): Promise<{
  configured: boolean;
  state: string | null;
  error: string | null;
}> {
  const p = greenApi;
  if (!p.isConfigured()) return { configured: false, state: null, error: null };
  const r = await p.getState();
  return 'state' in r
    ? { configured: true, state: r.state, error: null }
    : { configured: true, state: null, error: r.error };
}
