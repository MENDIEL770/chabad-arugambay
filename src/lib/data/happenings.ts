import { createServiceClient } from '@/lib/supabase/server';
import { hasSupabase, TENANT_ID } from '@/lib/config';
import type { I18n } from './types';
import type { Happening, HappeningCycle, HappeningKind } from './happenings-view';

export * from './happenings-view';

export async function getHappenings(
  opts: { includeHidden?: boolean } = {},
): Promise<Happening[]> {
  if (!hasSupabase()) return [];

  // The public board shows active entries only; the admin needs to see the
  // paused ones too, or a class switched off for the season becomes
  // invisible and gets created a second time.
  let q = createServiceClient()
    .from('happenings')
    .select('*')
    .eq('tenant_id', TENANT_ID)
    .order('sort');

  if (!opts.includeHidden) q = q.eq('is_active', true);

  const { data, error } = await q;

  if (error) {
    if (/schema cache|does not exist/i.test(error.message)) {
      console.warn('[happenings] table missing — run 0010_happenings.sql');
      return [];
    }
    throw new Error(`Could not load happenings: ${error.message}`);
  }

  return (data ?? []).map((r) => ({
    id: r.id as string,
    kind: r.kind as HappeningKind,
    cycle: r.cycle as HappeningCycle,
    title: r.title as I18n,
    details: (r.details ?? {}) as I18n,
    audience: (r.audience ?? {}) as I18n,
    location: (r.location ?? {}) as I18n,
    weekday: (r.weekday as number | null) ?? null,
    weekOfMonth: (r.week_of_month as number | null) ?? null,
    onDate: (r.on_date as string | null) ?? null,
    startsAt: (r.starts_at as string | null) ?? null,
    endsAt: (r.ends_at as string | null) ?? null,
    anchor: (r.anchor as string | null) ?? null,
    anchorOffsetMin: (r.anchor_offset_min as number) ?? 0,
    pausedNote: (r.paused_note ?? {}) as I18n,
    sort: (r.sort as number) ?? 0,
    isActive: r.is_active !== false,
  }));
}

