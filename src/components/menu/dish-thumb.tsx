import Image from 'next/image';
import { Icon } from '@/components/ui/icon';

/**
 * A dish photo, or the placeholder when there is none.
 *
 * Every surface that shows a dish goes through this, so an uploaded photo
 * cannot appear in one place and be silently ignored in another — which is
 * exactly what happened when the menu drew the icon unconditionally.
 */
export function DishThumb({
  src,
  alt,
  size,
  rounded = 'rounded-input',
  className = '',
}: {
  src: string | null;
  alt: string;
  size: number;
  rounded?: string;
  className?: string;
}) {
  if (src) {
    return (
      <span
        className={`relative block shrink-0 overflow-hidden ${rounded} ${className}`}
        style={{ width: size, height: size }}
      >
        <Image
          src={src}
          alt={alt}
          fill
          sizes={`${size}px`}
          className="object-cover"
        />
      </span>
    );
  }

  return (
    <span
      className={`grid shrink-0 place-items-center bg-accent-soft text-accent-strong ${rounded} ${className}`}
      style={{ width: size, height: size }}
    >
      <Icon name="dish" size={Math.round(size * 0.42)} />
    </span>
  );
}
