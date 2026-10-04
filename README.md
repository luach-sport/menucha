# מנוחה — אתר תיווך דירות לשבתות ולסופי שבוע

אתר סטטי שיושב על GitHub Pages, עם מנוע חיפוש, מחשבון מחיר לכל דירה, טופס בקשת שריון, טופס לבעלי דירות וממשק ניהול. האוטומציות רצות ב-GitHub Actions, הפניות נשמרות כ-Issues, והתראות יוצאות לוואטסאפ או לטלגרם. עלות חודשית: 0 ₪.

הדירות שבאתר הן **דוגמה** (כולל איורים במקום תמונות). לפני העלייה לאוויר מחליפים אותן — ראו "לפני שמעלים לאוויר" למטה.

---

## איך זה עובד

```
גולש באתר ──► טופס שריון ──► ממסר (Cloudflare Worker, חינם) ──► GitHub Actions
                                                                   ├─ Issue חדש עם התגית New Lead
                                                                   └─ הודעת וואטסאפ / טלגרם / שיחה קולית למנהל

בעל דירה ──► add-property.html ──► ממסר ──► GitHub Actions ──► Pull Request עם קובץ הדירה
                                                                  (הדירה עולה לאתר רק אחרי Merge)

מנהל ──► admin.html ──► GitHub API: גרירת פניות בין "חדשות / מאושרות / סגורות",
                         יומן תפוסה לכל הדירות, אישור דירות חדשות בלחיצה

פניה שמסומנת Approved ──► Action של סנכרון ──► data/availability.json ──► התאריכים נחסמים באתר
```

**למה צריך ממסר?** עמוד ב-GitHub Pages הוא קובץ פתוח. אם נכניס אליו טוקן של GitHub, כל גולש יוכל להעתיק אותו. הממסר (Cloudflare Worker במסלול החינמי) מחזיק את הטוקן בסוד, בודק את הטופס, מסנן ספאם ומפעיל את ה-Action. כל עוד הממסר לא מוגדר, האתר עובד: טופס השריון מציע ללקוח לשלוח את אותה בקשה בוואטסאפ, עם הודעה מוכנה.

## מבנה התיקיות

```
index.html              עמוד הבית: זמני השבת הקרובה, חיפוש ותוצאות עם מחיר אמיתי
property.html           עמוד דירה: גלריה, אבזור, לוח תפוסה, מחשבון מחיר, טופס שריון
add-property.html       טופס לבעלי דירות (לא מקושר מהאתר, noindex)
admin.html              ממשק ניהול (נכנסים עם טוקן GitHub, noindex)
assets/
  css/style.css         כל העיצוב, כולל מצב כהה ומובייל
  js/config.js          ← ההגדרות שלכם (הקובץ היחיד שחובה לערוך)
  js/pricing.js         מנוע התמחור — משותף לאתר ול-Actions
  js/validate.js        בדיקת טלפון ישראלי, אימייל, מלכודת ספאם — משותף לאתר ול-Actions
  js/zmanim.js          זמני הדלקת נרות וצאת שבת ותאריך עברי (בלי שירות חיצוני)
  js/amenities.js       רשימת האבזור (פלטה, מיחם, שעוני שבת…)
  js/icons.js           אייקונים
  js/common.js          כלים משותפים לעמודים
  js/search.js, property.js, add-property.js, admin.js
  img/apartments/<id>/  תמונות הדירות
data/
  apartments/<id>.json  קובץ לכל דירה — כאן עורכים
  apartments.json       נבנה אוטומטית מכל הקבצים שלמעלה (לא לערוך ידנית)
  availability.json     תאריכים תפוסים — נבנה אוטומטית מהפניות המאושרות
scripts/                הקוד שרץ ב-GitHub Actions (Node, בלי תלויות)
.github/workflows/
  lead.yml              פניה חדשה → Issue + התראה
  property-submission.yml  דירה מבעלים → Pull Request
  build-data.yml        עדכון data/apartments.json אחרי שינוי בדירה
  sync-availability.yml סנכרון התפוסה (כל חצי שעה, ומיד אחרי שינוי בממשק הניהול)
relay/worker.js         הממסר ל-Cloudflare
```

---

## התקנה, שלב אחרי שלב

### שלב 1 — רפוזיטורי ו-GitHub Pages

1. צרו רפוזיטורי **ציבורי** חדש ב-GitHub (למשל `menucha`) והעלו אליו את כל הקבצים. ב-GitHub Pages בחשבון חינמי הרפוזיטורי חייב להיות ציבורי, ולכן שום מידע אישי לא נשמר בו (ראו שלב 4).
2. **Settings ← Pages**: תחת Source בחרו `Deploy from a branch`, ענף `main`, תיקייה `/ (root)`. אחרי דקה-שתיים האתר יהיה בכתובת `https://<user>.github.io/menucha/`.
3. **Settings ← Actions ← General**, בתחתית העמוד (Workflow permissions):
   - סמנו **Read and write permissions**
   - סמנו **Allow GitHub Actions to create and approve pull requests** (בלי זה טופס בעלי הדירות לא יוכל לפתוח בקשת אישור)

