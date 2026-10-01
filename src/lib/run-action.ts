/**
 * Call a server action and always get a result back.
 *
 * A server action that throws rather than returns leaves a useTransition
 * stuck with `isPending === true` — the button sits on "saving…" forever and
 * the person is left guessing. Every action here is written to return an
 * {ok,message}, but a framework-level failure (a serialisation error, a
 * dropped connection, an expired session) still arrives as a throw.
 */
export interface Settled {
  ok: boolean;
  message: string;
}

export async function runAction<T extends Settled>(
  fn: () => Promise<T>,
  fallback = 'הפעולה נכשלה. נסו שוב, ואם זה חוזר — צלמו מסך ושלחו לנו.',
): Promise<T | Settled> {
  try {
    return await fn();
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      // The detail matters: "fetch failed" and "not authorised" need
      // different responses from whoever is standing there.
      message: detail && detail !== 'undefined' ? `${fallback}\n${detail}` : fallback,
    };
  }
}
