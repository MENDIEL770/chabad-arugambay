import Link from 'next/link';
import { StatusPill, type Closure } from './status-pill';
import { ThemeToggle } from './theme-toggle';
import { TENANT } from '@/lib/config';

const NAV = [
  { href: '/shabbat', label: 'שבתות וחגים' },
  { href: '/menu', label: 'המסעדה' },
  { href: '/travel', label: 'טיולים והמלצות' },
  { href: '/articles', label: 'מאמרים' },
  { href: '/ask', label: 'שאלו אותנו' },
];

export function SiteHeader({
  statusOpen,
  statusLabel,
  closures,
}: {
  statusOpen: boolean;
  statusLabel: string;
  closures: Closure[];
}) {
  const wa = `https://wa.me/${TENANT.whatsapp.replace(/[^\d]/g, '')}`;

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-bg/90 backdrop-blur-md">
      <div className="wrap flex h-[68px] items-center gap-5 max-[620px]:h-[62px] max-[620px]:gap-2.5">
        <Link href="/" className="flex shrink-0 items-center gap-3 font-bold whitespace-nowrap">
          <span className="grid size-[34px] place-items-center rounded-full bg-accent font-bold text-fg-on-accent max-[620px]:size-[30px]">
            ח
          </span>
          <span className="max-[620px]:text-[.92rem]">{TENANT.name.he}</span>
        </Link>

        <nav className="ms-2 flex gap-1 max-[940px]:hidden">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="rounded-pill px-3.5 py-2 text-sm font-medium text-fg-muted transition-colors hover:bg-surface hover:text-fg"
            >
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="ms-auto flex items-center gap-2.5">
          <StatusPill initialOpen={statusOpen} initialLabel={statusLabel} closures={closures} />
          <ThemeToggle />
          <a className="btn btn-accent max-[620px]:px-4" href={wa} target="_blank" rel="noopener noreferrer">
            <span aria-hidden="true">✆</span>
            <span className="max-[620px]:hidden">וואטסאפ</span>
          </a>
        </div>
      </div>
    </header>
  );
}
