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
  title: 'בית חב״ד ארוגם ביי',
  description: 'שבתות, חגים, מסעדה כשרה ומשלוחים בארוגם ביי, סרי לנקה.',
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
      className={`${rubik.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-bg text-fg">
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
        {children}
      </body>
    </html>
  );
}
