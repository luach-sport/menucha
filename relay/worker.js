/*
 * ממסר הטפסים של "מנוחה" — Cloudflare Worker (מסלול חינמי).
 *
 * למה צריך אותו? עמוד סטטי ב-GitHub Pages לא יכול להחזיק טוקן של GitHub בלי שכל
 * גולש יראה אותו. הממסר מחזיק את הטוקן בסוד, בודק את הטופס, מסנן ספאם
 * ומפעיל את ה-Workflow המתאים ב-GitHub Actions (repository_dispatch).
 *
 * משתני סביבה (Settings → Variables and Secrets ב-Cloudflare):
 *   GITHUB_REPO      (טקסט)  owner/repo של האתר, למשל  dana/menucha
 *   ALLOWED_ORIGINS  (טקסט)  כתובות האתר המורשות, מופרדות בפסיק: https://dana.github.io
 *   GITHUB_TOKEN     (סוד)   Fine-grained token עם הרשאת Contents: Read and write לרפוזיטורי האתר בלבד
 *   OWNER_CODE       (סוד, לא חובה)  קוד שבעלי דירות צריכים כדי לשלוח את טופס הדירה
 */

const MAX_BODY = 20000;
const RATE_LIMIT = { windowMs: 10 * 60 * 1000, max: 6 };
const hits = new Map(); // הגבלת קצב בסיסית לכל IP (בזיכרון של המופע — מספיק נגד הצפה פשוטה)

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allowed = String(env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim().replace(/\/+$/, '')).filter(Boolean);
    const originOk = allowed.length === 0 || allowed.includes(origin);
    const cors = {
      'Access-Control-Allow-Origin': originOk && origin ? origin : allowed[0] || '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
      Vary: 'Origin'
    };
    const reply = (status, body) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8' } });

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/') {
      return reply(200, { ok: true, service: 'menucha-relay', configured: Boolean(env.GITHUB_TOKEN && env.GITHUB_REPO) });
    }
    if (request.method !== 'POST') return reply(405, { ok: false, error: 'Method not allowed' });
    if (!originOk) return reply(403, { ok: false, error: 'האתר הזה לא מורשה לשלוח טפסים' });
    if (!env.GITHUB_TOKEN || !env.GITHUB_REPO) return reply(500, { ok: false, error: 'הממסר עוד לא הוגדר' });

    const text = await request.text();
    if (text.length > MAX_BODY) return reply(413, { ok: false, error: 'הטופס ארוך מדי' });
    let data;
    try { data = JSON.parse(text); } catch { return reply(400, { ok: false, error: 'נתונים לא תקינים' }); }

    // מלכודת לרובוטים: מחזירים "הצלחה" ולא שולחים כלום
    if (isBot(data, url.pathname === '/property' ? 8000 : 2500)) return reply(200, { ok: true });

    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    if (rateLimited(ip)) return reply(429, { ok: false, error: 'נשלחו יותר מדי בקשות מהחיבור הזה. נסו שוב בעוד כמה דקות' });

    const meta = { receivedAt: new Date().toISOString(), country: (request.cf && request.cf.country) || '' };

    if (url.pathname === '/lead') {
      const lead = {
        name: clean(data.name, 80),
        phone: formatPhone(data.phone),
        email: clean(data.email, 120).toLowerCase(),
        apartmentId: clean(data.apartmentId, 80),
        checkin: clean(data.checkin, 10),
        checkout: clean(data.checkout, 10),
        guests: clampInt(data.guests, 1, 50),
        infants: clampInt(data.infants, 0, 10),
        quotedTotal: clampInt(data.quotedTotal, 0, 1000000)
      };
      const fields = {};
      if (!isName(lead.name)) fields.name = 'כתבו שם מלא';
      if (!isIsraeliPhone(data.phone)) fields.phone = 'מספר טלפון ישראלי, למשל 050-1234567';
      if (!isEmail(lead.email)) fields.email = 'כתובת אימייל מלאה';
      if (!/^[a-z0-9-]{2,80}$/.test(lead.apartmentId) || !isDate(lead.checkin) || !isDate(lead.checkout) || lead.checkout <= lead.checkin) {
        fields.dates = 'בחרו דירה ותאריכים';
      }
      if (Object.keys(fields).length) return reply(422, { ok: false, error: 'יש פרטים חסרים בטופס', fields });
      return dispatch(env, 'new_lead', { lead, meta }, reply);
    }

    if (url.pathname === '/property') {
      if (env.OWNER_CODE && String(data.code || '').trim() !== String(env.OWNER_CODE).trim()) {
        return reply(403, { ok: false, error: 'קוד בעלי הדירות שגוי', fields: { code: 'הקוד לא נכון. בדקו מול המנהל' } });
      }
      const p = data.property || {};
      const o = data.owner || {};
      const fields = {};
      if (clean(p.title, 60).length < 3) fields.title = 'חסר שם לדירה';
      if (clean(p.city, 40).length < 2) fields.city = 'חסרה עיר';
      if (clean(p.description, 3000).length < 30) fields.description = 'התיאור קצר מדי';
      if (!isName(o.name)) fields.oname = 'כתבו שם מלא';
      if (!isIsraeliPhone(o.phone)) fields.ophone = 'מספר טלפון ישראלי';
      if (Object.keys(fields).length) return reply(422, { ok: false, error: 'יש פרטים חסרים בטופס', fields });
      // הניקוי המלא נעשה ב-Workflow (scripts/create-property.js)
      return dispatch(env, 'new_property', { property: p, owner: { name: clean(o.name, 80), phone: formatPhone(o.phone), email: clean(o.email, 120) }, meta }, reply);
    }

    return reply(404, { ok: false, error: 'כתובת לא מוכרת' });
  }
};

