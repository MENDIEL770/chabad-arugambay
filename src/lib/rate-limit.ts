import 'server-only';
import { createHash } from 'node:crypto';
import { headers } from 'next/headers';
import { createServiceClient } from '@/lib/supabase/server';
import { hasSupabase, TENANT_ID } from '@/lib/config';

/**
 * A throttle for the endpoints a guest can reach without signing in.
 *
 * The existing per-phone caps are a good rule but not a throttle: they
 * count only open orders, so they reset as those complete, and typing a
 * different phone number sidesteps them entirely. This counts attempts in a
 * time window and is keyed on the caller as well as on what they typed.
 */

/**
 * The client's address, as far as it can be trusted.
 *
 * x-forwarded-for is client-settable in general, but on Vercel the platform
 * rewrites it, and the leftmost entry is the real peer. Off Vercel this is
 * a weak signal — which is why it is one of two keys and not the only one.
 */
async function callerKey(): Promise<string | null> {
  const h = await headers();
  const raw =
    h.get('x-vercel-forwarded-for') ??
    h.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    h.get('x-real-ip');

  if (!raw) return null;

  // Hashed before it leaves this function. The only question ever asked is
  // "is this the same caller as a moment ago", and a hash answers it
  // without the database holding anyone's address.
  return createHash('sha256').update(`arugam:${raw}`).digest('hex').slice(0, 32);
}

export interface Limit {
  bucket: string;
  limit: number;
  windowSec: number;
}

/**
 * Returns a message when the caller should be refused, or null to proceed.
 *
 * Fails open. A throttle that takes ordering down when the database hiccups
 * is worse than the flood it prevents — the kitchen can cope with junk
 * tickets; it cannot cope with no tickets.
 */
export async function throttle(
  limits: Limit,
  extraKey?: string | null,
): Promise<string | null> {
  if (!hasSupabase()) return null;

  const sb = createServiceClient();
  const keys = [await callerKey(), extraKey ? `id:${extraKey}` : null].filter(Boolean) as string[];
  if (keys.length === 0) return null;

  for (const key of keys) {
    try {
      const { data, error } = await sb.rpc('bump_rate_limit', {
        p_tenant: TENANT_ID,
        p_bucket: limits.bucket,
        p_key: key,
        p_limit: limits.limit,
        p_window_sec: limits.windowSec,
      });

      if (error) {
        if (/bump_rate_limit|schema cache|does not exist/i.test(error.message)) {
          // Migration not run yet. Say so in the log, let the order through.
          console.warn('[rate-limit] 0020_rate_limit.sql has not been run');
          return null;
        }
        return null;
      }

      if (data === false) {
        return 'יותר מדי ניסיונות מהמכשיר הזה. נסו שוב בעוד כמה דקות, או התקשרו אלינו.';
      }
    } catch {
      return null;
    }
  }

  return null;
}

/** Ten orders an hour from one device is far above any real customer. */
export const ORDER_LIMIT: Limit = { bucket: 'order', limit: 10, windowSec: 3600 };

/** Registration is rarer still, and a form fills an event faster. */
export const REGISTRATION_LIMIT: Limit = { bucket: 'registration', limit: 8, windowSec: 3600 };
