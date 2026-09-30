import { NotBuiltYet } from '@/components/admin/not-built-yet';

export default function AdminOrdersPage() {
  return (
    <NotBuiltYet
      title="הזמנות"
      summary="לוח ההזמנות החי של המסעדה, ממקבלת ההזמנה ועד המסירה."
      willInclude={[
        'קנבן: חדשות ← במטבח ← מוכנות ← במשלוח ← הושלמו, ב-Realtime',
        'קבלה עם ETA, דחייה עם סיבה, ביטול פריט והחזר',
        'צליל בהזמנה חדשה והתראה על הזמנה שלא אושרה',
        'הדפסה למטבח ולדלפק, והדפסה חוזרת',
        'מסך מטבח (KDS) ומסך שליחויות בנפרד',
        'מזומן שנגבה מול צפוי, לפי נהג',
      ]}
      blockedBy="הטבלאות כבר קיימות (0003). צריך את חיבור ה-Realtime ואת תור ההדפסה."
    />
  );
}
