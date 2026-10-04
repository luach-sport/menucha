'use strict';
/*
 * מופעל ע"י .github/workflows/lead.yml כשמגיעה בקשת שריון מהאתר.
 * 1. בודק שוב את הנתונים (אסור לסמוך על הדפדפן)
 * 2. מחשב מחדש את המחיר ובודק התנגשות עם הזמנות מאושרות
 * 3. פותח Issue עם התגית New Lead (ב-CRM הפרטי אם הוגדר)
 * 4. שולח התראה למנהל
 */

const {
  Pricing, Validate, loadApartments, loadBlocked, crmTarget, siteUrl, summary, setOutput,
  dateRange, guestsText, md, maskName
} = require('./lib/site');
const { gh, ensureLabels, LEAD_LABELS } = require('./lib/github');
const { notifyManager } = require('./lib/notify');

async function main() {
  const payload = JSON.parse(process.env.PAYLOAD || '{}');
  const raw = payload.lead || {};
  const meta = payload.meta || {};

  if (Validate.looksLikeBot(raw)) {
    console.log('נראה כמו ספאם (שדה מלכודת) — מדלג.');
    return;
  }
  const check = Validate.validateLead(raw);
  if (!check.ok) {
    console.log(`::warning::פניה לא תקינה נדחתה: ${JSON.stringify(check.errors)}`);
    return;
  }
  const lead = check.value;

  const apartment = loadApartments().find((a) => a.id === lead.apartmentId);
  const quote = apartment ? Pricing.quote(apartment, lead) : null;
  const blocked = loadBlocked()[lead.apartmentId] || [];
  const conflict = !Pricing.isAvailable(blocked, lead.checkin, lead.checkout);

  let target = null;
  let saveError = null;
  try { target = crmTarget(); } catch (e) { saveError = e; console.error(`::error::${e.message}`); }
  // אם אי אפשר לדעת אם הרפוזיטורי פרטי — מתנהגים כאילו הוא ציבורי
  const repoInfo = target ? await gh('GET', `/repos/${target.repo}`, { token: target.token }).catch(() => null) : null;
  const isPublic = !repoInfo || !repoInfo.private;

  const shown = isPublic
    ? { name: maskName(lead.name), phone: Validate.maskPhone(lead.phone), email: Validate.maskEmail(lead.email) }
    : { name: lead.name, phone: lead.phone, email: lead.email };

  const aptTitle = apartment ? apartment.title : `דירה לא מוכרת (${lead.apartmentId})`;
  const aptPlace = apartment ? [apartment.neighborhood, apartment.city].filter(Boolean).join(', ') : '';
  const total = quote ? quote.total : lead.quotedTotal;
  const site = siteUrl();

  const notes = [];
  if (!apartment) notes.push('> ⚠️ הדירה לא נמצאה באתר — ייתכן שהוסרה.');
  if (conflict) notes.push('> ⚠️ **התאריכים חופפים להזמנה שכבר אושרה בדירה הזו.**');
  if (quote && !quote.ok) notes.push(`> ⚠️ ${quote.errors.map(md).join(' · ')}`);
  if (quote && quote.warnings.length) notes.push(`> ℹ️ ${quote.warnings.map(md).join(' · ')}`);
  if (quote && lead.quotedTotal && Math.abs(lead.quotedTotal - quote.total) > 1) {
    notes.push(`> ℹ️ הלקוח ראה באתר ${Pricing.formatMoney(lead.quotedTotal)}; החישוב המעודכן הוא ${Pricing.formatMoney(quote.total)}.`);
  }
  if (isPublic) {
    notes.push('> 🔒 הרפוזיטורי הזה ציבורי, ולכן פרטי הקשר מוסתרים כאן. הפרטים המלאים נשלחו אליך בהתראה. מומלץ להגדיר רפוזיטורי פרטי לפניות (README, שלב 4).');
  }

  const priceDetails = quote && quote.lines.length
    ? ['<details><summary>פירוט המחיר</summary>', '', '| | | |', '|---|---|---:|',
      ...quote.lines.map((l) => `| ${md(l.label)} | ${md(l.detail)} | ${Pricing.formatMoney(l.amount)} |`),
      `| **סה״כ** | | **${Pricing.formatMoney(quote.total)}** |`, '', '</details>'].join('\n')
    : '';

  const booking = {
    apartmentId: lead.apartmentId,
    checkin: lead.checkin,
    checkout: lead.checkout,
    guests: lead.guests,
    infants: lead.infants,
    total,
    name: shown.name,
    phone: isPublic ? '' : lead.phone,
    email: isPublic ? '' : lead.email,
    source: 'website',
    receivedAt: meta.receivedAt || new Date().toISOString()
  };

  const body = [
    '### בקשת שריון חדשה מהאתר',
    '',
    '| | |',
    '|---|---|',
    `| **שם** | ${md(shown.name)} |`,
    `| **טלפון** | ${md(shown.phone)} |`,
    `| **אימייל** | ${md(shown.email)} |`,
    `| **דירה** | ${apartment ? `[${md(aptTitle)}](${site}property.html#${apartment.id})` : md(aptTitle)}${aptPlace ? ` — ${md(aptPlace)}` : ''} |`,
    `| **תאריכים** | ${dateRange(lead.checkin, lead.checkout)} |`,
    `| **אורחים** | ${guestsText(lead.guests, lead.infants)} |`,
    `| **מחיר משוער** | ${Pricing.formatMoney(total)} |`,
    '',
    priceDetails,
    '',
    ...notes,
    '',
    '**מה עכשיו?** מתקשרים ללקוח. אם סגרתם — מעבירים את הפניה ל-`Approved` (בממשק הניהול או בתגיות כאן), והתאריכים ייחסמו באתר. אם לא — `Closed`.',
    '',
    `<!-- menucha-booking ${JSON.stringify(booking)} -->`
  ].join('\n');

  const dm = (iso) => `${Number(iso.slice(8))}.${Number(iso.slice(5, 7))}`;
  const title = `🏠 ${shown.name} · ${aptTitle} · ${dm(lead.checkin)}–${dm(lead.checkout)}`;

  // גם אם שמירת ה-Issue נכשלת, ההתראה למנהל יוצאת — כדי שאף פניה לא תלך לאיבוד
  let issue = null;
  if (target) {
    try {
      await ensureLabels(target.repo, LEAD_LABELS, target.token);
      issue = await gh('POST', `/repos/${target.repo}/issues`, {
        token: target.token,
        body: { title: title.slice(0, 240), body, labels: ['New Lead'] }
      });
      console.log(`נפתחה פניה #${issue.number}: ${issue.html_url}`);
      setOutput('issue_url', issue.html_url);
    } catch (e) {
      saveError = e;
      console.error(`::error::לא הצלחתי לפתוח Issue ב-${target.repo}: ${e.message}`);
    }
  }

  // ---------- התראה למנהל (עם הפרטים המלאים) ----------
  const text = [
    `🏠 בקשת שריון חדשה`,
    `שם: ${lead.name}`,
    `טלפון: ${lead.phone}`,
    `אימייל: ${lead.email}`,
    `דירה: ${aptTitle}${aptPlace ? ` (${aptPlace})` : ''}`,
    `תאריכים: ${dateRange(lead.checkin, lead.checkout)}`,
    `אורחים: ${guestsText(lead.guests, lead.infants)}`,
    `מחיר משוער: ${Pricing.formatMoney(total)}`,
    conflict ? '⚠️ חופף להזמנה מאושרת!' : '',
    issue ? `פניה #${issue.number}: ${issue.html_url}` : '⚠️ הפניה לא נשמרה ב-GitHub — בדקו את יומן הריצה ב-Actions'
  ].filter(Boolean).join('\n');
  const voice = `בקשת שריון חדשה מ${lead.name}, לדירה ${aptTitle}. הטלפון: ${lead.phone.split('').join(' ')}.`;
  const results = await notifyManager({ text, voice });

  summary([
    `### פניה חדשה: ${md(shown.name)}`,
    `- דירה: ${md(aptTitle)}`,
    `- תאריכים: ${dateRange(lead.checkin, lead.checkout)}`,
    `- מחיר: ${Pricing.formatMoney(total)}`,
    `- Issue: ${issue ? issue.html_url : '❌ לא נשמר'}`,
    `- התראות: ${results.length ? results.map((r) => `${r.ok ? '✅' : '❌'} ${r.channel}`).join(', ') : 'לא הוגדרו'}`
  ].join('\n'));

  if (saveError) process.exit(1);
}

main().catch((e) => {
  console.error(`::error::${e.message}`);
  process.exit(1);
});
