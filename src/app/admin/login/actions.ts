'use server';

import { redirect } from 'next/navigation';
import { createUserClient, createServiceClient } from '@/lib/supabase/server';
import { TENANT_ID } from '@/lib/config';

export interface LoginState {
  error: string | null;
}

export async function signIn(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const next = String(formData.get('next') ?? '/admin');

  if (!email || !password) return { error: 'צריך מייל וסיסמה.' };

  const sb = await createUserClient();
  const { data, error } = await sb.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    // Deliberately vague: distinguishing "no such user" from "wrong password"
    // tells an attacker which addresses are real.
    return { error: 'המייל או הסיסמה שגויים.' };
  }

  // Authenticating is not the same as being a member of this tenant. Someone
  // with a Supabase account but no membership must not reach the admin.
  const { data: membership } = await createServiceClient()
    .from('memberships')
    .select('role')
    .eq('tenant_id', TENANT_ID)
    .eq('user_id', data.user.id)
    .eq('is_active', true)
    .maybeSingle();

  if (!membership) {
    await sb.auth.signOut();
    return { error: 'החשבון הזה לא משויך לבית חב״ד ארוגם ביי.' };
  }

  // Only allow relative paths — an absolute URL here is an open redirect.
  redirect(next.startsWith('/') && !next.startsWith('//') ? next : '/admin');
}

export async function signOut(): Promise<void> {
  const sb = await createUserClient();
  await sb.auth.signOut();
  redirect('/admin/login');
}
