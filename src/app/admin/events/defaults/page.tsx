import Link from 'next/link';
import { getEventTemplate } from '@/lib/data/event-template';
import { TemplateEditor } from '@/components/admin/template-editor';

export const dynamic = 'force-dynamic';

export default async function EventDefaultsPage() {
  const template = await getEventTemplate();

  return (
    <div>
      <div className="mb-6">
        <Link href="/admin/events" className="text-[.8rem] text-fg-subtle hover:underline">
          ← חזרה לאירועים
        </Link>
        <h1 className="mt-1 text-2xl font-bold tracking-[-.015em]">הגדרות כל הטפסים</h1>
        <p className="mt-1 max-w-[64ch] text-sm text-fg-muted">
          הסעודות, המחירים והשדות שכל טופס חדש נוצר איתם.
        </p>
      </div>
      <TemplateEditor template={template} />
    </div>
  );
}
