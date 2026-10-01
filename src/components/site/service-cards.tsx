import Link from 'next/link';
import { Icon, type IconName } from '@/components/ui/icon';
import { Reveal } from './reveal';

const CARDS: { href: string; icon: IconName; title: string; body: string; cta: string }[] = [
  { href: '/shabbat', icon: 'candle', title: 'הרשמה לשבת',
    body: 'ליל שבת ויום שבת. מבוגר 55 ₪, ילד 30 ₪. אפשר גם רק לישון.', cta: 'להרשמה' },
  { href: '/menu', icon: 'utensils', title: 'המסעדה',
    body: 'כשר למהדרין. משלוח, איסוף או ישיבה במקום. תשלום לנהג במזומן.', cta: 'להזמנה' },
  { href: '/travel', icon: 'map', title: 'טיולים והמלצות',
    body: 'איפה לישון, מה לראות, ואיזה טוק-טוק לא ינסה לעבוד עליכם.', cta: 'לחיפוש' },
  { href: '/donate', icon: 'heart', title: 'תרומה',
    body: 'הסעודות פתוחות לכל מי שמגיע. מי שיכול — עוזר לנו להמשיך.', cta: 'לתרומה' },
];

/**
 * A rail on a phone, a grid on a desktop.
 *
 * Four cards squeezed into a phone column makes each one a thin strip with
 * three words per line. Side-by-side with scroll-snap gives each card a
 * readable width and makes it obvious there are more — the peek of the next
 * card at the edge does that work without a visible scrollbar.
 */
export function ServiceCards() {
  return (
    <div
      className="
        -mx-5 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-2
        [scrollbar-width:none] [&::-webkit-scrollbar]:hidden
        min-[760px]:mx-0 min-[760px]:grid min-[760px]:grid-cols-2 min-[760px]:overflow-visible min-[760px]:px-0
        min-[1000px]:grid-cols-4
      "
    >
      {CARDS.map((c, i) => (
        <Reveal
          key={c.href + c.title}
          delay={i * 70}
          className="w-[78vw] max-w-[320px] shrink-0 snap-start min-[760px]:w-auto min-[760px]:max-w-none"
        >
          <Link
            href={c.href}
            className="card group flex h-full flex-col gap-3 transition-all hover:-translate-y-[3px] hover:border-line-strong hover:shadow-card"
          >
            <span className="mb-1 grid size-[42px] place-items-center rounded-input bg-accent-soft text-accent-strong">
              <Icon name={c.icon} size={21} />
            </span>
            <h3 className="text-[1.09rem] font-bold">{c.title}</h3>
            <p className="flex-1 text-sm text-fg-muted">{c.body}</p>
            <span className="inline-flex items-center gap-1.5 text-[.85rem] font-medium">
              {c.cta}
              <Icon name="arrow" size={15} className="transition-transform group-hover:-translate-x-1" />
            </span>
          </Link>
        </Reveal>
      ))}
    </div>
  );
}
