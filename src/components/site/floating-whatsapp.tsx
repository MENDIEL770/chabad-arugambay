import { TENANT } from '@/lib/config';
import { Icon } from '@/components/ui/icon';

/**
 * Sits above the accessibility button, bottom-left.
 *
 * Moved out of the header because the bar had the brand, the status, a
 * theme toggle, a burger and this — too much for a phone, and the one
 * action most visitors actually want was the easiest to lose.
 */
export function FloatingWhatsApp() {
  const digits = TENANT.whatsapp.replace(/[^\d]/g, '');

  return (
    <a
      href={`https://wa.me/${digits}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="שליחת הודעה בוואטסאפ"
      className="group fixed bottom-[4.5rem] start-4 z-[60] flex items-center gap-2 rounded-pill bg-accent px-3.5 py-3 text-fg-on-accent shadow-float transition-transform hover:scale-105"
    >
      <Icon name="whatsapp" size={21} />
      {/* The label only earns its space where there is room for it. */}
      <span className="max-w-0 overflow-hidden text-[.88rem] font-medium whitespace-nowrap transition-all group-hover:max-w-[7rem] max-[520px]:hidden">
        וואטסאפ
      </span>
    </a>
  );
}
