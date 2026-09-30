import Link from 'next/link';
import { hasSupabase, TENANT } from '@/lib/config';

const MODULES = [
  { href: '/admin/events', label: 'אירועים' },
  { href: '/admin/restaurant/menu', label: 'מסעדה' },
  { href: '/admin/orders', label: 'הזמנות' },
  { href: '/admin/settings', label: 'הגדרות' },
];

/**
 * Admin shell. Top bar with four modules and horizontal sub-tabs, not a fixed
 * icon rail — the spec calls for the modules to be readable at a glance, and
 * there are only four of them.
 */
export default function AdminLayout({ children }: LayoutProps<'/admin'>) {
  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-line bg-bg">
        <div className="wrap flex h-16 items-center gap-6">
          <Link href="/admin" className="flex items-center gap-2.5 font-bold whitespace-nowrap">
            <span className="grid size-8 place-items-center rounded-full bg-accent text-sm text-fg-on-accent">
              ח
            </span>
            <span className="max-[700px]:hidden">{TENANT.name.he}</span>
            <span className="chip">ניהול</span>
          </Link>

          <nav className="flex gap-1 overflow-x-auto">
            {MODULES.map((m) => (
              <Link
                key={m.href}
                href={m.href}
                className="rounded-pill px-4 py-2 text-sm font-medium text-fg-muted whitespace-nowrap transition-colors hover:bg-surface hover:text-fg"
              >
                {m.label}
              </Link>
            ))}
          </nav>

          <Link href="/" className="btn btn-ghost btn-sm ms-auto max-[700px]:hidden">
            לאתר
          </Link>
        </div>
      </header>

      {!hasSupabase() && (
        <div className="border-b border-line bg-accent-soft">
          <div className="wrap py-2.5 text-[.84rem]">
            <b>מצב הדגמה.</b> לא הוגדר חיבור ל-Supabase, אז התפריט נטען מנתוני
            seed מקומיים. עריכה, מלאי והעלאת תמונות ידרשו{' '}
            <code className="ltr rounded bg-bg px-1.5 py-0.5 text-[.8em]">
              NEXT_PUBLIC_SUPABASE_URL
            </code>{' '}
            ו-
            <code className="ltr rounded bg-bg px-1.5 py-0.5 text-[.8em]">
              SUPABASE_SERVICE_ROLE_KEY
            </code>
            .
          </div>
        </div>
      )}

      <main className="flex-1 bg-surface py-8">{children}</main>
    </div>
  );
}
