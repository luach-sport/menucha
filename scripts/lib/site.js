'use strict';
/* עזרים משותפים לסקריפטים של GitHub Actions */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const Pricing = require(path.join(ROOT, 'assets/js/pricing.js'));
const Validate = require(path.join(ROOT, 'assets/js/validate.js'));
const Amenities = require(path.join(ROOT, 'assets/js/amenities.js'));
const { resolveRepo } = require('./github');

const APARTMENTS_DIR = path.join(ROOT, 'data', 'apartments');
const APARTMENTS_FILE = path.join(ROOT, 'data', 'apartments.json');
const AVAILABILITY_FILE = path.join(ROOT, 'data', 'availability.json');

function readJSON(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}
function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

/** כל קובצי הדירות (מקור האמת), כולל כאלה שעוד לא פורסמו */
function loadApartmentFiles() {
  if (!fs.existsSync(APARTMENTS_DIR)) return [];
  return fs.readdirSync(APARTMENTS_DIR)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => ({ file: path.join(APARTMENTS_DIR, f), name: f, data: readJSON(path.join(APARTMENTS_DIR, f), null) }));
}
function loadApartments() {
  return loadApartmentFiles().map((x) => x.data).filter((a) => a && a.id);
}
function loadBlocked() {
  return (readJSON(AVAILABILITY_FILE, {}) || {}).blocked || {};
}

// ---------- סביבת ה-Workflow ----------
function env(name, fallback = '') {
  const v = process.env[name];
  return v == null || v === '' ? fallback : v;
}
/** הרפוזיטורי שבו נפתחות הפניות, והטוקן שמתאים לו */
function crmTarget() {
  const self = env('GITHUB_REPOSITORY');
  const crm = env('CRM_REPO');
  if (crm) {
    const token = env('CRM_TOKEN');
    if (!token) throw new Error('הוגדר CRM_REPO אבל חסר הסוד CRM_TOKEN — ראו README, שלב 4');
    return { repo: resolveRepo(crm, self), token, separate: true };
  }
  return { repo: self, token: env('GITHUB_TOKEN'), separate: false };
}
function siteUrl() {
  const custom = env('SITE_URL');
  if (custom) return custom.replace(/\/?$/, '/');
  const [owner, repo] = env('GITHUB_REPOSITORY', 'owner/repo').split('/');
  if (repo.toLowerCase() === `${owner.toLowerCase()}.github.io`) return `https://${owner.toLowerCase()}.github.io/`;
  return `https://${owner.toLowerCase()}.github.io/${repo}/`;
}

function setOutput(name, value) {
  const file = process.env.GITHUB_OUTPUT;
  if (file) fs.appendFileSync(file, `${name}=${String(value).replace(/\n/g, ' ')}\n`);
}
function summary(markdown) {
  const file = process.env.GITHUB_STEP_SUMMARY;
  if (file) fs.appendFileSync(file, markdown + '\n');
  else console.log(markdown);
}

// ---------- עיצוב טקסט בעברית ----------
const WEEKDAY_SHORT = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];
function shortDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const w = Pricing.dow(iso);
  return `${w === 6 ? 'שבת' : WEEKDAY_SHORT[w]} ${d}.${m}.${y}`;
}
function dateRange(checkin, checkout) {
  const n = Pricing.nightsBetween(checkin, checkout);
  const out = Pricing.dow(checkout) === 6 ? `מוצ״ש ${checkout.split('-').reverse().slice(0, 2).map(Number).join('.')}` : shortDate(checkout);
  return `${shortDate(checkin)} עד ${out} (${Pricing.nightsLabel(n)})`;
}
function guestsText(guests, infants) {
  let s = Pricing.guestsLabel(guests);
  if (infants === 1) s += ' + תינוק';
  else if (infants > 1) s += ` + ${infants} תינוקות`;
  return s;
}

/** מנטרל Markdown/HTML/אזכורים בטקסט שהגיע מגולש */
function md(text) {
  return String(text == null ? '' : text)
    .replace(/[\\`*_{}[\]()#+!|>~]/g, (c) => '\\' + c)
    .replace(/</g, '&lt;')
    .replace(/@/g, '@​')
    .replace(/\n/g, ' ');
}
function mdBlock(text) {
  return String(text || '').split('\n').map((l) => md(l)).join('<br>');
}

/** שם מוסתר לרפוזיטורי ציבורי: "דנה כ." */
function maskName(name) {
  const parts = Validate.cleanText(name, 80).split(' ').filter(Boolean);
  if (parts.length <= 1) return parts[0] || '—';
  return `${parts[0]} ${parts[parts.length - 1].charAt(0)}.`;
}

module.exports = {
  ROOT, Pricing, Validate, Amenities,
  APARTMENTS_DIR, APARTMENTS_FILE, AVAILABILITY_FILE,
  readJSON, writeJSON, loadApartmentFiles, loadApartments, loadBlocked,
  env, crmTarget, siteUrl, setOutput, summary,
  shortDate, dateRange, guestsText, md, mdBlock, maskName
};
