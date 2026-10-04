'use strict';
/*
 * מופעל ע"י .github/workflows/property-submission.yml כשבעל דירה שולח את הטופס.
 * יוצר ענף חדש עם קובץ JSON לדירה ופותח Pull Request. הדירה מתפרסמת רק אחרי Merge.
 */

const {
  Pricing, Validate, Amenities, env, siteUrl, summary, setOutput, md, mdBlock, maskName, shortDate
} = require('./lib/site');
const { gh, ensureLabels, PROPERTY_LABEL } = require('./lib/github');
const { notifyManager } = require('./lib/notify');

const CITY_SLUGS = {
  'ירושלים': 'jerusalem', 'תל אביב': 'tel-aviv', 'תל אביב-יפו': 'tel-aviv', 'חיפה': 'haifa', 'צפת': 'safed',
  'טבריה': 'tiberias', 'נתניה': 'netanya', 'בית שמש': 'beit-shemesh', 'בני ברק': 'bnei-brak', 'אשדוד': 'ashdod',
  'אשקלון': 'ashkelon', 'מודיעין': 'modiin', 'מודיעין עילית': 'modiin-illit', 'ביתר עילית': 'beitar-illit',
  'אלעד': 'elad', 'רחובות': 'rehovot', 'פתח תקווה': 'petah-tikva', 'הרצליה': 'herzliya', 'רעננה': 'raanana',
  'כפר סבא': 'kfar-saba', 'אילת': 'eilat', 'נהריה': 'nahariya', 'עכו': 'akko', 'זכרון יעקב': 'zichron-yaakov',
  'קריית ארבע': 'kiryat-arba', 'חברון': 'hebron', 'אפרת': 'efrat', 'מעלה אדומים': 'maale-adumim', 'עפולה': 'afula',
  'באר שבע': 'beer-sheva', 'ערד': 'arad', 'קצרין': 'katzrin', 'ראש פינה': 'rosh-pina'
};

const int = (v, min, max, def) => {
  const n = Math.floor(Number(v));
  if (!isFinite(n)) return def;
  return Math.min(max, Math.max(min, n));
};
const money = (v) => {
  const n = Math.round(Number(v));
  return isFinite(n) && n >= 0 && n <= 100000 ? n : null;
};
const time = (v, def) => (/^([01]\d|2[0-3]):[0-5]\d$/.test(String(v || '')) ? v : def);

