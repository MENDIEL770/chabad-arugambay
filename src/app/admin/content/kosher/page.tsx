import { getKosherCategories, getKosherProducts } from '@/lib/data/kosher';
import { KosherManager } from '@/components/admin/kosher-manager';

export const dynamic = 'force-dynamic';

export default async function KosherAdminPage() {
  const [categories, products] = await Promise.all([
    getKosherCategories(true),
    getKosherProducts(true),
  ]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-[-.015em]">מוצרים כשרים</h1>
        <p className="mt-1 max-w-[70ch] text-sm text-fg-muted">
          מה אפשר לקנות בסרי לנקה ומה לא. גם ״לא כשר״ הוא תשובה שימושית —
          מטייל בסופר צריך לדעת מה להחזיר למדף לא פחות ממה לקחת.
        </p>
      </div>
      <KosherManager categories={categories} products={products} />
    </div>
  );
}
