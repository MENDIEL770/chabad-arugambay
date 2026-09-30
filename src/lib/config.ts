import { ARUGAM_BAY, BAAL_HATANYA_ARUGAM_BAY } from '@/lib/zmanim/profile';

/**
 * The single tenant this deployment serves. When the system is replicated to
 * other shluchim this becomes a lookup by host; everything downstream already
 * takes a tenant id, so nothing else has to change.
 */
export const TENANT_ID = process.env.TENANT_ID ?? '00000000-0000-0000-0000-000000000001';

export const TENANT = {
  id: TENANT_ID,
  slug: 'arugam-bay',
  name: { he: 'בית חב״ד ארוגם ביי', en: 'Chabad of Arugam Bay' },
  region: { he: 'סרי לנקה', en: 'Sri Lanka' },
  tagline: { he: 'הבית שלך במזרח', en: 'Your home in the East' },
  point: ARUGAM_BAY,
  zmanim: BAAL_HATANYA_ARUGAM_BAY,
  whatsapp: '+94771234567',
  addressLine: { he: 'Main Street, Arugam Bay', en: 'Main Street, Arugam Bay' },
} as const;

/** Display-only conversion. Money is always charged in one real currency. */
export const FX = {
  lkrPerIls: 100,
  lkrPerUsd: 300,
} as const;

export function hasSupabase(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

export function formatLkr(n: number): string {
  return `${n.toLocaleString('en-US')} LKR`;
}

export function lkrToIls(lkr: number): number {
  return Math.round(lkr / FX.lkrPerIls);
}