function buildApartment(p, id) {
  const errors = [];
  const title = Validate.cleanText(p.title, 60);
  const city = Validate.cleanText(p.city, 40);
  const description = Validate.cleanText(p.description, 3000, true);
  if (title.length < 3) errors.push('חסרה כותרת לדירה');
  if (city.length < 2) errors.push('חסרה עיר');
  if (description.length < 30) errors.push('התיאור קצר מדי');

  const beds = int(p.beds, 1, 60, 0);
  if (!beds) errors.push('חסר מספר מקומות לינה');
  const pr = p.pricing || {};
  const nightly = money(pr.nightly);
  if (!nightly) errors.push('חסר מחיר ללילה');

  const lat = Number(p.geo && p.geo.lat);
  const lng = Number(p.geo && p.geo.lng);
  const geo = lat > 29 && lat < 33.6 && lng > 34 && lng < 36 ? { lat: +lat.toFixed(4), lng: +lng.toFixed(4) } : null;

  const images = (Array.isArray(p.images) ? p.images : [])
    .map((u) => Validate.cleanText(u, 500))
    .filter((u) => /^https:\/\/[^\s"'<>]+$/.test(u))
    .slice(0, 12)
    .map((src, i) => ({ src, alt: `${title} — תמונה ${i + 1}` }));

  const weekendNights = (Array.isArray(pr.weekendNights) ? pr.weekendNights : [4, 5])
    .map(Number).filter((d) => [4, 5, 6].includes(d));

  const discount = pr.lengthDiscount || {};
  const lengthDiscounts = int(discount.minNights, 0, 30, 0) > 1 && int(discount.percent, 0, 50, 0) > 0
    ? [{ minNights: int(discount.minNights, 2, 30, 3), percent: int(discount.percent, 1, 50, 10) }]
    : [];

  const apartment = {
    id,
    title,
    city,
    neighborhood: Validate.cleanText(p.neighborhood, 40),
    ...(geo ? { geo } : {}),
    candleLightingMinutes: int(p.candleLightingMinutes, 0, 60, /ירושלים/.test(city) ? 40 : 18),
    rooms: int(p.rooms, 1, 20, 1),
    beds,
    maxGuests: Math.max(beds, int(p.maxGuests, 1, 60, beds)),
    cribs: int(p.cribs, 0, 10, 0),
    summary: Validate.cleanText(p.summary, 160) || Validate.cleanText(description.split(/[.\n]/)[0], 160),
    description,
    highlights: (Array.isArray(p.highlights) ? p.highlights : []).map((h) => Validate.cleanText(h, 120)).filter(Boolean).slice(0, 5),
    amenities: (Array.isArray(p.amenities) ? p.amenities : []).filter((a) => Amenities.isKnown(a)),
    houseRules: (Array.isArray(p.houseRules) ? p.houseRules : []).map((h) => Validate.cleanText(h, 120)).filter(Boolean).slice(0, 6),
    checkInTime: time(p.checkInTime, '14:00'),
    checkOutTime: time(p.checkOutTime, '11:00'),
    images,
    pricing: {
      nightly: nightly || 0,
      weekendNightly: money(pr.weekendNightly),
      weekendNights: weekendNights.length ? weekendNights : [4, 5],
      includedGuests: int(pr.includedGuests, 1, 60, Math.min(beds || 2, 4)),
      extraGuestPerNight: money(pr.extraGuestPerNight) || 0,
      cleaningFee: money(pr.cleaningFee) || 0,
      minNights: int(pr.minNights, 1, 14, 1),
      lengthDiscounts,
      specialPeriods: []
    },
    published: true,
    createdAt: new Date().toISOString().slice(0, 10),
    source: 'owner-form'
  };
  if (apartment.pricing.weekendNightly == null) delete apartment.pricing.weekendNightly;
  return { apartment, errors };
}

async function main() {
  const payload = JSON.parse(process.env.PAYLOAD || '{}');
  const raw = payload.property || {};
  const ownerRaw = payload.owner || {};
  const repo = env('GITHUB_REPOSITORY');
  const token = env('GITHUB_TOKEN');
  const base = env('BASE_BRANCH', 'main');

  if (Validate.looksLikeBot(payload)) { console.log('ספאם — מדלג.'); return; }

  const owner = {
    name: Validate.cleanText(ownerRaw.name, 80),
    phone: Validate.isIsraeliPhone(ownerRaw.phone) ? Validate.formatPhone(ownerRaw.phone) : '',
    email: Validate.isEmail(ownerRaw.email) ? Validate.cleanText(ownerRaw.email, 120).toLowerCase() : ''
  };
  if (!Validate.isName(owner.name) || !owner.phone) {
    console.log('::warning::טופס בעלים בלי שם או טלפון תקין — נדחה.');
    return;
  }

  const citySlug = CITY_SLUGS[Validate.cleanText(raw.city, 40)] || 'apt';
  const stamp = new Date().toISOString().slice(2, 10).replace(/-/g, '');
  const id = `${citySlug}-${stamp}-${Math.random().toString(16).slice(2, 6)}`;
  const { apartment, errors } = buildApartment(raw, id);
  if (errors.length) {
    console.log(`::warning::הטופס חסר: ${errors.join(', ')}`);
    return;
  }

  // דוגמת מחיר: השבת הקרובה, לכמות האורחים הכלולה + 2
  const fri = Pricing.nextWeekday(Pricing.addDays(Pricing.todayIL(), 1), 5);
  const sampleGuests = Math.min(apartment.maxGuests, apartment.pricing.includedGuests + 2);
  const sample = Pricing.quote(apartment, { checkin: fri, checkout: Pricing.addDays(fri, 1), guests: sampleGuests });

  const repoInfo = await gh('GET', `/repos/${repo}`, { token });
  const isPublic = !repoInfo.private;
  const shownOwner = isPublic
    ? { name: maskName(owner.name), phone: Validate.maskPhone(owner.phone), email: owner.email ? Validate.maskEmail(owner.email) : '—' }
    : { name: owner.name, phone: owner.phone, email: owner.email || '—' };

  const branch = `property/${id}`;
  const filePath = `data/apartments/${id}.json`;
  const ref = await gh('GET', `/repos/${repo}/git/ref/heads/${encodeURIComponent(base)}`, { token });
  await gh('POST', `/repos/${repo}/git/refs`, { token, body: { ref: `refs/heads/${branch}`, sha: ref.object.sha } });
  await gh('PUT', `/repos/${repo}/contents/${filePath}`, {
    token,
    body: {
      message: `דירה חדשה: ${apartment.title} (${apartment.city})`,
      content: Buffer.from(JSON.stringify(apartment, null, 2) + '\n', 'utf8').toString('base64'),
      branch
    }
  });

  const amenityText = apartment.amenities.map((a) => Amenities.get(a).label).join(', ') || '—';
  const p = apartment.pricing;
  const body = [
    `### דירה חדשה מבעלים: ${md(apartment.title)}`,
    '',
    '| | |',
    '|---|---|',
    `| **מיקום** | ${md([apartment.neighborhood, apartment.city].filter(Boolean).join(', '))} |`,
    `| **חדרים / מקומות לינה** | ${apartment.rooms} חדרים, ${apartment.beds} מקומות לינה, עד ${apartment.maxGuests} אורחים, ${apartment.cribs === 1 ? 'מיטת תינוק אחת' : `${apartment.cribs} מיטות תינוק`} |`,
    `| **מחיר ללילה** | ${Pricing.formatMoney(p.nightly)} רגיל${p.weekendNightly ? `, ${Pricing.formatMoney(p.weekendNightly)} בסופ״ש` : ''} |`,
    `| **אורחים כלולים** | ${p.includedGuests}, ואז ${Pricing.formatMoney(p.extraGuestPerNight)} לאורח ללילה |`,
    `| **ניקיון / מינימום** | ${Pricing.formatMoney(p.cleaningFee)} · מינימום ${Pricing.nightsLabel(p.minNights)} |`,
    `| **דוגמה** | ${shortDate(fri)}, לילה אחד, ${sampleGuests} אורחים: **${sample.ok ? Pricing.formatMoney(sample.total) : sample.errors.join(', ')}** |`,
    `| **אבזור** | ${md(amenityText)} |`,
    `| **תמונות** | ${apartment.images.length ? apartment.images.map((im, i) => `[${i + 1}](${im.src})`).join(' · ') : 'לא צורפו קישורים'} |`,
    '',
    '**תיאור**',
    '',
    mdBlock(apartment.description),
    '',
    `**בעל הדירה:** ${md(shownOwner.name)} · ${md(shownOwner.phone)} · ${md(shownOwner.email)}`,
    isPublic ? '> 🔒 הרפוזיטורי ציבורי, ולכן פרטי הקשר מוסתרים. הפרטים המלאים נשלחו אליך בהתראה.' : '',
    '',
    '#### לפני אישור',
    `- [ ] להעלות תמונות לתיקייה \`assets/img/apartments/${id}/\` ולעדכן את \`images\` בקובץ (בענף \`${branch}\`)`,
    ...(apartment.geo ? [] : ['- [ ] להוסיף מיקום (`geo`) כדי שזמני השבת יוצגו בעמוד הדירה']),
    '- [ ] לבדוק מחירים ותיאור',
    '- [ ] **Merge** — הדירה תופיע באתר תוך כמה דקות'
  ].join('\n').replace(/\n{3,}/g, '\n\n');

  const pr = await gh('POST', `/repos/${repo}/pulls`, {
    token,
    body: { title: `🏡 דירה חדשה: ${apartment.title} (${apartment.city})`, head: branch, base, body, maintainer_can_modify: true }
  });
  await ensureLabels(repo, [PROPERTY_LABEL], token);
  await gh('POST', `/repos/${repo}/issues/${pr.number}/labels`, { token, body: { labels: [PROPERTY_LABEL.name] } }).catch(() => {});
  console.log(`נפתח Pull Request #${pr.number}: ${pr.html_url}`);
  setOutput('pr_url', pr.html_url);

  const text = [
    '🏡 דירה חדשה ממתינה לאישור',
    `${apartment.title} — ${[apartment.neighborhood, apartment.city].filter(Boolean).join(', ')}`,
    `${apartment.beds} מקומות לינה, ${Pricing.formatMoney(p.nightly)} ללילה`,
    `בעלים: ${owner.name}, ${owner.phone}${owner.email ? `, ${owner.email}` : ''}`,
    `לאישור: ${pr.html_url}`
  ].join('\n');
  await notifyManager({ text, voice: `דירה חדשה ממתינה לאישור: ${apartment.title} ב${apartment.city}.` });

  summary(`### דירה חדשה: ${md(apartment.title)}\n- Pull Request: ${pr.html_url}\n- יופיע באתר: ${siteUrl()}property.html#${id} (אחרי Merge)`);
}

module.exports = { buildApartment };

if (require.main === module) {
  main().catch((e) => {
    console.error(`::error::${e.message}`);
    process.exit(1);
  });
}
