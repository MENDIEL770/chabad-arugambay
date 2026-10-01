import { TENANT } from '@/lib/config';
import { siteUrl } from '@/lib/site-url';
import { getHeroSlides } from '@/lib/data/hero';
import type { Metadata } from 'next';
import { Rubik, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';
import { AccessibilityMenu } from '@/components/site/accessibility-menu';
import { FloatingWhatsApp } from '@/components/site/floating-whatsapp';

/** One family for the whole product. Rubik carries Hebrew and Latin, so
 *  headings, body, admin and public share a single voice. */
const rubik = Rubik({
  variable: '--font-rubik',
  subsets: ['latin', 'hebrew'],
  weight: ['300', '400', '500', '600', '700', '800'],
  display: 'swap',
});

/** Halachic times and kitchen tickets only — never body copy. */
const mono = IBM_Plex_Mono({
  variable: '--font-mono-ui',
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  display: 'swap',
});

/**
 * Share cards.
 *
 * A link to this site is most often pasted into a WhatsApp group, and
 * without openGraph that arrives as a grey line of text. The picture is the
 * house's own hero image rather than a generated card: next/og cannot embed
 * a Hebrew font in the serverless runtime, so generated text would render
 * as boxes — and a photograph of the place is better than a text card
 * anyway.
 *
 * generateMetadata rather than a constant, because the image comes from the
 * database and the shliach can change it.
 */
export async function generateMetadata(): Promise<Metadata> {
  const base = siteUrl();

  let image: string | null = null;
  try {
    const slides = await getHeroSlides();
    image = slides.find((s) => s.imageUrl)?.imageUrl ?? null;
  } catch {
    // A share card without a picture still works; a crashed layout does not.
  }

  const title = `${TENANT.name.he} – ${TENANT.region.he} · ${TENANT.tagline.he}`;
  const description =
    'בית חב״ד ארוגם ביי, סרי לנקה — הבית שלך במזרח. סעודות שבת וחג, מסעדה כשרה, ' +
    'משלוחים, והמלצות למטיילים.';

  return {
    // Absolute URLs come from here; a relative one silently produces no
    // preview rather than an error.
    metadataBase: new URL(base),
    title: {
      default: title,
      template: `%s · ${TENANT.name.he} – ${TENANT.region.he}`,
    },
    description,
    openGraph: {
      type: 'website',
      locale: 'he_IL',
      siteName: TENANT.name.he,
      title,
      description,
      url: base,
      ...(image ? { images: [{ url: image, width: 1200, height: 630 }] } : {}),
    },
    twitter: {
      card: image ? 'summary_large_image' : 'summary',
      title,
      description,
      ...(image ? { images: [image] } : {}),
    },
    alternates: { canonical: base },
  };
}

const THEME_BOOTSTRAP = `try{
var r=document.documentElement;
var t=localStorage.getItem('theme');
if(t==='dark'||t==='light'){r.dataset.theme=t}
var a=JSON.parse(localStorage.getItem('a11y')||'{}');
if(a.fontScale){r.style.setProperty('--a11y-scale',String(a.fontScale))}
if(a.contrast){r.dataset.a11yContrast='on'}
if(a.underlineLinks){r.dataset.a11yUnderline='on'}
if(a.stopMotion){r.dataset.a11yStopMotion='on'}
if(a.readableFont){r.dataset.a11yReadable='on'}
}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="he"
      dir="rtl"
      /**
       * The bootstrap script below stamps data-theme before React hydrates,
       * so the client <html> deliberately differs from the server's. That is
       * the whole point — it is what prevents a flash of the wrong theme —
       * and it is the one case React documents this attribute for. Scoped to
       * <html> only, so a genuine mismatch anywhere inside still reports.
       */
      suppressHydrationWarning
      className={`${rubik.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-bg text-fg">
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
        <noscript>
          {/* The reveal animation needs an observer. Without scripting the
              content must simply be visible. */}
          <style>{'[data-reveal]{opacity:1!important;transform:none!important}'}</style>
        </noscript>
        {children}
        <FloatingWhatsApp />
        <a href="#main" className="skip-link">דילוג לתוכן</a>
        <AccessibilityMenu />
      </body>
    </html>
  );
}
