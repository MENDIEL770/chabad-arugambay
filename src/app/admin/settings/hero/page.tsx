import { getHeroSlides } from '@/lib/data/hero';
import { HeroManager } from '@/components/admin/hero-manager';
import type { HeroSlide } from '@/lib/data/hero-spec';

export const dynamic = 'force-dynamic';

/**
 * This page was failing in production with React #441 — which is simply
 * "a Server Component threw and the message is hidden in production". The
 * digest alone is useless without Vercel's logs, so the failure is caught
 * here and shown on the page instead: the uploader still renders, and the
 * actual message is visible to whoever is standing in front of it.
 */
export default async function HeroSettingsPage() {
  let slides: HeroSlide[] = [];
  let failure: string | null = null;

  try {
    slides = await getHeroSlides(true);
  } catch (e) {
    failure = e instanceof Error ? e.message : String(e);
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-[-.015em]">תמונות רקע</h1>
        <p className="mt-1 max-w-[64ch] text-sm text-fg-muted">
          התמונות שמתחלפות בראש דף הבית. אפשר לצרף לכל תמונה כותרת משלה —
          ואז היא מחליפה את הטקסט הראשי כל עוד התמונה מוצגת.
        </p>
      </div>

      {failure && (
        <div className="card mb-5 border-danger/40">
          <p className="font-medium text-danger">לא הצלחנו לטעון את התמונות הקיימות.</p>
          <p className="mt-1.5 text-[.85rem] text-fg-muted">
            אפשר עדיין להעלות תמונה חדשה. השגיאה:
          </p>
          <pre className="ltr mt-2 overflow-x-auto rounded-input bg-surface p-3 text-[.75rem]">
            {failure}
          </pre>
          <p className="mt-2 text-[.8rem] text-fg-subtle">
            אם כתוב שהטבלה חסרה — הריצו את <code className="ltr">0005_hero.sql</code>.
          </p>
        </div>
      )}

      <HeroManager slides={slides} />
    </div>
  );
}