### שלב 2 — הגדרות האתר

ערכו את `assets/js/config.js` (אפשר ישירות באתר של GitHub, עם העיפרון):

| שדה | מה לשים |
|---|---|
| `siteName` | שם האתר |
| `managerWhatsApp` | מספר הוואטסאפ שלכם בפורמט בינלאומי, בלי + (למשל `972501234567`) |
| `managerPhoneDisplay` | המספר כפי שיוצג באתר (`050-1234567`) |
| `github.owner` | שם המשתמש שלכם ב-GitHub |
| `github.repo` | שם הרפוזיטורי של האתר |
| `github.crmRepo` | שם הרפוזיטורי הפרטי לפניות (שלב 4). ריק = אותו רפוזיטורי |
| `relayUrl` | כתובת הממסר (שלב 3). עד אז השאירו ריק |
| `ownerCodeRequired` | `true` אם טופס בעלי הדירות דורש קוד (מומלץ) |

### שלב 3 — הממסר ב-Cloudflare (חינם)

1. **צרו טוקן לממסר** ב-GitHub: ‏Settings ← Developer settings ← Personal access tokens ← **Fine-grained tokens** ← Generate new token.
   - Repository access: **Only select repositories** ← רפוזיטורי האתר בלבד.
   - Permissions ← Repository permissions ← **Contents: Read and write** (זו ההרשאה ש-GitHub דורש כדי להפעיל Action מבחוץ). שום הרשאה אחרת.
   - קבעו תוקף (למשל שנה) ושימו תזכורת לחדש.
