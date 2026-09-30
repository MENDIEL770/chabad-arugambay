'use client';

import { useEffect } from 'react';
import Link from 'next/link';

/**
 * Admin error boundary.
 *
 * A white "This page couldn't load" tells whoever is running the house
 * nothing, and tells me nothing either. The admin is staff-only, so showing
 * the actual message here is safe and is the difference between a five
 * minute fix and an afternoon of guessing.
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[admin]', error);
  }, [error]);

  const missingTable = /schema cache|does not exist|relation .* does not/i.test(error.message);
  const missingFn = /function .* does not exist|place_order|place_registration/i.test(error.message);

  return (
    <div className="wrap">
      <div className="card max-w-[70ch]">
        <h1 className="text-xl font-bold">המסך הזה נפל</h1>

        {(missingTable || missingFn) && (
          <p className="mt-3 rounded-input bg-accent-soft px-4 py-3 text-[.88rem]">
            <b>נראה שחסרה מיגרציה.</b> הריצו את הקבצים החסרים מ-
            <code className="ltr">supabase/migrations/</code> לפי הסדר, או את{' '}
            <code className="ltr">supabase/all.sql</code> כולו.
          </p>
        )}

        <p className="mt-3 text-sm text-fg-muted">השגיאה כפי שהיא:</p>
        <pre className="ltr mt-1.5 overflow-x-auto rounded-input bg-surface-sunk p-3 text-[.78rem] leading-relaxed">
          {error.message}
        </pre>

        {error.digest && (
          <p className="mt-2 text-[.75rem] text-fg-subtle">
            מזהה לחיפוש בלוגים של Vercel: <code className="ltr">{error.digest}</code>
          </p>
        )}

        <div className="mt-4 flex flex-wrap gap-3">
          <button type="button" onClick={reset} className="btn btn-accent btn-sm">
            נסו שוב
          </button>
          <Link href="/admin" className="btn btn-ghost btn-sm">
            חזרה לסקירה
          </Link>
        </div>
      </div>
    </div>
  );
}
