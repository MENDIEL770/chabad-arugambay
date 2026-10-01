import { getHappenings } from '@/lib/data/happenings';
import { HappeningsManager } from '@/components/admin/happenings-manager';

export const dynamic = 'force-dynamic';

export default async function HappeningsAdminPage() {
  const items = await getHappenings({ includeHidden: true });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-[-.015em]">פעילויות וזמני תפילה</h1>
        <p className="mt-1 max-w-[70ch] text-sm text-fg-muted">
          שיעורים, מניינים, התוועדויות והודעות. מה שנוסף כאן מופיע בעמוד
          ״מה קורה״ ובעמוד הראשי. פעילות שתלויה בשקיעה — למשל מנחה עשרים דקות
          לפני — זזה לבד לאורך השנה.
        </p>
      </div>
      <HappeningsManager items={items} />
    </div>
  );
}
