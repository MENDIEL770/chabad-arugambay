/**
 * The Chabad Arugam Bay mark, drawn rather than loaded.
 *
 * Three nested chevrons forming a menorah, with a flame above. As geometry
 * it stays sharp at any size, inherits colour where that is wanted, costs
 * no request, and — the reason it exists here — each part can be animated
 * independently for the loading state.
 *
 * A raster original can replace this by dropping it in public/ and swapping
 * the two call sites; the proportions here follow it closely.
 */

export const LOGO_COLORS = {
  menorah: '#9B1C26',
  flame: '#F47B20',
  word: '#F47B20',
  region: '#1A9B4E',
} as const;

/** Just the menorah. Used wherever the wordmark would be too small to read. */
export function LogoMark({
  size = 36,
  className = '',
  animated = false,
}: {
  size?: number;
  className?: string;
  /** Flame flickers and the chevrons breathe — for the loading overlay. */
  animated?: boolean;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      className={className}
      role="img"
      aria-label="בית חב״ד ארוגם ביי"
    >
      <g
        stroke={LOGO_COLORS.menorah}
        strokeWidth="11"
        strokeLinecap="square"
        strokeLinejoin="miter"
        fill="none"
      >
        <path d="M8 30 L50 84 L92 30" className={animated ? 'logo-arm logo-arm-1' : undefined} />
        <path d="M26 30 L50 61 L74 30" className={animated ? 'logo-arm logo-arm-2' : undefined} />
        <path d="M43 30 L50 39 L57 30" className={animated ? 'logo-arm logo-arm-3' : undefined} />
      </g>

      {/* Flame, sitting in the notch between the inner arms. */}
      <path
        d="M50 8c4.6 5.1 6.4 8.4 6.4 11.4a6.4 6.4 0 1 1-12.8 0C43.6 16.4 45.4 13.1 50 8Z"
        fill={LOGO_COLORS.flame}
        className={animated ? 'logo-flame' : undefined}
        style={{ transformOrigin: '50px 20px' }}
      />
    </svg>
  );
}

/** Mark plus wordmark, for the header and the footer. */
export function LogoLockup({
  size = 38,
  showRegion = true,
  className = '',
}: {
  size?: number;
  showRegion?: boolean;
  className?: string;
}) {
  return (
    <span className={`flex items-center gap-2.5 ${className}`}>
      <LogoMark size={size} />
      <span className="flex flex-col leading-tight">
        <span className="font-bold whitespace-nowrap">בית חב״ד ארוגם ביי</span>
        {showRegion && (
          <span className="text-[.7rem] text-fg-subtle whitespace-nowrap">
            סרי לנקה · הבית שלך במזרח
          </span>
        )}
      </span>
    </span>
  );
}
