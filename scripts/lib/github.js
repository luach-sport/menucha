'use strict';
/* לקוח REST מינימלי ל-GitHub (בלי תלויות, Node 20+) */

const API = 'https://api.github.com';

async function gh(method, path, { token, body } = {}) {
  if (!token) throw new Error('חסר טוקן ל-GitHub API');
  const res = await fetch(API + path, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'menucha-actions',
      ...(body ? { 'Content-Type': 'application/json' } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    const msg = (data && data.message) || text || res.statusText;
    const err = new Error(`GitHub ${method} ${path} → ${res.status}: ${msg}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

/** מושך את כל העמודים (עד maxPages) של רשימה */
async function paginate(path, { token, maxPages = 10 } = {}) {
  const out = [];
  const sep = path.includes('?') ? '&' : '?';
  for (let page = 1; page <= maxPages; page++) {
    const items = await gh('GET', `${path}${sep}per_page=100&page=${page}`, { token });
    if (!Array.isArray(items) || items.length === 0) break;
    out.push(...items);
    if (items.length < 100) break;
  }
  return out;
}

/** יוצר תגיות שעוד לא קיימות (מתעלם מ"כבר קיים") */
async function ensureLabels(repo, labels, token) {
  for (const label of labels) {
    try {
      await gh('POST', `/repos/${repo}/labels`, { token, body: label });
    } catch (e) {
      if (e.status !== 422) console.warn(`::warning::לא הצלחתי ליצור את התגית ${label.name}: ${e.message}`);
    }
  }
}

/** "owner/repo" — מקבל גם שם רפוזיטורי בלבד ומשלים את הבעלים */
function resolveRepo(value, fallbackFull) {
  const v = String(value || '').trim();
  if (!v) return fallbackFull;
  if (v.includes('/')) return v;
  return `${fallbackFull.split('/')[0]}/${v}`;
}

const LEAD_LABELS = [
  { name: 'New Lead', color: '2F6DB5', description: 'פניה חדשה מהאתר — ממתינה לטיפול' },
  { name: 'Approved', color: '2E8B57', description: 'הזמנה מאושרת — התאריכים חסומים באתר' },
  { name: 'Closed', color: '8A8F98', description: 'טופל / בוטל — לא חוסם תאריכים' },
  { name: 'Manual Block', color: 'B8860B', description: 'חסימה ידנית של תאריכים (לא דרך האתר)' }
];

const PROPERTY_LABEL = { name: 'new-property', color: 'C79A3C', description: 'דירה חדשה מבעלים — ממתינה לאישור' };

module.exports = { gh, paginate, ensureLabels, resolveRepo, LEAD_LABELS, PROPERTY_LABEL };
