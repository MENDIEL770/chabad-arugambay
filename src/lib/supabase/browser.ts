import { createClient } from '@supabase/supabase-js';

/**
 * A browser client, used for one thing: uploading a file straight to
 * Storage.
 *
 * Big files must not travel through a server action. Next caps an action
 * body at 1MB by default, and Vercel caps a serverless request body at
 * 4.5MB no matter what Next is told — so a 10MB photo could never arrive
 * that way, which is why every upload on this site failed with a redacted
 * React #441 the moment the file was over a megabyte.
 *
 * Nothing here is privileged. It carries the anon key and can only write
 * with a one-shot token that a server action minted after checking the
 * session, so the authorisation decision still happens on the server.
 */
export function createBrowserClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  );
}
