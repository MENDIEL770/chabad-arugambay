import { getStays, getTips } from '@/lib/data/travel';
import { TravelManager } from '@/components/admin/travel-manager';

export const dynamic = 'force-dynamic';

export default async function TravelAdminPage() {
  // includeInactive: the admin must see hidden rows, and must NOT see the
  // code seed as though it were editable data.
  const [stays, tips] = await Promise.all([getStays(true), getTips(true)]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-[-.015em]">טיולים והמלצות</h1>
        <p className="mt-1 max-w-[64ch] text-sm text-fg-muted">
          איפה לישון ומה לעשות. קישור הזמנה עם מזהה השותף שלכם מ-Booking
          מחזיר עמלה על כל הזמנה שיוצאת מכאן.
        </p>
      </div>
      <TravelManager stays={stays} tips={tips} />
    </div>
  );
}
