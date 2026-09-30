import Link from 'next/link';
import { getHomeCalendar } from '@/lib/data/calendar';
import { getMenu } from '@/lib/data/menu';
import { isSellable } from '@/lib/data/types';

export default async function AdminHome() {
  const cal = getHomeCalendar();
  const menu = await getMenu();
  const items = menu.flatMap((c) => c.items);
  const soldOut = items.filter((i) => !isSellable(i));
  const low = items.filter(
    (i) => isSellable(i) && i.stock === 'count' && (i.stockQty ?? 0) <= 3,
  );

  const tiles = [
    { label: 'סטטוס המסעדה', value: cal.status.isOpen ? 'פתוח' : 'סגור', note: cal.status.label },
    { label: 'מנות בתפריט', value: String(items.length), note: `${menu.length} קטגוריות` },
    { label: 'אזלו', value: String(soldOut.length), note: soldOut.map((i) => i.name.he).join(', ') || '—' },
    {
      label: cal.next ? cal.next.title.he : 'אין אירוע קרוב',
      value: cal.next?.candleLighting.toFormat('HH:mm') ?? '—',
      note: cal.next ? `הדלקה · צאת ${cal.next.havdalah.toFormat('HH:mm')}` : '—',
    },
  ];

  return (
    <div className="wrap">
      <h1 className="mb-6 text-2xl font-bold tracking-[-.015em]">סקירה</h1>

      <div className="grid grid-cols-4 gap-4 max-[900px]:grid-cols-2 max-[560px]:grid-cols-1">
        {tiles.map((t) => (
          <div key={t.label} className="card">
            <p className="eyebrow">{t.label}</p>
            <p className="mt-2 text-[1.9rem] font-bold leading-none tracking-[-.02em]">{t.value}</p>
            <p className="mt-2 line-clamp-2 text-[.82rem] text-fg-muted">{t.note}</p>
          </div>
        ))}
      </div>

      {low.length > 0 && (
        <div className="card mt-6 border-warn/40 bg-accent-soft">
          <p className="font-medium">מלאי נמוך</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {low.map((i) => (
              <li key={i.id} className="chip">
                {i.name.he} — נשארו {i.stockQty}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-3">
        <Link href="/admin/restaurant/menu" className="btn btn-accent">ניהול תפריט</Link>
        <Link href="/menu" className="btn btn-ghost">תצוגת לקוח</Link>
      </div>
    </div>
  );
}
