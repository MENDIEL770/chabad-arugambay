import type { Metadata } from 'next';
import { getAbout } from '@/lib/data/gallery';
import { getHomeCalendar } from '@/lib/data/calendar';
import { SiteHeader } from '@/components/site/site-header';
import { SiteFooter } from '@/components/site/site-footer';
import { AboutSection } from '@/components/site/about-section';
import { ContactSection } from '@/components/site/contact-section';

export const revalidate = 600;

export const metadata: Metadata = {
  title: 'אודות',
  description: 'על בית חב״ד ארוגם ביי — מי אנחנו ואיפה למצוא אותנו.',
};

export default async function AboutPage() {
  const [about, cal] = await Promise.all([getAbout(), getHomeCalendar()]);

  return (
    <>
      <SiteHeader statusOpen={cal.status.isOpen} statusLabel={cal.status.label} closures={cal.closures} week={cal.week} />
      <main className="flex-1">
        <AboutSection about={about} />
        <ContactSection statusLabel={cal.status.label} />
      </main>
      <SiteFooter />
    </>
  );
}
