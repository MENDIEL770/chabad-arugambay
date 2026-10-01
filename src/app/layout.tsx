import { TENANT } from '@/lib/config';
import type { Metadata } from 'next';
import { Rubik, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';

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

export const metadata: Metadata = {
  // Template so every page reads "<page> · בית חב״ד ארוגם ביי – סרי לנקה".
  title: {
    default: `${TENANT.name.he} – ${TENANT.region.he} · ${TENANT.tagline.he}`,
    template: `%s · ${TENANT.name.he} – ${TENANT.region.he}`,
  },
  description:
    'בית חב״ד ארוגם ביי, סרי לנקה — הבית שלך במזרח. סעודות שבת וחג, מסעדה כשרה, ' +
    'משלוחים, והמלצות למטיילים.',
};

/**
 * Applies the saved theme before the first paint. Inline and synchronous on
 * purpose: anything deferred lets the wrong theme show for a frame.
 */
const THEME_BOOTSTRAP = `try{var t=localStorage.getItem('theme');if(t==='dark'||t==='light'){document.documentElement.dataset.theme=t}}catch(e){}`;

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
      </body>
    </html>
  );
}
