import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getEventById } from '@/lib/data/events';
import { EventEditor } from '@/components/admin/event-editor';

export const dynamic = 'force-dynamic';

export default async function EditEventPage({ params }: PageProps<'/admin/events/[id]/edit'>) {
  const { id } = await params;
  const event = await getEventById(id);
  if (!event) notFound();

  return (
    <div>
      <div className="mb-6">
        <Link href="/admin/events" className="text-[.8rem] text-fg-subtle hover:underline">
          ← חזרה לאירועים
        </Link>
        <h1 className="mt-1 text-2xl font-bold tracking-[-.015em]">{event.title.he}</h1>
        <p className="mt-1 max-w-[64ch] text-sm text-fg-muted">
          עריכה של הטופס הזה בלבד. שינוי כאן מסמן את האירוע כ״נערך ידנית״,
          והמחולל הלילי לא ייגע בו יותר.
        </p>
      </div>
      <EventEditor event={event} />
    </div>
  );
}