async function dispatch(env, eventType, clientPayload, reply) {
  const res = await fetch(`https://api.github.com/repos/${env.GITHUB_REPO}/dispatches`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'menucha-relay',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ event_type: eventType, client_payload: clientPayload })
  });
  if (res.status === 204) return reply(200, { ok: true });
  console.log('GitHub dispatch failed', res.status, (await res.text()).slice(0, 300));
  return reply(502, { ok: false, error: 'השליחה נכשלה בצד שלנו' });
}

// ---------- עזרים (זהים לחוקים ב-assets/js/validate.js) ----------
function clean(v, max) {
  return String(v == null ? '' : v).replace(/[\u0000-\u001F\u007F​-‏‪-‮⁦-⁩]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}
function clampInt(v, min, max) {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min;
}
function normalizePhone(raw) {
  const s = String(raw || '').trim();
  let d = s.replace(/\D/g, '');
  if (d.startsWith('00972')) d = '0' + d.slice(5);
  else if (d.startsWith('972') && (s.startsWith('+') || d.length >= 11)) d = '0' + d.slice(3);
  return d;
}
function isIsraeliPhone(raw) {
  const d = normalizePhone(raw);
  return /^05\d{8}$/.test(d) || /^07[2-9]\d{7}$/.test(d) || /^0[2-489]\d{7}$/.test(d);
}
function formatPhone(raw) {
  const d = normalizePhone(raw);
  if (d.length === 10) return d.slice(0, 3) + '-' + d.slice(3);
  if (d.length === 9) return d.slice(0, 2) + '-' + d.slice(2);
  return d;
}
function isEmail(s) {
  return s.length <= 254 && /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[A-Za-z֐-׿]{2,}$/.test(s);
}
function isName(raw) {
  const s = clean(raw, 80);
  return s.length >= 2 && /[A-Za-z֐-׿]/.test(s) && !/https?:|www\.|<|>/.test(s);
}
function isDate(s) { return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s + 'T00:00:00Z')); }
function isBot(data, minMs) {
  if (data && data.website && String(data.website).trim() !== '') return true;
  const elapsed = Number(data && data.elapsedMs);
  return Number.isFinite(elapsed) && elapsed > 0 && elapsed < minMs;
}
function rateLimited(ip) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter((t) => now - t < RATE_LIMIT.windowMs);
  list.push(now);
  hits.set(ip, list);
  if (hits.size > 5000) hits.clear();
  return list.length > RATE_LIMIT.max;
}
