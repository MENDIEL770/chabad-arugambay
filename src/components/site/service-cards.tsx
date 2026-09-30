import Link from 'next/link';
import { Icon, type IconName } from '@/components/ui/icon';

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

export function ServiceCards() {
  return (
    <div className="grid grid-cols-4 gap-[18px] max-[1000px]:grid-cols-2 max-[760px]:grid-cols-1">
      {CARDS.map((c) => (
        <Link
          key={c.href + c.title}
          href={c.href}
          className="card group flex flex-col gap-3 transition-all hover:-translate-y-[3px] hover:border-line-strong hover:shadow-card"
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
      ))}
    </div>
  );
}
