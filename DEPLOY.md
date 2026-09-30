# העלאה לאוויר

מ-0 עד אתר חי. בערך 40 דקות, רובן המתנה.

הסדר חשוב: **Supabase לפני Vercel**, כי Vercel צריך את המפתחות.

---

## 1. Supabase (15 דק׳)

1. פתחו פרויקט ב-[supabase.com](https://supabase.com) → **New project**.
   - Region: **Singapore** (`ap-southeast-1`) — הכי קרוב לסרי לנקה, חוסך ~200ms בכל בקשה.
   - שמרו את סיסמת ה-DB במקום בטוח.
2. **SQL Editor** → הריצו לפי הסדר, כל קובץ בנפרד:
   ```
   supabase/migrations/0001_core.sql
   supabase/migrations/0002_calendar.sql
   supabase/migrations/0003_restaurant.sql
   supabase/migrations/0004_rls.sql
   supabase/seed.sql
   ```
3. **Authentication → Users → Add user** — צרו משתמש עם המייל שלכם.
4. חזרו ל-SQL Editor והריצו את השורה האחרונה ב-`seed.sql` (המוערת) עם המייל שלכם.
   **בלי זה אתם לא בעלים ו-RLS יחסום כל עריכה — גם שלכם.**
5. **Project Settings → API** — העתיקו:
   - `Project URL`
   - `anon public`
   - `service_role` ← **סודי.** לא ב-Git, לא בצד לקוח, לא בוואטסאפ.

## 2. Vercel (10 דק׳)

```bash
cd ~/chabad-arugambay
git remote add origin https://github.com/<user>/chabad-arugambay.git
git push -u origin main
```

ב-[vercel.com](https://vercel.com) → **Add New → Project** → בחרו את הריפו.
Next.js מזוהה אוטומטית; אל תשנו את הגדרות הבנייה.

**Environment Variables** — הוסיפו לפני ה-Deploy הראשון:

| שם | ערך | סביבות |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL | all |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon public | all |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role | **Production + Preview בלבד** |
| `TENANT_ID` | `00000000-0000-0000-0000-000000000001` | all |

לחצו **Deploy**.

## 3. דומיין (10 דק׳ + המתנה ל-DNS)

Vercel → Project → **Settings → Domains** → הוסיפו `chabadarugambay.com`.
Vercel יראה אילו רשומות להגדיר אצל רשם הדומיין:

```
A      @      76.76.21.21
CNAME  www    cname.vercel-dns.com
```

התעודה נוצרת לבד. אם לא תוך שעה — בדקו את ה-DNS.

## 4. בדיקה שהכול חי

- `/` — דף הבית עם זמני השבת/חג הקרובים
- `/menu` — התפריט. הזמינו פלאפל **בלי בצל** וודאו שזה מופיע בעגלה
- `/admin` — **אסור** שיופיע הבאנר הכתום של מצב הדגמה
- `/admin/restaurant/menu` — שנו מחיר, שמרו, רעננו את `/menu`. השינוי חייב להופיע
- העלו תמונה למנה. אם נכשל — ראו למטה

---

## תקלות נפוצות

**הבאנר הכתום עדיין מופיע** — משתני הסביבה לא הגיעו לבנייה.
ב-Vercel: Deployments → ⋯ → **Redeploy**. משתנה חדש לא חל על בנייה קיימת.

**"new row violates row-level security"** — לא הרצתם את שורת ה-`memberships`
בסוף `seed.sql`, או שהרצתם אותה לפני שיצרתם את המשתמש.

**העלאת תמונה נכשלת** — ודאו שה-bucket `menu` קיים (Storage) ושהמדיניות
נוצרה. `0004_rls.sql` יוצר את שניהם; אם הרצתם אותו לפני `0003` הוא נכשל
באמצע — הריצו אותו שוב.

**הזמנים זזים בדקה או שתיים** — הכיול מתועד ב-`README.md`. לא באג בפריסה.

---

## מה עדיין לא מחובר

הדברים האלה מוגדרים בקוד מאחורי ממשק, אבל אין להם credentials:

| מה | מה צריך | בלי זה |
|---|---|---|
| **Green API** (וואטסאפ) | instance ID + token מ-green-api.com | אין עדכוני הזמנה ללקוח |
| **סליקה** | קשר / נדרים / Stripe | אין תשלום אונליין; מזומן לנהג עובד |
| **PickMe Flash** | חשבון Corporate + API key | משלוחים עם נהגים פנימיים עובדים |
| **Booking** | partner id | ההמלצות מוצגות בלי קישורי שותף |

אף אחד מהם לא חוסם העלאה לאוויר. האתר, התפריט, ההזמנה והניהול עובדים בלעדיהם.

## אחרי שזה באוויר

הכניסו את המספרים האמיתיים דרך `/admin/restaurant/menu` — מחירים, מלאי,
ותמונות של המנות. seed הוא נקודת התחלה, לא התפריט שלכם.