2. היכנסו ל-[Cloudflare](https://dash.cloudflare.com/sign-up) (חשבון חינמי) ← **Workers & Pages** ← **Create** ← **Create Worker** ← תנו שם (למשל `menucha-relay`) ← **Deploy**.
3. **Edit code**: מחקו את מה שיש, הדביקו את כל התוכן של `relay/worker.js`, ולחצו **Deploy**.
4. **Settings ← Variables and Secrets** של ה-Worker:
   - `GITHUB_REPO` (Text): `<user>/menucha`
   - `ALLOWED_ORIGINS` (Text): `https://<user>.github.io` — בלי נתיב ובלי `/` בסוף. (אם יש לכם דומיין משלכם, הוסיפו אותו אחרי פסיק.)
   - `GITHUB_TOKEN` (**Secret**): הטוקן מסעיף 1
   - `OWNER_CODE` (**Secret**, לא חובה): קוד שתיתנו לבעלי דירות, למשל `shabbat2026`
5. העתיקו את כתובת ה-Worker (`https://menucha-relay.<something>.workers.dev`) לשדה `relayUrl` ב-`config.js`.
6. בדיקה: פתחו את כתובת ה-Worker בדפדפן. אמורים לראות `"configured": true`.

### שלב 4 — רפוזיטורי פרטי לפניות (מומלץ מאוד)

שמות, טלפונים ואימיילים של לקוחות לא צריכים להיות גלויים לכל העולם. לכן הפניות נשמרות ברפוזיטורי **פרטי** נפרד (רפוזיטורי פרטי ב-GitHub הוא חינמי).

1. צרו רפוזיטורי **פרטי** ריק, למשל `menucha-crm`.
2. **צרו טוקן ניהול** (Fine-grained, כמו בשלב 3) עם גישה **לשני הרפוזיטורים** והרשאות:
   - Issues: Read and write
   - Pull requests: Read and write
   - Contents: Read and write
   - Actions: Read and write
3. ברפוזיטורי **של האתר**: ‏Settings ← Secrets and variables ← Actions:
   - לשונית **Variables** ← `CRM_REPO` = `menucha-crm`
   - לשונית **Secrets** ← `CRM_TOKEN` = טוקן הניהול
4. ב-`config.js`: ‏`github.crmRepo: 'menucha-crm'`.

אותו טוקן ניהול משמש גם לכניסה ל-`admin.html` (שלב 6).

> אם מדלגים על השלב הזה, הפניות נפתחות ברפוזיטורי של האתר, והמערכת מזהה שהוא ציבורי ו**מסתירה** בו את הטלפון והאימייל (`052-•••••67`). הפרטים המלאים מגיעים אליכם רק בהתראה.

### שלב 5 — התראות לטלפון

אפשר להגדיר ערוץ אחד או כמה. כל ערוץ נדלק ברגע שמגדירים לו Secrets, ברפוזיטורי של האתר (Settings ← Secrets and variables ← Actions).

**וואטסאפ (CallMeBot)**
1. עקבו אחרי ההוראות העדכניות ב-[callmebot.com — WhatsApp](https://www.callmebot.com/blog/free-api-whatsapp-messages/): מוסיפים את המספר של הבוט לאנשי הקשר, שולחים לו את המשפט `I allow callmebot to send me messages`, ומקבלים מפתח (apikey).
2. Secrets: ‏`CALLMEBOT_WHATSAPP_PHONE` = ‏`+972501234567`, ‏`CALLMEBOT_WHATSAPP_APIKEY` = המפתח.

**טלגרם — הודעה או שיחה קולית (CallMeBot)**
1. שלחו `/start` לבוט `@CallMeBot_txtbot` בטלגרם (פירוט ב-[callmebot.com — Telegram](https://www.callmebot.com/blog/telegram-text-messages/)).
2. Secret: ‏`CALLMEBOT_TELEGRAM_USER` = שם המשתמש שלכם בטלגרם, עם @.
3. רוצים **שיחה קולית** במקום הודעה? Variable ‏`CALLMEBOT_VOICE_CALL` = ‏`true`. הקול: Variable ‏`CALLMEBOT_VOICE` (ברירת מחדל `he-IL-Standard-A`, קול עברי של Google). אם השיחה לא נשמעת בעברית, נסו `he-IL-Standard-B` או `en-US-Standard-B`. גם כשלא עונים, מגיע עותק כתוב.

**טלגרם — בוט רשמי (הכי יציב)**
1. בטלגרם: `@BotFather` ← `/newbot` ← מקבלים טוקן.
2. שלחו הודעה כלשהי לבוט החדש, ואז פתחו בדפדפן `https://api.telegram.org/bot<TOKEN>/getUpdates` ומצאו את `chat.id`.
3. Secrets: ‏`TELEGRAM_BOT_TOKEN`, ‏`TELEGRAM_CHAT_ID`.

> CallMeBot הוא שירות חינמי לשימוש אישי שמתקיים מתרומות, בלי התחייבות לזמינות. מומלץ להגדיר שני ערוצים (למשל וואטסאפ + בוט טלגרם). גם אם כל ההתראות נכשלות, הפניה נשמרת ב-GitHub — ואם שמירת הפניה נכשלת, ההתראה עדיין יוצאת.

### שלב 6 — ממשק הניהול

פתחו `https://<user>.github.io/menucha/admin.html`, הדביקו את טוקן הניהול מ-שלב 4, ובחרו אם לזכור אותו במחשב הזה (רק במחשב אישי).

בלי טוקן העמוד ריק — אין בו שום נתון. כפתור "מצב הדגמה" מציג את הממשק עם נתונים מומצאים, בלי לגעת בכלום.

### שלב 7 — בדיקה

1. שלחו בקשת שריון מהאתר.
2. בלשונית **Actions** ברפוזיטורי של האתר אמורה להופיע ריצה בשם "פניה חדשה מהאתר". אם היא אדומה — לחצו עליה; השגיאה כתובה בעברית.
3. Issue חדש ברפוזיטורי הפניות, והתראה בטלפון.
4. ב-`admin.html` העבירו את הפניה ל"מאושרות". תוך כ-2 דקות התאריכים יופיעו כתפוסים באתר.

---

## עבודה יומיומית

**פניות.** כל פניה היא Issue עם תגית: `New Lead` ← `Approved` ← `Closed`. משנים סטטוס בגרירה ב-`admin.html` (או בבחירה מהרשימה בכרטיס, בטלפון). רק `Approved` חוסם תאריכים באתר. מי שמעדיף את לוח ה-Kanban של GitHub Projects יכול ליצור Project ולהפעיל בו את ה-workflow המובנה **Auto-add to project** עם הסינון `label:"New Lead"` — אבל הסטטוס שקובע את התפוסה באתר הוא התגית.

**חסימת תאריכים ידנית** (הבעלים בדירה, שיפוץ, הזמנה מחוץ לאתר): ‏`admin.html` ← יומן תפוסה ← "חסימה ידנית".

**דירה חדשה מבעלים.** שולחים לבעל הדירה את הקישור `add-property.html` ואת הקוד. נפתח Pull Request עם קובץ הדירה ורשימת בדיקה. מוסיפים תמונות לתיקייה `assets/img/apartments/<id>/` (באותו ענף), מעדכנים את `images` בקובץ, ולוחצים "אישור ופרסום" ב-`admin.html` (או Merge ב-GitHub).

**עריכת דירה קיימת.** עורכים את `data/apartments/<id>.json` ישירות ב-GitHub. אחרי השמירה רץ "עדכון רשימת הדירות", ותוך כמה דקות השינוי באתר. אם יש טעות בקובץ, הריצה נכשלת עם הסבר, והדירה הזו לא מוצגת עד שמתקנים. להסתרה זמנית: `"published": false`.

### חוקי התמחור (`pricing` בקובץ הדירה)

| שדה | משמעות | דוגמה |
|---|---|---|
| `nightly` | מחיר ללילה רגיל | `900` |
| `weekendNightly` | מחיר ללילה בסופ״ש | `1250` |
| `weekendNights` | אילו לילות הם סופ״ש: 4 = ליל חמישי, 5 = ליל שישי, 6 = מוצ״ש | `[4, 5]` |
| `includedGuests` | כמה אורחים כלולים במחיר | `4` |
| `extraGuestPerNight` | תוספת לכל אורח מעבר לכלולים, לכל לילה | `100` |
| `cleaningFee` | דמי ניקיון, פעם אחת | `250` |
| `minNights` | מינימום לילות | `1` |
| `lengthDiscounts` | הנחה לפי אורך שהייה | `[{"minNights": 3, "percent": 10}]` |
| `specialPeriods` | מחיר לחגים; התאריכים הם הלילות עצמם, כולל שני הקצוות | `[{"name": "חנוכה", "from": "2026-12-04", "to": "2026-12-11", "nightly": 1400, "minNights": 2}]` |

לילה נספר לפי התאריך שבו הוא מתחיל: הגעה ביום שישי ויציאה במוצ״ש = לילה אחד, ליל שישי. תינוקות לא נספרים באורחים. אותו קוד (`assets/js/pricing.js`) מחשב את המחיר בדפדפן ובשרת, והמחיר שנרשם בפניה מחושב מחדש בשרת.

### שדות נוספים בקובץ דירה

`geo` (קו רוחב ואורך, לזמני השבת), `candleLightingMinutes` (כמה דקות לפני השקיעה מדליקים — 40 בירושלים, 18 ברוב הערים), `amenities` (רשימת הקודים נמצאת ב-`assets/js/amenities.js`), `highlights`, `houseRules`, `checkInTime`, `checkOutTime`, `images` (`src`, `alt`).

---

## לפני שמעלים לאוויר

- [ ] למחוק את דירות הדוגמה מ-`data/apartments/` ואת האיורים מ-`assets/img/apartments/`, ולהוסיף את הדירות האמיתיות (או לשלוח אותן דרך `add-property.html`).
- [ ] `data/availability.json` מכיל חסימות לדוגמה. הסנכרון הראשון ידרוס אותן לפי הפניות האמיתיות (אפשר להפעיל ידנית: Actions ← סנכרון יומן התפוסה ← Run workflow).
- [ ] לעדכן את `config.js` (שלב 2).
- [ ] להוסיף מדיניות פרטיות קצרה. האתר אוסף שם, טלפון ואימייל, ולכן חל עליו חוק הגנת הפרטיות. מומלץ להתייעץ עם עורך דין לגבי הנוסח.

## מגבלות שכדאי להכיר

- **GitHub Pages** שומר עותק במטמון כ-10 דקות, אז שינויים מופיעים באתר תוך כמה דקות ולא מיד.
- **ריצות מתוזמנות** (הסנכרון כל חצי שעה) מושבתות על ידי GitHub אחרי 60 יום בלי פעילות ברפוזיטורי. אם זה קורה, Actions ← סנכרון יומן התפוסה ← Enable workflow. שינויים מ-`admin.html` מפעילים סנכרון מיד בכל מקרה.
- **Actions** ברפוזיטורי ציבורי — ללא הגבלת דקות. ברפוזיטורי פרטי (אם תעבירו את האתר לחשבון בתשלום) יש מכסה של 2,000 דקות בחודש; אז כדאי לשנות את הסנכרון לפעם בשעה (`cron: '0 * * * *'`).
- **Cloudflare Workers** במסלול החינמי: עד 100,000 בקשות ביום.
- **הממסר** מגביל כל חיבור ל-6 שליחות ב-10 דקות, ומסנן רובוטים עם שדה מלכודת ובדיקת זמן מילוי — בלי קפצ'ה.
- **הטוקנים** פגים בתאריך שקבעתם. כשטוקן הממסר פג, הטפסים ייכשלו והלקוחות יקבלו את אפשרות הוואטסאפ.
- **זמני השבת** מחושבים לפי השקיעה וזווית השמש (צאת שבת = 8.5°), בדיוק של כדקה. הם מוצגים כמשוערים.

## פיתוח מקומי

```bash
python3 -m http.server 8000          # ואז http://localhost:8000
node scripts/build-apartments.js     # אחרי עריכת קובץ דירה
```

כדי לראות את כל האתר בלי לשלוח כלום, שימו `demoMode: true` ב-`config.js`.
