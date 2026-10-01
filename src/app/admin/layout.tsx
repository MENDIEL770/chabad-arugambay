import Link from 'next/link';
import { hasSupabase, TENANT } from '@/lib/config';
import { getActor } from '@/lib/auth';
import { signOut } from './login/actions';
import { AdminMobileNav, AdminSidebar } from '@/components/admin/admin-sidebar';
import { LogoMark } from '@/components/ui/logo';

/**
 * Admin shell: a rail on the right, content beside it.
 *
 * The top bar held eleven links and had stopped being scannable. A rail has
 * room to group them by who does the work — kitchen during service versus
 * site editing once a month — and that grouping is also the shape the
 * restaurant-only login will take: it gets the first group and nothing else.
 */
export default async function AdminLayout({ children }: LayoutProps<'/admin'>) {
  const actor = hasSupabase() ? await getActor() : null;

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-50 border-b border-line bg-bg">
        <div className="wrap flex h-16 items-center gap-4">
          <Link href="/admin" className="flex items-center gap-2.5 font-bold whitespace-nowrap">
            <LogoMark size={30} className="shrink-0" />
            <span className="max-[560px]:hidden">{TENANT.name.he}</span>
            <span className="chip">ניהול</span>
          </Link>

          <AdminMobileNav />

          <div className="ms-auto flex items-center gap-2.5">
            {actor && (
              <span className="chip max-[860px]:hidden">
                <span className="ltr">{actor.email}</span> · {actor.role}
              </span>
            )}
            <Link href="/" className="btn btn-ghost btn-sm max-[700px]:hidden">
              לאתר
            </Link>
            {actor && (
              <form action={signOut}>
                <button type="submit" className="btn btn-ghost btn-sm">יציאה</button>
              </form>
            )}
          </div>
        </div>
      </header>

      {!hasSupabase() && (
        <div className="border-b border-line bg-accent-soft">
          <div className="wrap py-2.5 text-[.84rem]">
            <b>מצב הדגמה.</b> לא הוגדר חיבור ל-Supabase, אז הנתונים נטענים מ-seed
            מקומי ושמירה לא תעבוד.
          </div>
        </div>
      )}

      <div className="wrap flex flex-1 gap-8 max-[900px]:gap-0">
        <AdminSidebar />
        <main className="min-w-0 flex-1 py-6">{children}</main>
      </div>
    </div>
  );
}
