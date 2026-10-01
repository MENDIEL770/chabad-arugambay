import { getOpenEvents } from '@/lib/data/events';
import { createServiceClient } from '@/lib/supabase/server';
import { hasSupabase, TENANT_ID } from '@/lib/config';
import { EventsManager } from '@/components/admin/events-manager';

export const dynamic = 'force-dynamic';

async function countsByEvent(): Promise<Record<string, number>> {
  if (!hasSupabase()) return {};
  const { data, error } = await createServiceClient()
    .from('registrations')
    .select('event_id')
    .eq('tenant_id', TENANT_ID)
    .in('state', ['pending', 'confirmed']);

  // Before 0007 runs there is nothing to count; the page should still load.
  if (error) return {};

  const out: Record<string, number> = {};
  for (const r of data ?? []) {
    const k = r.event_id as string;
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}

export default async function AdminEventsPage() {
  const [events, counts] = await Promise.all([getOpenEvents(), countsByEvent()]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-[-.015em]">אירועים</h1>
        <p className="mt-1 max-w-[64ch] text-sm text-fg-muted">
          טפסי הרשמה לשבתות, חגים ואירועים. הזמנים מגיעים מהלוח אוטומטית, אז
          תיקון בזמנים מתעדכן בכל הטפסים בבת אחת.
        </p>
      </div>
      <EventsManager events={events} registrationCounts={counts} />
    </div>
  );
}
