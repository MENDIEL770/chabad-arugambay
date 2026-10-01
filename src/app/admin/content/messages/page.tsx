import { getTemplates } from '@/lib/whatsapp/templates';
import { connectionState } from '@/lib/whatsapp/admin';
import { MessageEditor } from '@/components/admin/message-editor';

export const dynamic = 'force-dynamic';

export default async function MessagesPage() {
  const [templates, connection] = await Promise.all([getTemplates(), connectionState()]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-[-.015em]">הודעות ללקוחות</h1>
        <p className="mt-1 max-w-[70ch] text-sm text-fg-muted">
          מה נשלח בוואטסאפ ממספר בית חב״ד, ומתי. אפשר לנסח כל הודעה מחדש,
          לשלב בה פרטים מההזמנה, ולכבות כל אחת בנפרד.
        </p>
      </div>
      <MessageEditor templates={templates} connection={connection} />
    </div>
  );
}
