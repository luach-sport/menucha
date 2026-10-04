/*
 * הגדרות האתר — זה הקובץ היחיד שצריך לערוך אחרי ההעלאה ל-GitHub.
 * אין כאן סודות: הקובץ ציבורי. טוקנים ומפתחות נשמרים רק ב-Secrets של GitHub
 * ובמשתני הסביבה של הממסר (ראו README).
 */
window.SITE_CONFIG = {
  siteName: 'מנוחה',
  siteTagline: 'דירות לשבתות ולסופי שבוע',

  // כתובת הממסר (Cloudflare Worker חינמי) שמעביר טפסים ל-GitHub Actions.
  // כל עוד השדה ריק, טופס השריון יציע לשלוח את הבקשה למנהל בוואטסאפ.
  relayUrl: '',

  // וואטסאפ של המנהל — לכפתור "שאלה בוואטסאפ" ולגיבוי כשאין ממסר. פורמט בינלאומי בלי +
  managerWhatsApp: '972500000000',
  managerPhoneDisplay: '050-0000000',

  // לממשק המנהל (admin.html)
  github: {
    owner: 'luach-sport',         // שם המשתמש או הארגון ב-GitHub
    repo: 'menucha',             // הרפוזיטורי של האתר
    branch: 'main',
    crmRepo: ''                  // רפוזיטורי פרטי לפניות, למשל 'menucha-crm'. ריק = אותו רפוזיטורי
  },

  // האם טופס בעלי הדירות דורש קוד גישה (את הקוד עצמו מגדירים בממסר, OWNER_CODE)
  ownerCodeRequired: true,

  // מצב הדגמה: טפסים לא נשלחים לשום מקום, וממשק המנהל עובד על נתוני דוגמה.
  // להעלאה לאוויר: למלא את managerWhatsApp ו-relayUrl ולשנות ל-false
  demoMode: true
};
