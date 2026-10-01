import Link from 'next/link';

/**
 * A guest who followed an old link — a Shabbat that has passed, an order
 * token that expired — lands here. Offering the places they were probably
 * heading is more use than the word "404".
 */
export default function NotFound() {
  return (
    <div className="mx-auto grid min-h-[60vh] max-w-[36rem] place-items-center px-5 text-center">
      <div>
        <h1 className="text-2xl font-bold tracking-[-.015em]">הדף הזה לא קיים</h1>
        <p className="mt-2 text-fg-muted">
          יכול להיות שהקישור ישן, או שהאירוע כבר עבר.
        </p>

        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Link href="/" className="btn btn-accent">לעמוד הבית</Link>
          <Link href="/shabbat" className="btn btn-ghost">שבתות וחגים</Link>
          <Link href="/menu" className="btn btn-ghost">התפריט</Link>
        </div>
      </div>
    </div>
  );
}
