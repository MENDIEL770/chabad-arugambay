import { Suspense } from 'react';
import { getReport, rangeFor, type Preset } from '@/lib/data/reports';
import { ReportView } from '@/components/admin/report-view';

export const dynamic = 'force-dynamic';

const PRESETS = ['today', 'week', 'month', 'quarter', 'year', 'custom'] as const;

export default async function ReportsPage({ searchParams }: PageProps<'/admin/reports'>) {
  const sp = await searchParams;

  const raw = typeof sp.preset === 'string' ? sp.preset : 'month';
  const preset: Preset = (PRESETS as readonly string[]).includes(raw)
    ? (raw as Preset)
    : 'month';

  const { from, to } = rangeFor(
    preset,
    typeof sp.from === 'string' ? sp.from : undefined,
    typeof sp.to === 'string' ? sp.to : undefined,
  );

  const report = await getReport(from, to);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-[-.015em]">דוחות</h1>
        <p className="mt-1 max-w-[68ch] text-sm text-fg-muted">
          מכירות המסעדה לפי יום, חודש או שנה, ולפי מנה. הכל נספר לפי שעון
          סרי לנקה, והזמנות שבוטלו או נדחו לא נכנסות להכנסות.
        </p>
      </div>

      {/* useSearchParams in the view needs a boundary. */}
      <Suspense fallback={<p className="text-sm text-fg-muted">טוען…</p>}>
        <ReportView report={report} preset={preset} />
      </Suspense>
    </div>
  );
}
