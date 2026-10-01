import type { Metadata } from 'next';
import { getHomeCalendar } from '@/lib/data/calendar';
import { SiteHeader } from '@/components/site/site-header';
import { SiteFooter } from '@/components/site/site-footer';
import { ARTICLES } from '@/lib/data/content';
import { Icon } from '@/components/ui/icon';

export const metadata: Metadata = {
  title: 'מאמרים ומידע',
  description: 'מדריכים ומידע למי שמגיע לארוגם ביי.',
};

export default async function ArticlesPage() {
  const cal = await getHomeCalendar();
  return (
    <>
      <SiteHeader statusOpen={cal.status.isOpen} statusLabel={cal.status.label} closures={cal.closures} week={cal.week} />
      <main id="main" className="wrap flex-1 py-12">
        <div className="mb-8 max-w-[60ch]">
          <span className="eyebrow">מאמרים ומידע</span>
          <h1 className="mt-2 mb-2.5 text-balance text-[clamp(1.9rem,4vw,2.6rem)] font-bold tracking-[-.02em]">
            לקרוא לפני שבאים
          </h1>
        </div>

        <ul className="grid grid-cols-3 gap-6 max-[900px]:grid-cols-2 max-[620px]:grid-cols-1">
          {ARTICLES.map((a) => (
            <li key={a.slug}>
              <article className="flex flex-col gap-2.5">
                <span className="grid aspect-[16/10] place-items-center rounded-card border border-line bg-surface-sunk text-accent-strong">
                  <Icon name={a.icon} size={38} strokeWidth={1.3} />
                </span>
                <h2 className="mt-1 text-[1.04rem] font-bold text-balance">{a.title.he}</h2>
                <p className="text-[.88rem] text-fg-muted">{a.excerpt.he}</p>
                <span className="text-[.75rem] text-fg-subtle">{a.minutes} דק׳ קריאה · בקרוב</span>
              </article>
            </li>
          ))}
        </ul>

        <p className="mt-8 text-[.8rem] text-fg-subtle">
          גוף המאמרים ייכתב בממשק הניהול. הכותרות כאן הן מה שאנשים שואלים בפועל.
        </p>
      </main>
      <SiteFooter />
    </>
  );
}
