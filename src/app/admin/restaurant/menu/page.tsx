import { getMenu } from '@/lib/data/menu';
import { MenuManager } from '@/components/admin/menu-manager';

export const dynamic = 'force-dynamic';

export default async function AdminMenuPage() {
  const menu = await getMenu();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-[-.015em]">תפריט</h1>
        <p className="mt-1 text-sm text-fg-muted">
          עריכה, מחירים, מלאי ותמונות. שינוי כאן מתעדכן מיד באתר.
        </p>
      </div>
      <MenuManager categories={menu} />
    </div>
  );
}
