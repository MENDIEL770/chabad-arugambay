import { TENANT } from '@/lib/config';
import { Icon } from '@/components/ui/icon';

/**
 * Sits above the accessibility button, bottom-left.
 *
 * A circle of the same size, so the two read as a pair rather than as a
 * pill beside a button. The previous version kept a collapsed label as a
 * flex sibling, and the gap between them pushed the icon off centre even
 * though the label had no width.
 *
 * Moved out of the header because the bar held the brand, the status, a
 * theme toggle and a burger, and the one action most visitors actually
 * want was the easiest thing in it to lose.
 */
export function FloatingWhatsApp() {
  const digits = TENANT.whatsapp.replace(/[^\d]/g, '');

  return (
    <a
      href={`https://wa.me/${digits}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="שליחת הודעה בוואטסאפ"
      title="וואטסאפ"
      className="fixed bottom-[4.5rem] start-4 z-[60] grid size-12 place-items-center rounded-full bg-accent text-fg-on-accent shadow-float transition-transform hover:scale-105"
    >
      <Icon name="whatsapp" size={22} />
    </a>
  );
}
