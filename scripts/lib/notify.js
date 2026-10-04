'use strict';
/*
 * התראות חינמיות למנהל. כל ערוץ פעיל רק אם הוגדרו לו Secrets:
 *   WhatsApp דרך CallMeBot:  CALLMEBOT_WHATSAPP_PHONE + CALLMEBOT_WHATSAPP_APIKEY
 *   Telegram דרך CallMeBot:  CALLMEBOT_TELEGRAM_USER (ושיחה קולית אם CALLMEBOT_VOICE_CALL=true)
 *   בוט Telegram רשמי:       TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID
 * כישלון של ערוץ אחד לא מפיל את ה-Workflow.
 */

const enc = encodeURIComponent;

async function call(name, url, init) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  try {
    const res = await fetch(url, { ...(init || {}), signal: ctrl.signal });
    const body = (await res.text()).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160);
    // CallMeBot מחזיר לפעמים 200 עם הודעת שגיאה בגוף התשובה
    const ok = res.ok && !/error|not (been )?activated|invalid|blocked/i.test(body);
    console.log(`${ok ? '✓' : '✗'} ${name}: HTTP ${res.status} ${body}`);
    return { channel: name, ok };
  } catch (e) {
    console.log(`✗ ${name}: ${e.name === 'AbortError' ? 'timeout' : e.message}`);
    return { channel: name, ok: false };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * text  — הודעה מלאה (וואטסאפ / טלגרם)
 * voice — משפט קצר להקראה בשיחה קולית (עד 256 תווים)
 */
async function notifyManager({ text, voice }) {
  const e = process.env;
  const jobs = [];

  if (e.CALLMEBOT_WHATSAPP_PHONE && e.CALLMEBOT_WHATSAPP_APIKEY) {
    const phone = e.CALLMEBOT_WHATSAPP_PHONE.replace(/[^\d+]/g, '');
    jobs.push(call('WhatsApp (CallMeBot)', `https://api.callmebot.com/whatsapp.php?phone=${enc(phone)}&text=${enc(text)}&apikey=${enc(e.CALLMEBOT_WHATSAPP_APIKEY)}`));
  }

  if (e.CALLMEBOT_TELEGRAM_USER) {
    const user = e.CALLMEBOT_TELEGRAM_USER.trim();
    if (String(e.CALLMEBOT_VOICE_CALL).toLowerCase() === 'true') {
      const lang = e.CALLMEBOT_VOICE || 'he-IL-Standard-A';
      const spoken = (voice || text).slice(0, 250);
      // cc=yes: גם אם לא עונים, נשלח עותק כתוב של ההודעה
      jobs.push(call('שיחה קולית בטלגרם (CallMeBot)', `https://api.callmebot.com/start.php?user=${enc(user)}&text=${enc(spoken)}&lang=${enc(lang)}&rpt=2&cc=yes`));
    } else {
      jobs.push(call('Telegram (CallMeBot)', `https://api.callmebot.com/text.php?user=${enc(user)}&text=${enc(text)}`));
    }
  }

  if (e.TELEGRAM_BOT_TOKEN && e.TELEGRAM_CHAT_ID) {
    jobs.push(call('בוט Telegram', `https://api.telegram.org/bot${e.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: e.TELEGRAM_CHAT_ID, text, disable_web_page_preview: true })
    }));
  }

  if (jobs.length === 0) {
    console.log('::warning::לא הוגדר אף ערוץ התראות. הפניה נשמרה ב-GitHub, אבל לא נשלחה התראה. ראו README, שלב 5.');
    return [];
  }
  const results = await Promise.all(jobs);
  if (!results.some((r) => r.ok)) console.log('::warning::כל ערוצי ההתראות נכשלו — בדקו את ה-Secrets (פירוט ביומן הריצה).');
  return results;
}

module.exports = { notifyManager };
