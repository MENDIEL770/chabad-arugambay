import type { Metadata } from 'next';
import { getKosherCategories, getKosherProducts } from '@/lib/data/kosher';
import { KosherSearch } from '@/components/kosher/kosher-search';

export const revalidate = 300;

export const metadata: Metadata = {
  title: 'מוצרים כשרים בסרי לנקה',
  description:
    'מה אפשר לקנות בסופר בסרי לנקה ומה לא — רשימה מתעדכנת של מוצרים, ' +
    'כשרויות והערות, מבית חב״ד ארוגם ביי.',
};

export default async function KosherPage() {
  const [categories, products] = await Promise.all([
    getKosherCategories(),
    getKosherProducts(),
  ]);

  return (
    <main id="main" className="wrap flex-1 py-12">
      <div className="mb-6 max-w-[62ch]">
        <span className="eyebrow">קניות</span>
        <h1 className="mt-2 text-balance text-[clamp(1.7rem,3.4vw,2.3rem)] font-bold tracking-[-.015em]">
          מוצרים כשרים בסרי לנקה
        </h1>
        <p className="mt-2 text-fg-muted">
          מה שבדקנו בסופרים כאן. חפשו לפי שם, מותג או ברקוד — ואפשר לסנן
          לפי קטגוריה.
        </p>
      </div>

      <KosherSearch categories={categories} products={products} />
    </main>
  );
}
