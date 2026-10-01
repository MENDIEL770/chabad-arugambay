import Link from 'next/link';
import { StatusPill, type Closure, type DayWindow } from './status-pill';
import { ThemeToggle } from './theme-toggle';
import { TENANT } from '@/lib/config';
import { DesktopNav, MobileNav } from './site-nav';
import { LogoMark } from '@/components/ui/logo';

export function SiteHeader({
  statusOpen,
  statusLabel,
  closures,
  week,
}: {
  statusOpen: boolean;
  statusLabel: string;
  closures: Closure[];
  week: DayWindow[];
}) {
  return (
    <header className="sticky top-0 z-50 border-b border-line bg-bg/90 backdrop-blur-md">
      <div className="wrap flex h-[68px] items-center gap-5 max-[620px]:h-[62px] max-[620px]:gap-2.5">
        <Link href="/" className="flex shrink-0 items-center gap-3 whitespace-nowrap">
          <LogoMark size={38} className="shrink-0 max-[620px]:size-[32px]" />
          <span className="flex flex-col leading-tight">
            <span className="font-bold max-[620px]:text-[.9rem]">{TENANT.name.he}</span>
            <span className="text-[.7rem] text-fg-subtle max-[620px]:text-[.64rem]">
              {TENANT.region.he} · {TENANT.tagline.he}
            </span>
          </span>
        </Link>

        <DesktopNav />

        <div className="ms-auto flex items-center gap-2.5">
          <StatusPill
            initialOpen={statusOpen}
            initialLabel={statusLabel}
            closures={closures}
            week={week}
          />
          <MobileNav />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
