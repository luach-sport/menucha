'use strict';
/*
 * מאחד את כל הקבצים ב-data/apartments/*.json לקובץ אחד, data/apartments.json,
 * שהאתר קורא. דירה עם שגיאה לא נכנסת לקובץ, ומקבלת הודעת שגיאה ביומן הריצה.
 * הרצה מקומית: node scripts/build-apartments.js
 */

const path = require('path');
const fs = require('fs');
const { Pricing, Amenities, APARTMENTS_FILE, loadApartmentFiles, writeJSON, setOutput, summary } = require('./lib/site');

function validate(a, fileName) {
  const errors = [];
  const warnings = [];
  if (!a || typeof a !== 'object') return { errors: ['הקובץ אינו JSON תקין'], warnings };
  if (!/^[a-z0-9-]{2,80}$/.test(a.id || '')) errors.push('id חייב להכיל רק אותיות אנגליות קטנות, ספרות ומקפים');
  if (a.id && `${a.id}.json` !== fileName) errors.push(`שם הקובץ צריך להיות ${a.id}.json`);
  ['title', 'city', 'description'].forEach((k) => { if (!a[k] || typeof a[k] !== 'string') errors.push(`חסר שדה ${k}`); });
  if (!(Number(a.beds) > 0)) errors.push('beds חייב להיות מספר גדול מ-0');
  if (!a.pricing || !(Number(a.pricing.nightly) > 0)) errors.push('pricing.nightly חייב להיות מספר גדול מ-0');
  (a.amenities || []).forEach((x) => { if (!Amenities.isKnown(x)) warnings.push(`אבזור לא מוכר "${x}" (יוסתר באתר)`); });
  ((a.pricing && a.pricing.specialPeriods) || []).forEach((s) => {
    if (!Pricing.parseISO(s.from) || !Pricing.parseISO(s.to) || s.to < s.from) errors.push(`תקופה מיוחדת "${s.name}" עם תאריכים לא תקינים`);
  });
  if (!Array.isArray(a.images) || a.images.length === 0) warnings.push('אין תמונות');
  if (!a.geo) warnings.push('אין geo — זמני השבת לא יוצגו בעמוד הדירה');
  // בדיקת שפיות: חישוב מחיר לשבת הקרובה
  const fri = Pricing.nextWeekday(Pricing.todayIL(), 5);
  const q = Pricing.quote(a, { checkin: fri, checkout: Pricing.addDays(fri, Math.max(1, Number(a.pricing && a.pricing.minNights) || 1)), guests: 2 });
  if (!(q.total > 0)) warnings.push('חישוב מחיר לדוגמה יצא 0');
  return { errors, warnings };
}

function main() {
  const files = loadApartmentFiles();
  const ok = [];
  let invalid = 0;
  const ids = new Set();
  const report = [];

  files.forEach(({ name, data, file }) => {
    const rel = path.relative(process.cwd(), file);
    const { errors, warnings } = validate(data, name);
    if (data && ids.has(data.id)) errors.push(`id כפול: ${data.id}`);
    warnings.forEach((w) => console.log(`::warning file=${rel}::${w}`));
    if (errors.length) {
      invalid++;
      errors.forEach((e) => console.log(`::error file=${rel}::${e}`));
      report.push(`- ❌ \`${name}\`: ${errors.join('; ')}`);
      return;
    }
    ids.add(data.id);
    if (data.published === false) { report.push(`- ⏸️ \`${name}\` מוסתר (published: false)`); return; }
    ok.push(data);
  });

  ok.sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')) || a.id.localeCompare(b.id));
  const next = JSON.stringify({ apartments: ok }, null, 2) + '\n';
  const prev = fs.existsSync(APARTMENTS_FILE) ? fs.readFileSync(APARTMENTS_FILE, 'utf8') : '';
  if (prev !== next) writeJSON(APARTMENTS_FILE, { apartments: ok });

  console.log(`${ok.length} דירות פורסמו, ${invalid} עם שגיאות. ${prev === next ? 'אין שינוי.' : 'הקובץ עודכן.'}`);
  setOutput('changed', prev !== next);
  setOutput('invalid', invalid);
  summary(`### בניית רשימת הדירות\n${ok.length} דירות באתר.${report.length ? '\n' + report.join('\n') : ''}`);
}

main();
