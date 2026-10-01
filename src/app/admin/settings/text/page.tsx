import { getSiteText } from '@/lib/data/site-text';
import { TextEditor } from '@/components/admin/text-editor';

export const dynamic = 'force-dynamic';

export default async function SiteTextPage() {
  const overrides = await getSiteText();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-[-.015em]">טקסטים באתר</h1>
        <p className="mt-1 max-w-[64ch] text-sm text-fg-muted">
          כל משפט שמופיע בדפים הציבוריים. לכל שדה יש טקסט מקורי בקוד — מה
          שתכתבו כאן מחליף אותו, ומחיקה מחזירה אותו. אי אפשר להישאר עם דף ריק.
        </p>
      </div>
      <TextEditor overrides={overrides} />
    </div>
  );
}
