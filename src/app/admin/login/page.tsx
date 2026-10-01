'use client';

import { useActionState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { signIn, type LoginState } from './actions';
import { LogoMark } from '@/components/ui/logo';

function LoginForm() {
  const params = useSearchParams();
  const next = params.get('next') ?? '/admin';
  const [state, action, pending] = useActionState<LoginState, FormData>(signIn, {
    error: null,
  });

  return (
    <form action={action} className="card w-full max-w-[380px]">
      <div className="mb-5 flex items-center gap-3">
        <LogoMark size={34} />
        <div>
          <h1 className="font-bold leading-tight">ניהול</h1>
          <p className="text-[.78rem] text-fg-subtle">בית חב״ד ארוגם ביי</p>
        </div>
      </div>

      <input type="hidden" name="next" value={next} />

      <label className="mb-3 block">
        <span className="label">מייל</span>
        <input
          className="field ltr"
          name="email"
          type="email"
          autoComplete="username"
          required
          autoFocus
        />
      </label>

      <label className="mb-4 block">
        <span className="label">סיסמה</span>
        <input
          className="field ltr"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </label>

      {state.error && (
        <p role="alert" className="mb-3 rounded-input bg-danger/10 px-3 py-2 text-[.85rem] text-danger">
          {state.error}
        </p>
      )}

      <button type="submit" className="btn btn-accent w-full justify-center" disabled={pending}>
        {pending ? 'מתחבר…' : 'כניסה'}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-surface p-5">
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
