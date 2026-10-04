/*
 * מנוע התמחור של האתר.
 * הקובץ משותף לדפדפן (window.Pricing) ול-GitHub Actions (require), כך שהמחיר
 * שהלקוח רואה והמחיר שנרשם בפניה מחושבים באותו קוד בדיוק.
 *
 * כל התאריכים הם מחרוזות YYYY-MM-DD. "לילה" מזוהה לפי התאריך שבו הוא מתחיל:
 * הגעה ביום שישי ועזיבה במוצ"ש = לילה אחד, שתאריכו יום שישי.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Pricing = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var DAY = 86400000;
  var MAX_NIGHTS = 30;

  // ---------- תאריכים ----------
  function parseISO(s) {
    if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
    var p = s.split('-').map(Number);
    var t = Date.UTC(p[0], p[1] - 1, p[2]);
    var d = new Date(t);
    if (d.getUTCMonth() !== p[1] - 1 || d.getUTCDate() !== p[2]) return null;
    return t;
  }
  function toISO(t) { return new Date(t).toISOString().slice(0, 10); }
  function addDays(iso, n) { return toISO(parseISO(iso) + n * DAY); }
  function nightsBetween(a, b) { return Math.round((parseISO(b) - parseISO(a)) / DAY); }
  function dow(iso) { return new Date(parseISO(iso)).getUTCDay(); } // 0=ראשון ... 5=שישי, 6=שבת
  function eachNight(checkin, checkout) {
    var out = [];
    var end = parseISO(checkout);
    for (var t = parseISO(checkin); t < end; t += DAY) out.push(toISO(t));
    return out;
  }
  /** היום הבא (כולל היום עצמו) שהוא יום בשבוע weekday */
  function nextWeekday(fromISO, weekday) {
    var d = dow(fromISO);
    return addDays(fromISO, (weekday - d + 7) % 7);
  }
  /** "היום" לפי שעון ישראל, כדי שגולש בחו"ל לא יראה תאריך שגוי */
  function todayIL() {
    try {
      return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(new Date());
    } catch (e) {
      return toISO(Date.now());
    }
  }
  /** טווחים חופפים? הטווחים הם [from, to) — to הוא יום העזיבה */
  function overlaps(aFrom, aTo, bFrom, bTo) { return aFrom < bTo && bFrom < aTo; }
  function isAvailable(blockedRanges, checkin, checkout) {
    return !(blockedRanges || []).some(function (r) { return overlaps(checkin, checkout, r.from, r.to); });
  }

  // ---------- תצוגה ----------
  var moneyFmt = null;
  function formatMoney(n) {
    if (!moneyFmt) {
      try {
        moneyFmt = new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 });
      } catch (e) {
        moneyFmt = { format: function (v) { return '₪' + Math.round(v).toLocaleString(); } };
      }
    }
    return moneyFmt.format(Math.round(n));
  }
  function nightsLabel(n) { return n === 1 ? 'לילה אחד' : n + ' לילות'; }
  function guestsLabel(n) { return n === 1 ? 'אורח אחד' : n + ' אורחים'; }

  // ---------- חוקיות התמחור ----------
  var DEFAULTS = {
    currency: 'ILS',
    nightly: 0,               // מחיר ללילה רגיל
    weekendNightly: null,     // מחיר ללילת סופ"ש (ריק = כמו לילה רגיל)
    weekendNights: [4, 5],    // אילו לילות נחשבים סופ"ש: 4=חמישי, 5=שישי, 6=מוצ"ש
    includedGuests: 2,        // כמה אורחים כלולים במחיר הבסיס
    extraGuestPerNight: 0,    // תוספת לכל אורח מעל הכלולים, לכל לילה
    cleaningFee: 0,           // דמי ניקיון חד-פעמיים
    minNights: 1,
    lengthDiscounts: [],      // [{ minNights: 3, percent: 10 }]
    specialPeriods: []        // [{ name: 'חנוכה', from: '2026-12-04', to: '2026-12-12', nightly: 1300, minNights: 2 }]
  };

  function num(v, fallback) {
    var n = Number(v);
    return isFinite(n) && n >= 0 ? n : fallback;
  }

  function normalize(p) {
    p = p || {};
    var out = {
      currency: 'ILS',
      nightly: num(p.nightly, DEFAULTS.nightly),
      weekendNightly: p.weekendNightly == null || p.weekendNightly === '' ? null : num(p.weekendNightly, null),
      weekendNights: Array.isArray(p.weekendNights) ? p.weekendNights.map(Number).filter(function (d) { return d >= 0 && d <= 6; }) : DEFAULTS.weekendNights.slice(),
      includedGuests: Math.max(1, Math.floor(num(p.includedGuests, DEFAULTS.includedGuests))),
      extraGuestPerNight: num(p.extraGuestPerNight, 0),
      cleaningFee: num(p.cleaningFee, 0),
      minNights: Math.max(1, Math.floor(num(p.minNights, 1))),
      lengthDiscounts: (Array.isArray(p.lengthDiscounts) ? p.lengthDiscounts : [])
        .map(function (d) { return { minNights: Math.floor(num(d.minNights, 0)), percent: Math.min(90, num(d.percent, 0)) }; })
        .filter(function (d) { return d.minNights > 1 && d.percent > 0; }),
      specialPeriods: (Array.isArray(p.specialPeriods) ? p.specialPeriods : [])
        .filter(function (s) { return parseISO(s.from) != null && parseISO(s.to) != null && num(s.nightly, -1) >= 0; })
        .map(function (s) { return { name: String(s.name || 'תקופה מיוחדת'), from: s.from, to: s.to, nightly: Number(s.nightly), minNights: Math.floor(num(s.minNights, 0)) }; })
    };
    return out;
  }

  /** מחיר של לילה בודד לפי התאריך שלו */
  function nightRate(p, iso) {
    for (var i = 0; i < p.specialPeriods.length; i++) {
      var s = p.specialPeriods[i];
      if (iso >= s.from && iso <= s.to) return { price: s.nightly, kind: 'special', label: s.name, minNights: s.minNights };
    }
    if (p.weekendNightly != null && p.weekendNights.indexOf(dow(iso)) !== -1) {
      return { price: p.weekendNightly, kind: 'weekend', label: 'סופ״ש' };
    }
    return { price: p.nightly, kind: 'regular', label: 'רגיל' };
  }

  function lineLabel(g) {
    if (g.kind === 'special') return g.label;
    if (g.kind === 'weekend') return g.count === 1 ? 'לילה בסופ״ש' : 'לילות בסופ״ש';
    return g.count === 1 ? 'לילה רגיל' : 'לילות רגילים';
  }

  /** "מ-X ללילה": המחיר הנמוך ביותר שהדירה מציעה */
  function fromPrice(apartment) {
    var p = normalize(apartment.pricing);
    var prices = [p.nightly];
    if (p.weekendNightly != null) prices.push(p.weekendNightly);
    return Math.min.apply(null, prices.filter(function (x) { return x > 0; }).concat([Infinity]));
  }

  /**
   * הצעת מחיר מלאה.
   * req: { checkin, checkout, guests, infants }
   * מחזיר: { ok, errors[], warnings[], nights, lines[{label, detail, amount}], total }
   */
  function quote(apartment, req) {
    req = req || {};
    var p = normalize(apartment && apartment.pricing);
    var errors = [];
    var warnings = [];
    var result = { ok: false, errors: errors, warnings: warnings, nights: 0, lines: [], total: 0, currency: 'ILS' };

    var ci = parseISO(req.checkin);
    var co = parseISO(req.checkout);
    if (ci == null || co == null) { errors.push('בחרו תאריך הגעה ותאריך עזיבה'); return result; }
    if (co <= ci) { errors.push('תאריך העזיבה צריך להיות אחרי תאריך ההגעה'); return result; }

    var guests = Math.floor(Number(req.guests));
    if (!isFinite(guests) || guests < 1) guests = 1;
    var infants = Math.max(0, Math.floor(Number(req.infants) || 0));
    var maxGuests = Number(apartment.maxGuests || apartment.beds || 0);
    if (maxGuests && guests > maxGuests) errors.push('הדירה מתאימה לעד ' + maxGuests + ' אורחים');
    var cribs = Number(apartment.cribs || 0);
    if (infants > cribs) {
      warnings.push(cribs === 0 ? 'אין בדירה מיטת תינוק — אפשר להביא עריסה מהבית' : 'בדירה ' + (cribs === 1 ? 'מיטת תינוק אחת' : cribs + ' מיטות תינוק'));
    }

    var nights = eachNight(req.checkin, req.checkout);
    result.nights = nights.length;
    if (nights.length > MAX_NIGHTS) { errors.push('אפשר לבקש עד ' + MAX_NIGHTS + ' לילות'); return result; }

    var rates = nights.map(function (n) { return nightRate(p, n); });
    var required = p.minNights;
    rates.forEach(function (r) { if (r.kind === 'special' && r.minNights > required) required = r.minNights; });
    if (nights.length < required) errors.push('מינימום ' + nightsLabel(required) + ' בתאריכים האלה');

    // קיבוץ לילות זהים לשורה אחת
    var groups = [];
    rates.forEach(function (r) {
      var g = groups.filter(function (x) { return x.label === r.label && x.price === r.price; })[0];
      if (g) g.count++;
      else groups.push({ label: r.label, price: r.price, kind: r.kind, count: 1 });
    });
    var lodging = 0;
    groups.forEach(function (g) {
      var amount = g.count * g.price;
      lodging += amount;
      result.lines.push({ label: lineLabel(g), detail: g.count + ' × ' + formatMoney(g.price), amount: amount });
    });

    var extraGuests = Math.max(0, guests - p.includedGuests);
    var extra = extraGuests * p.extraGuestPerNight * nights.length;
    if (extra > 0) {
      result.lines.push({
        label: 'תוספת אורחים',
        detail: (extraGuests === 1 ? 'אורח אחד' : extraGuests + ' אורחים') + ' מעל ' + p.includedGuests + ' × ' + nightsLabel(nights.length) + ' × ' + formatMoney(p.extraGuestPerNight),
        amount: extra
      });
    }

    var discount = null;
    p.lengthDiscounts.forEach(function (d) {
      if (nights.length >= d.minNights && (!discount || d.percent > discount.percent)) discount = d;
    });
    var discountAmount = discount ? Math.round((lodging + extra) * discount.percent / 100) : 0;
    if (discountAmount > 0) {
      result.lines.push({ label: 'הנחה לשהייה של ' + discount.minNights + ' לילות ומעלה', detail: discount.percent + '%', amount: -discountAmount });
    }
    if (p.cleaningFee > 0) result.lines.push({ label: 'ניקיון', detail: 'חד־פעמי', amount: p.cleaningFee });

    result.total = Math.round(lodging + extra - discountAmount + p.cleaningFee);
    result.guests = guests;
    result.infants = infants;
    result.ok = errors.length === 0;
    return result;
  }

  return {
    DEFAULTS: DEFAULTS,
    normalize: normalize,
    nightRate: nightRate,
    quote: quote,
    fromPrice: fromPrice,
    parseISO: parseISO,
    toISO: toISO,
    addDays: addDays,
    nightsBetween: nightsBetween,
    dow: dow,
    eachNight: eachNight,
    nextWeekday: nextWeekday,
    todayIL: todayIL,
    overlaps: overlaps,
    isAvailable: isAvailable,
    formatMoney: formatMoney,
    nightsLabel: nightsLabel,
    guestsLabel: guestsLabel
  };
});
