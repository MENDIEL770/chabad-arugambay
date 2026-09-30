import 'server-only';
import { createUserClient, createServiceClient } from '@/lib/supabase/server';
import { TENANT_ID } from '@/lib/config';
import { canAct, type AppRole } from '@/lib/roles';

export type { AppRole } from '@/lib/roles';

export interface Actor {
  userId: string;
  email: string | null;
  role: AppRole;
}

export class NotAuthorized extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotAuthorized';
  }
}

/** The signed-in member of this tenant, or null. */
export async function getActor(): Promise<Actor | null> {
  const sb = await createUserClient();
  // getUser() revalidates against Supabase. getSession() only decodes the
  // cookie, which a client can forge, so it must never gate authorisation.
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;

  // Read the membership with the service client: the memberships policy
  // requires a tenant the caller already belongs to, which is circular here.
  const { data } = await createServiceClient()
    .from('memberships')
    .select('role')
    .eq('tenant_id', TENANT_ID)
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle();

  if (!data) return null;
  return { userId: user.id, email: user.email ?? null, role: data.role as AppRole };
}

/**
 * Gate for every privileged operation.
 *
 * Server Actions are publicly reachable HTTP endpoints — being defined
 * under /admin protects nothing, and the proxy cannot protect them either
 * because an action can be invoked directly. Every action that writes must
 * call this first, and must do so BEFORE touching the service-role client,
 * which bypasses RLS entirely.
 */
export async function requireRole(min: AppRole): Promise<Actor> {
  const actor = await getActor();
  if (!actor) throw new NotAuthorized('צריך להתחבר.');
  if (!canAct(actor.role, min)) {
    throw new NotAuthorized('אין לך הרשאה לפעולה הזו.');
  }
  return actor;
}
