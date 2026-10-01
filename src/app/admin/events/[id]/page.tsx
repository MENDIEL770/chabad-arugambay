import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getEventRegistrations } from '@/lib/data/registrations';
import { Icon } from '@/components/ui/icon';

export const dynamic = 'force-dynamic';

const ils = (n: number) => `${n.toLocaleString('he-IL')} ₪`;

export default async function EventRegistrationsPage({
  params,
}: PageProps<'/admin/events/[id]'>) {
  const { id } = await params;
  const data = await getEventRegistrations(id);
  if (!data) notFound();

  const { totals, meals, rows } = data;

  return (
    <div>
      {/* The whole header collapses when printing; the sheet that goes to
          the kitchen should be counts and names, nothing else. */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4 print:hidden">
        <div>
          <Link href="/admin/events" className="text-[.8rem] text-fg-subtle hover:underline">
            ← חזרה לאירועים
          </Link>
          <h1 className="mt-1 text-2xl font-bold tracking-[-.015em]">{data.title}</h1>
          <p className="mt-1 text-sm text-fg-muted">
            {new Date(data.startsOn).toLocaleDateString('he-IL', {
              weekday: 'long', day: 'numeric', month: 'long',
            })}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <a href={`/admin/events/${id}/export`} className="btn btn-accent btn-sm">
            <Icon name="arrow" size={15} />
            ייצוא לאקסל
          </a>
          {/* Printing is the browser's job; a PDF endpoint would be a
              server-side renderer to maintain for no added benefit. */}
          <Link href={`/admin/events/${id}?print=1`} className="btn btn-ghost btn-sm">
            גיליון להדפסה
          </Link>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-4 gap-3 max-[760px]:grid-cols-2 print:hidden">
        {[
          { label: 'הרשמות', value: String(totals.registrations) },
          { label: 'סועדים בשיא', value: String(totals.people), hint: 'הסעודה העמוסה ביותר' },
          { label: 'הכנסות', value: ils(totals.revenueIls) },
          { label: 'לא שולם', value: String(totals.unpaid), hint: 'הרשמות ללא תשלום' },
        ].map((k) => (
          <div key={k.label} className="card !p-4">
            <p className="eyebrow">{k.label}</p>
            <p className="mt-1.5 text-[1.7rem] font-bold leading-none tracking-[-.02em]">
              {k.value}
            </p>
            {k.hint && <p className="mt-1 text-[.74rem] text-fg-subtle">{k.hint}</p>}
          </div>
        ))}
      </div>

      <h2 className="mb-3 text-lg font-bold">כמה לכל סעודה</h2>
      <div className="mb-8 overflow-x-auto">
        <table className="w-full min-w-[520px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-line text-start text-[.78rem] text-fg-subtle">
              <th className="p-2.5 text-start font-medium">סעודה</th>
              <th className="p-2.5 text-start font-medium">פירוט</th>
              <th className="p-2.5 text-start font-medium">סועדים</th>
              <th className="p-2.5 text-start font-medium">קיבולת</th>
            </tr>
          </thead>
          <tbody>
            {meals.map((m) => {
              const over = m.capacity !== null && m.seats > m.capacity;
              return (
                <tr key={m.mealId} className="border-b border-line last:border-b-0">
                  <td className="p-2.5 font-medium">{m.mealName}</td>
                  <td className="p-2.5 text-fg-muted">
                    {m.byType.length === 0
                      ? '—'
                      : m.byType.map((t) => `${t.qty} ${t.typeName}`).join(' · ')}
                  </td>
                  <td className="clock p-2.5 font-bold">{m.seats}</td>
                  <td className="p-2.5">
                    {m.capacity === null ? (
                      <span className="text-fg-subtle">ללא הגבלה</span>
                    ) : (
                      <span className={over ? 'font-medium text-danger' : ''}>
                        <span className="clock">{m.capacity}</span>
                        {over && ' — חריגה'}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
            {meals.length === 0 && (
              <tr>
                <td colSpan={4} className="p-4 text-center text-fg-muted">
                  לא הוגדרו סעודות לאירוע הזה.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <h2 className="mb-3 text-lg font-bold">
        הנרשמים <span className="clock text-fg-subtle">({rows.length})</span>
      </h2>

      {rows.length === 0 ? (
        <p className="card text-sm text-fg-muted">עוד אין הרשמות לאירוע הזה.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-line text-[.78rem] text-fg-subtle">
                <th className="p-2.5 text-start font-medium">קוד</th>
                <th className="p-2.5 text-start font-medium">שם</th>
                <th className="p-2.5 text-start font-medium print:hidden">טלפון</th>
                <th className="p-2.5 text-start font-medium">סעודות</th>
                <th className="p-2.5 text-start font-medium print:hidden">סה״כ</th>
                <th className="p-2.5 text-start font-medium print:hidden">שולם</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-line align-top last:border-b-0">
                  <td className="clock p-2.5 text-fg-subtle">{r.code}</td>
                  <td className="p-2.5">
                    <span className="font-medium">{r.fullName}</span>
                    {r.participants.length > 0 && (
                      <ul className="mt-0.5 text-[.76rem] text-fg-subtle">
                        {r.participants.map((p, i) => (
                          <li key={i}>
                            {p.name}
                            {p.mealChoice && ` — ${p.mealChoice}`}
                          </li>
                        ))}
                      </ul>
                    )}
                    {r.notes && (
                      <p className="mt-1 text-[.76rem] text-accent-strong">{r.notes}</p>
                    )}
                  </td>
                  <td className="p-2.5 print:hidden">
                    <a href={`tel:${r.phone}`} className="ltr block hover:underline">{r.phone}</a>
                  </td>
                  <td className="p-2.5 text-fg-muted">
                    {r.perMeal.map((p, i) => (
                      <span key={i} className="block text-[.8rem]">
                        {p.mealName}: {p.qty} {p.typeName}
                      </span>
                    ))}
                  </td>
                  <td className="p-2.5 print:hidden">
                    <span className="clock">{ils(r.totalIls)}</span>
                  </td>
                  <td className="p-2.5 print:hidden">
                    <span className={`chip ${r.paidAt ? 'chip-kosher' : 'chip-out'}`}>
                      {r.paidAt ? 'שולם' : 'לא'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
