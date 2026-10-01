import { getReceiptTemplate } from '@/lib/data/receipt-template';
import { ReceiptDesigner } from '@/components/admin/receipt-designer';

export const dynamic = 'force-dynamic';

export default async function ReceiptPage() {
  const template = await getReceiptTemplate();

  return (
    <div className="wrap">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-[-.015em]">עיצוב הקבלה</h1>
        <p className="mt-1 max-w-[62ch] text-sm text-fg-muted">
          מה מודפס בקבלה של הלקוח ובכרטיס שיוצא למטבח. התצוגה מימין היא
          הצורה האמיתית על הנייר.
        </p>
      </div>
      <ReceiptDesigner initial={template} />
    </div>
  );
}
