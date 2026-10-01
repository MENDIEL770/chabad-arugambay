import type { SVGProps } from 'react';

/**
 * Line icons, drawn inline.
 *
 * Emoji were a placeholder: they render as a different picture on every
 * platform, carry their own colour that fights the palette, and sit on the
 * text baseline rather than aligning to a box. These are a single stroke
 * weight in currentColor, so they inherit the theme and line up.
 *
 * Geometry only — no external icon package, nothing to load, nothing the
 * artifact CSP or an offline kitchen tablet can fail to fetch.
 */
export type IconName =
  | 'candle' | 'utensils' | 'map' | 'heart' | 'scooter' | 'dish'
  | 'palm' | 'surf' | 'bed' | 'hut' | 'waves' | 'binoculars'
  | 'tuktuk' | 'mountain' | 'bus' | 'leaf' | 'image' | 'x'
  | 'whatsapp' | 'contrast' | 'arrow' | 'search' | 'clock' | 'sparkle'
  | 'gear' | 'camera' | 'article' | 'message' | 'calendar' | 'plus'
  | 'bold' | 'italic' | 'link' | 'list' | 'trash' | 'drag';

const PATHS: Record<IconName, React.ReactNode> = {
  gear: (
    <>
      <circle cx="12" cy="12" r="3.1" />
      <path d="M19.4 14.5a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5v.2a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1h-.2a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3h.1a1.6 1.6 0 0 0 1-1.5v-.2a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8v.1a1.6 1.6 0 0 0 1.5 1h.2a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1Z" />
    </>
  ),
  camera: (
    <>
      <path d="M3 8.5A1.5 1.5 0 0 1 4.5 7h2.2a1 1 0 0 0 .8-.4l.9-1.2a1 1 0 0 1 .8-.4h3.6a1 1 0 0 1 .8.4l.9 1.2a1 1 0 0 0 .8.4h2.2A1.5 1.5 0 0 1 21 8.5v9A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5Z" />
      <circle cx="12" cy="13" r="3.4" />
    </>
  ),
  article: (
    <>
      <rect x="4" y="3.5" width="16" height="17" rx="2" />
      <path d="M8 8h8M8 12h8M8 16h5" />
    </>
  ),
  message: (
    <>
      <path d="M20.5 11.8a7.6 7.6 0 0 1-8.2 7.6 8.4 8.4 0 0 1-3.4-.8L4 20l1.5-4.3a7.3 7.3 0 0 1-1-3.9A7.6 7.6 0 0 1 12.3 4a7.6 7.6 0 0 1 8.2 7.8Z" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
      <path d="M3.5 10h17M8 3.5v3M16 3.5v3" />
    </>
  ),
  plus: <path d="M12 5.5v13M5.5 12h13" />,
  bold: (
    <path d="M7 4.5h5.8a3.75 3.75 0 0 1 0 7.5H7Zm0 7.5h6.6a3.75 3.75 0 0 1 0 7.5H7Z" />
  ),
  italic: <path d="M15.5 4.5h-5m3.5 15h-5M14 4.5 10 19.5" />,
  link: (
    <>
      <path d="M10.5 13.5a3.5 3.5 0 0 0 5 0l3-3a3.54 3.54 0 0 0-5-5l-1.6 1.6" />
      <path d="M13.5 10.5a3.5 3.5 0 0 0-5 0l-3 3a3.54 3.54 0 0 0 5 5l1.6-1.6" />
    </>
  ),
  list: <path d="M9 6.5h11M9 12h11M9 17.5h11M4.5 6.5h.01M4.5 12h.01M4.5 17.5h.01" />,
  trash: (
    <>
      <path d="M4.5 6.5h15M9.5 6.5V5a1.5 1.5 0 0 1 1.5-1.5h2A1.5 1.5 0 0 1 14.5 5v1.5" />
      <path d="M6.5 6.5 7.3 19a1.5 1.5 0 0 0 1.5 1.4h6.4a1.5 1.5 0 0 0 1.5-1.4l.8-12.5" />
    </>
  ),
  drag: <path d="M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01" />,
  candle: (
    <>
      <path d="M12 2.5c1.4 1.7 2 2.8 2 3.8a2 2 0 1 1-4 0c0-1 .6-2.1 2-3.8Z" />
      <rect x="8.5" y="9.5" width="7" height="11.5" rx="1.6" />
      <path d="M12 8.3v1.2" />
    </>
  ),
  utensils: (
    <>
      <path d="M6 3v5a2.5 2.5 0 0 0 5 0V3" />
      <path d="M8.5 10.5V21" />
      <path d="M17.5 3c1.4 1.9 2 3.8 2 5.8 0 1.6-.7 2.7-2 3.2V21" />
    </>
  ),
  map: (
    <>
      <path d="m9 3.5-5.5 2.4v14.6L9 18.1l6 2.4 5.5-2.4V3.5L15 5.9Z" />
      <path d="M9 3.5v14.6M15 5.9v14.6" />
    </>
  ),
  heart: (
    <path d="M12 20.3S4.4 15.6 4.4 10.3a4.3 4.3 0 0 1 7.6-2.7 4.3 4.3 0 0 1 7.6 2.7c0 5.3-7.6 10-7.6 10Z" />
  ),
  scooter: (
    <>
      <circle cx="5.5" cy="17.5" r="3" />
      <circle cx="18.5" cy="17.5" r="3" />
      <path d="M8.5 17.5h7M18.5 14.5V8h-2.8" />
      <path d="M15.7 8 14 4.5h-2.3" />
      <path d="M5.5 14.5 9 10h6" />
    </>
  ),
  dish: (
    <>
      <path d="M3.5 18.5h17" />
      <path d="M5 15.5a7 7 0 0 1 14 0" />
      <path d="M12 6.2v2.3" />
    </>
  ),
  palm: (
    <>
      <path d="M12 21c0-5.5.6-9.4 1.4-11.6" />
      <path d="M13.4 9.4C11.6 7.6 8.8 7.2 6.5 8.6M13.4 9.4c-.3-2.5 1-4.8 3.3-5.8M13.4 9.4c2.2-1.3 5-1 6.8.8M13.4 9.4C11.8 7.6 9 7.2 7.2 4.9" />
    </>
  ),
  /** Pointed at both ends with a stringer and a fin, so it cannot be
   *  mistaken for the leaf icon a few rows down. */
  surf: (
    <>
      <path d="M12 2.5c3.2 3.9 4.8 7.9 4.8 11.8 0 3.9-1.6 6.7-4.8 6.7s-4.8-2.8-4.8-6.7c0-3.9 1.6-7.9 4.8-11.8Z" />
      <path d="M12 6.5v11" />
      <path d="M14.5 18.5c1 .8 1.6 1.7 1.8 2.8" />
    </>
  ),
  bed: (
    <>
      <path d="M3 18.5v-6h18v6" />
      <path d="M3 18.5v2.5M21 18.5v2.5M3 12.5V6" />
      <path d="M7 12.5v-3h10v3" />
    </>
  ),
  hut: (
    <>
      <path d="m12 3.5 8.5 7H3.5Z" />
      <path d="M5.5 10.5V21h13V10.5" />
      <path d="M10 21v-5.5h4V21" />
    </>
  ),
  waves: (
    <>
      <path d="M2.5 7.5c2-1.6 4-1.6 6 0s4 1.6 6 0 4-1.6 6 0" />
      <path d="M2.5 12.5c2-1.6 4-1.6 6 0s4 1.6 6 0 4-1.6 6 0" />
      <path d="M2.5 17.5c2-1.6 4-1.6 6 0s4 1.6 6 0 4-1.6 6 0" />
    </>
  ),
  binoculars: (
    <>
      <rect x="2.5" y="8.5" width="6" height="11" rx="2.5" />
      <rect x="15.5" y="8.5" width="6" height="11" rx="2.5" />
      <path d="M8.5 12.5h7" />
      <path d="M5.5 8.5V6a1.5 1.5 0 0 1 3 0v2.5M15.5 8.5V6a1.5 1.5 0 0 1 3 0v2.5" />
    </>
  ),
  tuktuk: (
    <>
      <circle cx="6.5" cy="17.5" r="2.8" />
      <circle cx="17.5" cy="17.5" r="2.8" />
      <path d="M9.3 17.5h5.4" />
      <path d="M4 17.5V11l4-6h6l2.5 6v6.5" />
      <path d="M4 11h12.5" />
    </>
  ),
  mountain: <path d="m2.5 19.5 6.5-10 4 5.5 3-4 5.5 8.5Z" />,
  bus: (
    <>
      <rect x="3.5" y="3.5" width="17" height="13" rx="2.5" />
      <path d="M3.5 10.5h17" />
      <path d="M7 16.5v2.5M17 16.5v2.5" />
      <circle cx="7.5" cy="13.5" r=".9" />
      <circle cx="16.5" cy="13.5" r=".9" />
    </>
  ),
  leaf: (
    <>
      <path d="M20.5 3.5C9.7 3.5 3.5 9.4 3.5 19.5c10.1 0 16-6.2 17-16Z" />
      <path d="M4.5 19.5c3.5-4.5 7.5-7.5 12-9" />
    </>
  ),
  image: (
    <>
      <rect x="3" y="4.5" width="18" height="15" rx="2.5" />
      <circle cx="8.5" cy="10" r="1.6" />
      <path d="m3.5 17 5-4.5 4.5 4 3-2.5 4.5 4" />
    </>
  ),
  x: <path d="m6 6 12 12M18 6 6 18" />,
  whatsapp: (
    <>
      <path d="M12 3.5a8.5 8.5 0 0 0-7.3 12.8L3.5 20.5l4.4-1.1A8.5 8.5 0 1 0 12 3.5Z" />
      <path d="M9 9.2c0 3 2.3 5.3 5.3 5.3.6 0 1-.4 1-.9v-.8l-1.7-.6-.8.9a4.6 4.6 0 0 1-2.3-2.3l.9-.8-.6-1.7h-.9c-.5 0-.9.4-.9.9Z" />
    </>
  ),
  contrast: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 3.5a8.5 8.5 0 0 1 0 17Z" fill="currentColor" stroke="none" />
    </>
  ),
  /** Points along the reading direction; the page is RTL, so leftward. */
  arrow: <path d="M19 12H5m6 6-6-6 6-6" />,
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7v5.2l3.2 2" />
    </>
  ),
  sparkle: (
    <path d="M12 3.5 13.8 9l5.7 1.8-5.7 1.8L12 18.2l-1.8-5.6L4.5 10.8 10.2 9Z" />
  ),
};

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: IconName;
  size?: number;
  /** Give a label only when the icon carries meaning no nearby text does. */
  label?: string;
}

export function Icon({ name, size = 20, label, className, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      {...rest}
    >
      {PATHS[name]}
    </svg>
  );
}
