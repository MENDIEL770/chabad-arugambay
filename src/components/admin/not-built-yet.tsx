import Link from 'next/link';

/**
 * Honest placeholder for an admin module that is scheduled but not built.
 * States what will be here and what is blocking it, so nobody clicks in
 * expecting a working screen.
 */
export function NotBuiltYet({
  title, summary, willInclude, blockedBy,
}: {
  title: string;
  summary: string;
  willInclude: string[];
  blockedBy?: string;
}) {
  return (
    <div className="wrap">
      <h1 className="text-2xl font-bold tracking-[-.015em]">{title}</h1>
      <p className="mt-1 max-w-[62ch] text-sm text-fg-muted">{summary}</p>

      <div className="card mt-6 max-w-[62ch]">
        <p className="eyebrow">מה יהיה כאן</p>
        <ul className="mt-3 flex flex-col gap-2 text-sm">
          {willInclude.map((w) => (
            <li key={w} className="flex gap-2.5">
              <span className="text-fg-subtle" aria-hidden="true">·</span>
              {w}
            </li>
          ))}
        </ul>
        {blockedBy && (
          <p className="mt-4 rounded-input bg-accent-soft px-4 py-3 text-[.85rem]">
            <b>ממתין ל:</b> {blockedBy}
          </p>
        )}
        <Link href="/admin" className="btn btn-ghost btn-sm mt-4">חזרה לסקירה</Link>
      </div>
    </div>
  );
}
