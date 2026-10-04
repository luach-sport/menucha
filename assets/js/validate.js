/*
 * ולידציה משותפת לדפדפן ול-GitHub Actions (window.Validate / require).
 * אותם חוקים רצים בטופס, בממסר וב-Workflow — כך שגם בקשה שעקפה את הטופס נבדקת.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Validate = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /** מנקה תווים לא תקינים, רווחים כפולים ומגביל אורך */
  function cleanText(value, max, keepNewlines) {
    var s = String(value == null ? '' : value);
    s = s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F​-‏‪-‮⁦-⁩]/g, '');
    if (keepNewlines) {
      s = s.replace(/\r\n?/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n');
    } else {
      s = s.replace(/\s+/g, ' ');
    }
    s = s.trim();
    return max ? s.slice(0, max) : s;
  }

  /** ממיר כל צורה של מספר ישראלי (+972, 972, מקפים, רווחים) לספרות שמתחילות ב-0 */
  function normalizePhone(raw) {
    var s = String(raw || '').trim();
    var plus = s.charAt(0) === '+';
    var digits = s.replace(/\D/g, '');
    if (digits.indexOf('00972') === 0) digits = '0' + digits.slice(5);
    else if (digits.indexOf('972') === 0 && (plus || digits.length >= 11)) digits = '0' + digits.slice(3);
    return digits;
  }

  /** נייד (05X), VoIP (072–079) או קווי (02,03,04,08,09) */
  function isIsraeliPhone(raw) {
    var d = normalizePhone(raw);
    return /^05\d{8}$/.test(d) || /^07[2-9]\d{7}$/.test(d) || /^0[2-489]\d{7}$/.test(d);
  }

  /** 050-1234567 / 02-6234567 */
  function formatPhone(raw) {
    var d = normalizePhone(raw);
    if (d.length === 10) return d.slice(0, 3) + '-' + d.slice(3);
    if (d.length === 9) return d.slice(0, 2) + '-' + d.slice(2);
    return d;
  }

  /** 972501234567 — הפורמט ש-WhatsApp מצפה לו */
  function internationalPhone(raw) {
    var d = normalizePhone(raw);
    return d.charAt(0) === '0' ? '972' + d.slice(1) : d;
  }

  function isEmail(raw) {
    var s = String(raw || '').trim();
    return s.length <= 254 && /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[A-Za-z֐-׿]{2,}$/.test(s);
  }

  function isName(raw) {
    var s = cleanText(raw, 80);
    return s.length >= 2 && /[A-Za-z֐-׿]/.test(s) && !/https?:|www\.|<|>/.test(s);
  }

  /** בדיקת טופס שריון. מחזיר { ok, errors: {field: msg}, value } */
  function validateLead(input) {
    input = input || {};
    var errors = {};
    var value = {
      name: cleanText(input.name, 80),
      phone: formatPhone(input.phone),
      email: cleanText(input.email, 120).toLowerCase(),
      apartmentId: cleanText(input.apartmentId, 80),
      checkin: cleanText(input.checkin, 10),
      checkout: cleanText(input.checkout, 10),
      guests: Math.max(1, Math.min(50, Math.floor(Number(input.guests) || 1))),
      infants: Math.max(0, Math.min(10, Math.floor(Number(input.infants) || 0))),
      quotedTotal: Math.max(0, Math.round(Number(input.quotedTotal) || 0))
    };
    if (!isName(value.name)) errors.name = 'כתבו שם מלא';
    if (!isIsraeliPhone(input.phone)) errors.phone = 'מספר טלפון ישראלי, למשל 050-1234567';
    if (!isEmail(value.email)) errors.email = 'כתובת אימייל מלאה, למשל name@gmail.com';
    if (!/^[a-z0-9-]{2,80}$/.test(value.apartmentId)) errors.apartmentId = 'לא נבחרה דירה';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value.checkin) || !/^\d{4}-\d{2}-\d{2}$/.test(value.checkout) || value.checkout <= value.checkin) {
      errors.dates = 'בחרו תאריכי הגעה ועזיבה';
    }
    return { ok: Object.keys(errors).length === 0, errors: errors, value: value };
  }

  /** האם השליחה נראית כמו רובוט: שדה מלכודת מלא או מילוי מהיר מדי */
  function looksLikeBot(input, minMs) {
    if (!input) return true;
    if (input.website && String(input.website).trim() !== '') return true;
    var elapsed = Number(input.elapsedMs);
    if (isFinite(elapsed) && elapsed > 0 && elapsed < (minMs || 2500)) return true;
    return false;
  }

  /** "מסתיר" פרטים אישיים לפני שהם נכתבים במקום ציבורי */
  function maskPhone(raw) {
    var d = normalizePhone(raw);
    if (d.length < 7) return '•••';
    return d.slice(0, 3) + '-•••••' + d.slice(-2);
  }
  function maskEmail(raw) {
    var s = String(raw || '');
    var at = s.indexOf('@');
    if (at < 1) return '•••';
    return s.slice(0, Math.min(2, at)) + '•••' + s.slice(at);
  }

  return {
    cleanText: cleanText,
    normalizePhone: normalizePhone,
    isIsraeliPhone: isIsraeliPhone,
    formatPhone: formatPhone,
    internationalPhone: internationalPhone,
    isEmail: isEmail,
    isName: isName,
    validateLead: validateLead,
    looksLikeBot: looksLikeBot,
    maskPhone: maskPhone,
    maskEmail: maskEmail
  };
});
