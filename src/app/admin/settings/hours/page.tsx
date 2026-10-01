import { getOpeningHours } from '@/lib/data/hours';
import { HoursEditor } from '@/components/admin/hours-editor';

export const dynamic = 'force-dynamic';

export default async function HoursPage() {
  const hours = await getOpeningHours();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-[-.015em]">שעות פתיחה</h1>
        <p className="mt-1 max-w-[64ch] text-sm text-fg-muted">
          מתי המסעדה מקבלת הזמנות. הסטטוס בראש האתר ובתפריט מתעדכן מכאן.
        </p>
      </div>
      <HoursEditor hours={hours} />
    </div>
  );
}
