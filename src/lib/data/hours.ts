import { createServiceClient } from '@/lib/supabase/server';
import { hasSupabase, TENANT_ID } from '@/lib/config';

export interface DayHours {
  weekday: number;
  opens: string;
  closes: string;
  isClosed: boolean;
}

/** 11:00–21:30 every day, which is what the code assumed before this existed. */
const DEFAULTS: DayHours[] = Array.from({ length: 7 }, (_, weekday) => ({
  weekday,
  opens: '11:00',
  closes: '21:30',
  isClosed: false,
}));

const hhmm = (v: unknown, fallback: string) =>
  typeof v === 'string' ? v.slice(0, 5) : fallback;

/**
 * Weekly hours, filled in for any day with no row.
 *
 * Always returns seven days so the admin renders a complete week and the
 * status logic never has to handle a gap.
 */
export async function getOpeningHours(): Promise<DayHours[]> {
  if (!hasSupabase()) return DEFAULTS;

  const { data, error } = await createServiceClient()
    .from('opening_hours')
    .select('weekday, opens, closes, is_closed')
    .eq('tenant_id', TENANT_ID);

  if (error || !data?.length) return DEFAULTS;

  return DEFAULTS.map((d) => {
    const row = data.find((r) => r.weekday === d.weekday);
    if (!row) return d;
    return {
      weekday: d.weekday,
      opens: hhmm(row.opens, d.opens),
      closes: hhmm(row.closes, d.closes),
      isClosed: row.is_closed === true,
    };
  });
}
