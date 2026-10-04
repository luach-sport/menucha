/*
 * זמני שבת ותאריך עברי — בלי שירות חיצוני.
 * שקיעה מחושבת באלגוריתם האסטרונומי הסטנדרטי (Almanac for Computers),
 * הדלקת נרות = שקיעה פחות X דקות (מוגדר לכל דירה, ברירת מחדל 18),
 * צאת שבת = השמש 8.5° מתחת לאופק. הזמנים משוערים בדיוק של כדקה.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Zmanim = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var RAD = Math.PI / 180;
  function sin(d) { return Math.sin(d * RAD); }
  function cos(d) { return Math.cos(d * RAD); }
  function tan(d) { return Math.tan(d * RAD); }
  function mod(a, n) { return ((a % n) + n) % n; }

  /** זמן אירוע שמש (UTC) ביום iso. zenith 90.833 = שקיעה, 98.5 = צאת הכוכבים */
  function sunEvent(iso, lat, lng, zenith, rising) {
    var p = iso.split('-').map(Number);
    var start = Date.UTC(p[0], 0, 1);
    var dayOfYear = Math.floor((Date.UTC(p[0], p[1] - 1, p[2]) - start) / 86400000) + 1;
    var lngHour = lng / 15;
    var t = dayOfYear + ((rising ? 6 : 18) - lngHour) / 24;
    var M = 0.9856 * t - 3.289;
    var L = mod(M + 1.916 * sin(M) + 0.020 * sin(2 * M) + 282.634, 360);
    var RA = mod(Math.atan(0.91764 * tan(L)) / RAD, 360);
    RA = (RA + (Math.floor(L / 90) * 90 - Math.floor(RA / 90) * 90)) / 15;
    var sinDec = 0.39782 * sin(L);
    var cosDec = Math.cos(Math.asin(sinDec));
    var cosH = (cos(zenith) - sinDec * sin(lat)) / (cosDec * cos(lat));
    if (cosH > 1 || cosH < -1) return null;
    var H = (rising ? 360 - Math.acos(cosH) / RAD : Math.acos(cosH) / RAD) / 15;
    var T = H + RA - 0.06571 * t - 6.622;
    var UT = mod(T - lngHour, 24);
    return new Date(Date.UTC(p[0], p[1] - 1, p[2]) + UT * 3600000);
  }

  function addDaysISO(iso, n) {
    var p = iso.split('-').map(Number);
    return new Date(Date.UTC(p[0], p[1] - 1, p[2] + n)).toISOString().slice(0, 10);
  }

  /** זמני שבת לשבת שמתחילה ביום שישי fridayISO */
  function shabbatTimes(fridayISO, lat, lng, candleMinutes) {
    if (lat == null || lng == null) return null;
    var sunset = sunEvent(fridayISO, lat, lng, 90.833, false);
    var tzeit = sunEvent(addDaysISO(fridayISO, 1), lat, lng, 98.5, false);
    if (!sunset || !tzeit) return null;
    var minutes = candleMinutes == null ? 18 : Number(candleMinutes);
    return {
      candles: new Date(sunset.getTime() - minutes * 60000),
      havdalah: tzeit
    };
  }

  var timeFmt = null;
  function formatTime(date) {
    if (!date) return '';
    if (!timeFmt) {
      try {
        timeFmt = new Intl.DateTimeFormat('he-IL', { timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
      } catch (e) {
        timeFmt = { format: function (d) { return d.toISOString().slice(11, 16) + ' UTC'; } };
      }
    }
    return timeFmt.format(date);
  }

  // ---------- תאריך עברי ----------
  var ONES = ['', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט'];
  var TENS = ['', 'י', 'כ', 'ל'];
  /** 1..30 → א׳ ... ל׳ (ט״ו, ט״ז) */
  function gematria(n) {
    if (n === 15) return 'ט״ו';
    if (n === 16) return 'ט״ז';
    var s = TENS[Math.floor(n / 10)] + ONES[n % 10];
    return s.length === 1 ? s + '׳' : s.slice(0, -1) + '״' + s.slice(-1);
  }

  var hebFmt = null;
  /** "כ״ח בתשרי" — או מחרוזת ריקה בדפדפן שלא תומך בלוח העברי */
  function hebrewDate(iso) {
    try {
      if (!hebFmt) hebFmt = new Intl.DateTimeFormat('he-u-ca-hebrew', { day: 'numeric', month: 'long', timeZone: 'UTC' });
      var p = iso.split('-').map(Number);
      var parts = hebFmt.formatToParts(new Date(Date.UTC(p[0], p[1] - 1, p[2], 12)));
      var day = 0, month = '';
      parts.forEach(function (x) {
        if (x.type === 'day') day = parseInt(x.value, 10);
        if (x.type === 'month') month = x.value;
      });
      if (!day || !month || /\d/.test(month)) return '';
      return gematria(day) + ' ב' + month;
    } catch (e) {
      return '';
    }
  }

  return { sunEvent: sunEvent, shabbatTimes: shabbatTimes, formatTime: formatTime, hebrewDate: hebrewDate, gematria: gematria };
});
