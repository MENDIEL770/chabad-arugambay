import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { DateTime } from 'luxon';
import { createServiceClient } from '@/lib/supabase/server';
import { hasSupabase, TENANT } from '@/lib/config';
import { Icon } from '@/components/ui/icon';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'ההרשמה שלכם' };

interface Line { meal: string; type: string; qty: number; line: number }

export default async function RegistrationPage({ params }: PageProps<'/r/[token]'>) {
  const { token } = await params;
  if (!hasSupabase()) notFound();

  const { data } = await createServiceClient().rpc('registration_tracking', {
    p_token: token,
  });

  const reg = (Array.isArray(data) ? data[0] : data) as
    | {
        code: string;
        state: string;
        event_title: { he: string };
        starts_on: string;
        ends_on: string;
        total_ils: number;
        paid_at: string | null;
        lines: Line[] | null;
      }
    | undefined;

  if (!reg) notFound();

  const wa = `https://wa.me/${TENANT.whatsapp.replace(/[^\d]/g, '')}`;
  const cancelled = reg.state === 'cancelled';

  return (
    <main className="wrap flex-1 py-12">
      <div className="mx-auto max-w-[560px]">
        <div className="grid size-12 place-items-center rounded-full bg-accent text-fg-on-accent">
          <Icon name="candle" size={24} />
        </div>

        <h1 className="mt-4 text-[clamp(1.7rem,4vw,2.2rem)] font-bold tracking-[-.02em]">
          {cancelled ? 'ההרשמה בוטלה' : 'נרשמתם. נתראה!'}
        </h1>
        <p className="mt-1.5 text-fg-muted">
          {reg.event_title.he} ·{' '}
          <span className="money">
            {DateTime.fromISO(reg.starts_on).toFormat('dd/MM')}
          </span>
        </p>

        <div className="card mt-6">
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-fg-muted">מספר הרשמה</span>
            <span className="money font-bold">#{reg.code}</span>
          </div>

          {reg.lines && reg.lines.length > 0 && (
            <ul className="mt-3 flex flex-col gap-2 border-t border-line pt-3">
              {reg.lines.map((l, i) => (
                <li key={i} className="flex items-baseline gap-2 text-sm">
                  <span className="clock text-fg-subtle">{l.qty}×</span>
                  <span className="min-w-0 flex-1">
                    {l.type}
                    <span className="text-fg-subtle"> · {l.meal}</span>
                  </span>
                  <span className="money text-[.85rem]">{l.line} ₪</span>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-3 flex justify-between border-t border-line pt-3 font-bold">
            <span>סה״כ</span>
            <span className="money">{reg.total_ils} ₪</span>
          </div>

          {!reg.paid_at && Number(reg.total_ils) > 0 && (
            <p className="mt-3 rounded-input bg-accent-soft px-3 py-2 text-[.82rem]">
              התשלום מתבצע במקום. אם קשה — פשוט בואו, נסתדר.
            </p>
          )}
        </div>

        <p className="mt-5 text-center text-[.8rem] text-fg-subtle">
          שמרו את הקישור הזה.
          <br />
          צריך לשנות משהו?{' '}
          <a href={wa} target="_blank" rel="noopener noreferrer" className="font-medium text-accent-strong hover:underline">
            כתבו לנו
          </a>
          {' · '}
          <Link href="/shabbat" className="font-medium text-accent-strong hover:underline">
            לשבתות הבאות
          </Link>
        </p>
      </div>
    </main>
  );
}
