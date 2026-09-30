import { getHeroSlides } from '@/lib/data/hero';
import { HeroManager } from '@/components/admin/hero-manager';

export const dynamic = 'force-dynamic';

export default async function HeroSettingsPage() {
  const slides = await getHeroSlides(true);

  return (
    <div className="wrap">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-[-.015em]">תמונות רקע</h1>
        <p className="mt-1 max-w-[64ch] text-sm text-fg-muted">
          התמונות שמתחלפות בראש דף הבית. אפשר לצרף לכל תמונה כותרת משלה —
          ואז היא מחליפה את הטקסט הראשי כל עוד התמונה מוצגת.
        </p>
      </div>
      <HeroManager slides={slides} />
    </div>
  );
}
