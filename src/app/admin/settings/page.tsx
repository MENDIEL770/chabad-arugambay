import { NotBuiltYet } from '@/components/admin/not-built-yet';
import { TENANT, hasSupabase } from '@/lib/config';

export default function AdminSettingsPage() {
  return (
    <>
      <div className="wrap mb-6">
        <div className="card max-w-[62ch]">
          <p className="eyebrow">מצב נוכחי</p>
          <dl className="mt-3 flex flex-col gap-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-fg-muted">מיקום</dt>
              <dd className="ltr">{TENANT.point.latitude}, {TENANT.point.longitude}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-fg-muted">אזור זמן</dt>
              <dd className="ltr">{TENANT.point.timezone}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-fg-muted">שיטת זמנים</dt>
              <dd>אדמו״ר הזקן · הדלקה 18 דק׳</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-fg-muted">Supabase</dt>
              <dd>{hasSupabase() ? 'מחובר' : 'לא מוגדר'}</dd>
            </div>
          </dl>
        </div>
      </div>

      <NotBuiltYet
        title="הגדרות"
        summary="מיתוג, דומיין, מיילים, סליקה, לוח וזמנים, משתמשים והרשאות."
        willInclude={[
          'מיתוג: לוגואים, צבעים, תמונת שיתוף',
          'סליקה: בחירת ספק, מפתחות מוצפנים, קישורי תשלום',
          'לוח וזמנים: ייבוא CSV, עריכת שורה, חישוב מחדש לשנה',
          'ערכים דינמיים למיילים ולטפסים',
          'משתמשים ותפקידים, ו-PIN למסכי מטבח ושליחים',
        ]}
        blockedBy="מפתחות הסליקה, ו-Green API למשלוח הודעות."
      />
    </>
  );
}
