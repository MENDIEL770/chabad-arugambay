import Link from 'next/link';

const ARROW = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"
       className="transition-transform group-hover:-translate-x-1">
    <path d="M19 12H5M11 18l-6-6 6-6" />
  </svg>
);

const CARDS = [
  { href: '/shabbat', icon: '🕯️', title: 'הרשמה לשבת',
    body: 'ליל שבת ויום שבת. מבוגר 55 ₪, ילד 30 ₪. אפשר גם רק לישון.', cta: 'להרשמה' },
  { href: '/menu', icon: '🍽️', title: 'המסעדה',
    body: 'כשר למהדרין. משלוח, איסוף או ישיבה במקום. תשלום לנהג במזומן.', cta: 'להזמנה' },
  { href: '/travel', icon: '🗺️', title: 'טיולים והמלצות',
    body: 'איפה לישון, מה לראות, ואיזה טוק-טוק לא ינסה לעבוד עליכם.', cta: 'לחיפוש' },
  { href: '/donate', icon: '💝', title: 'תרומה',
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
          <span className="mb-1 grid size-[42px] place-items-center rounded-input bg-accent-soft text-xl">
            {c.icon}
          </span>
          <h3 className="text-[1.09rem] font-bold">{c.title}</h3>
          <p className="flex-1 text-sm text-fg-muted">{c.body}</p>
          <span className="inline-flex items-center gap-1.5 text-[.85rem] font-medium">
            {c.cta}
            {ARROW}
          </span>
        </Link>
      ))}
    </div>
  );
}
