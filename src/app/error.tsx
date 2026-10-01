'use client';

import { useEffect } from 'react';
import Link from 'next/link';

/**
 * The public error boundary.
 *
 * Without this file a thrown page shows Next's own screen: English,
 * left-to-right, and branded for a framework the visitor has never heard
 * of. The admin has had one of these for a while; the side guests actually
 * see did not.
 *
 * The message is deliberately NOT shown here, unlike in the admin. A
 * stack trace or a database error on a public page tells an attacker about
 * the schema, and tells a guest nothing they can act on. The digest is
 * shown instead, so someone reporting a problem can quote it.
 */
export default function PublicError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[public]', error);
  }, [error]);

  return (
    <div className="mx-auto grid min-h-[60vh] max-w-[36rem] place-items-center px-5 text-center">
      <div>
        <h1 className="text-2xl font-bold tracking-[-.015em]">משהו השתבש</h1>
        <p className="mt-2 text-fg-muted">
          הדף הזה לא נטען. זה אצלנו, לא אצלכם — ננסה שוב?
        </p>

        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <button type="button" className="btn btn-accent" onClick={reset}>
            נסו שוב
          </button>
          <Link href="/" className="btn btn-ghost">
            לעמוד הבית
          </Link>
          <a href="https://wa.me/94761234567" className="btn btn-ghost">
            כתבו לנו בוואטסאפ
          </a>
        </div>

        {error.digest && (
          <p className="mt-6 text-[.74rem] text-fg-subtle">
            קוד לדיווח: <code className="ltr">{error.digest}</code>
          </p>
        )}
      </div>
    </div>
  );
}
