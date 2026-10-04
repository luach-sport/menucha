'use strict';
/*
 * בונה את data/availability.json מתוך הפניות שמסומנות Approved.
 * הקובץ הציבורי מכיל רק מזהה דירה וטווחי תאריכים — בלי שמות ובלי טלפונים.
 */

const fs = require('fs');
const { Pricing, AVAILABILITY_FILE, readJSON, writeJSON, crmTarget, setOutput, summary } = require('./lib/site');
const { paginate } = require('./lib/github');

const BOOKING_RE = /<!--\s*menucha-booking\s+(\{[\s\S]*?\})\s*-->/;

function parseBooking(body) {
  const m = BOOKING_RE.exec(body || '');
  if (!m) return null;
  try {
    const b = JSON.parse(m[1]);
    if (!/^[a-z0-9-]{2,80}$/.test(b.apartmentId || '')) return null;
    if (!Pricing.parseISO(b.checkin) || !Pricing.parseISO(b.checkout) || b.checkout <= b.checkin) return null;
    return b;
  } catch {
    return null;
  }
}

/** מאחד טווחים חופפים או צמודים */
function merge(ranges) {
  const sorted = ranges.slice().sort((a, b) => a.from.localeCompare(b.from));
  const out = [];
  sorted.forEach((r) => {
    const last = out[out.length - 1];
    if (last && r.from <= last.to) { if (r.to > last.to) last.to = r.to; }
    else out.push({ from: r.from, to: r.to });
  });
  return out;
}

async function main() {
  const target = crmTarget();
  const issues = await paginate(`/repos/${target.repo}/issues?labels=Approved&state=all`, { token: target.token });
  const cutoff = Pricing.addDays(Pricing.todayIL(), -30);

  const byApartment = {};
  let used = 0;
  let skipped = 0;
  issues.forEach((issue) => {
    if (issue.pull_request) return;
    const b = parseBooking(issue.body);
    if (!b) { skipped++; console.log(`::warning::פניה #${issue.number} מסומנת Approved אבל חסר בה בלוק menucha-booking תקין`); return; }
    if (b.checkout < cutoff) return; // היסטוריה ישנה לא רלוונטית לאתר
    (byApartment[b.apartmentId] = byApartment[b.apartmentId] || []).push({ from: b.checkin, to: b.checkout });
    used++;
  });

  const blocked = {};
  Object.keys(byApartment).sort().forEach((id) => { blocked[id] = merge(byApartment[id]); });

  const prev = readJSON(AVAILABILITY_FILE, {}) || {};
  const changed = JSON.stringify(prev.blocked || {}) !== JSON.stringify(blocked);
  if (changed || !fs.existsSync(AVAILABILITY_FILE)) {
    writeJSON(AVAILABILITY_FILE, { updatedAt: new Date().toISOString(), blocked });
  }
  console.log(`${used} הזמנות מאושרות נקראו מ-${target.repo}${skipped ? `, ${skipped} דולגו` : ''}. ${changed ? 'יומן התפוסה עודכן.' : 'אין שינוי.'}`);
  setOutput('changed', changed);
  summary(`### סנכרון תפוסה\n${used} הזמנות מאושרות, ${Object.keys(blocked).length} דירות עם תאריכים חסומים. ${changed ? 'עודכן.' : 'ללא שינוי.'}`);
}

module.exports = { parseBooking, merge };

if (require.main === module) {
  main().catch((e) => {
    console.error(`::error::${e.message}`);
    process.exit(1);
  });
}
