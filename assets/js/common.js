/* כלים משותפים לכל עמודי האתר (דפדפן בלבד) */
(function () {
  'use strict';

  var DEFAULTS = {
    siteName: 'מנוחה',
    siteTagline: 'דירות לשבתות ולסופי שבוע',
    relayUrl: '',
    managerWhatsApp: '',
    managerPhoneDisplay: '',
    github: { owner: '', repo: '', branch: 'main', crmRepo: '' },
    ownerCodeRequired: false,
    demoMode: false
  };
  var cfg = Object.assign({}, DEFAULTS, window.SITE_CONFIG || {});
  cfg.github = Object.assign({}, DEFAULTS.github, (window.SITE_CONFIG || {}).github || {});

  var WEEKDAY_SHORT = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];
  var WEEKDAY_LONG = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
  var MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function parts(iso) { var p = iso.split('-').map(Number); return { y: p[0], m: p[1], d: p[2] }; }

  /** ו׳ 9.10 */
  function shortDate(iso) {
    if (!iso) return '';
    var p = parts(iso);
    return WEEKDAY_SHORT[Pricing.dow(iso)] + ' ' + p.d + '.' + p.m;
  }
  /** 9.10 */
  function dayMonth(iso) { var p = parts(iso); return p.d + '.' + p.m; }
  /** יום שישי, 9 באוקטובר */
  function longDate(iso) {
    var p = parts(iso);
    return 'יום ' + WEEKDAY_LONG[Pricing.dow(iso)] + ', ' + p.d + ' ב' + MONTHS[p.m - 1];
  }

  /** "הגעה ביום שישי, יציאה במוצאי שבת" — מה שאורח שומר שבת רוצה לדעת */
  function dayName(iso, arriving) {
    var d = Pricing.dow(iso);
    if (d === 6) return arriving ? 'בשבת' : 'במוצאי שבת';
    return 'ביום ' + WEEKDAY_LONG[d];
  }
  function stayNote(checkin, checkout) {
    if (!checkin || !checkout || checkout <= checkin) return '';
    var n = Pricing.nightsBetween(checkin, checkout);
    return Pricing.nightsLabel(n) + ': הגעה ' + dayName(checkin, true) + ' ' + dayMonth(checkin) + ', יציאה ' + dayName(checkout, false) + ' ' + dayMonth(checkout);
  }
  function roomsLabel(n) { return Number(n) === 1 ? 'חדר אחד' : n + ' חדרים'; }

  /** האם השהייה כוללת שבת (ליל שישי) */
  function shabbatInStay(checkin, checkout) {
    if (!checkin || !checkout) return null;
    var fri = Pricing.nextWeekday(checkin, 5);
    return fri < checkout ? fri : null;
  }

  // אחסון בדפדפן — עטוף, כי בחלון פרטי הוא עלול לזרוק שגיאה
  function storage(kind) {
    return {
      get: function (k) { try { var v = window[kind].getItem(k); return v == null ? null : JSON.parse(v); } catch (e) { return null; } },
      set: function (k, v) { try { window[kind].setItem(k, JSON.stringify(v)); } catch (e) { /* לא קריטי */ } },
      remove: function (k) { try { window[kind].removeItem(k); } catch (e) { /* לא קריטי */ } }
    };
  }
  var local = storage('localStorage');
  var session = storage('sessionStorage');

  // ---------- נתונים ----------
  function fetchJSON(path) {
    // GitHub Pages שומר במטמון כ-10 דקות; פרמטר שמתחלף כל דקה מבטיח נתונים טריים
    var bust = Math.floor(Date.now() / 60000);
    return fetch(path + (path.indexOf('?') === -1 ? '?' : '&') + 'v=' + bust, { cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status + ' — ' + path);
      return r.json();
    });
  }
  var dataPromise = null;
  function loadData() {
    if (dataPromise) return dataPromise;
    dataPromise = Promise.all([
      fetchJSON('data/apartments.json'),
      fetchJSON('data/availability.json').catch(function () { return { blocked: {} }; })
    ]).then(function (res) {
      var apartments = (res[0].apartments || res[0] || []).filter(function (a) { return a && a.id && a.published !== false; });
      return { apartments: apartments, blocked: (res[1] && res[1].blocked) || {}, updatedAt: res[1] && res[1].updatedAt };
    });
    return dataPromise;
  }

  // ---------- מצב החיפוש (עובר מעמוד הבית לעמוד הדירה) ----------
  function defaultStay() {
    var fri = Pricing.nextWeekday(Pricing.todayIL(), 5);
    return { checkin: fri, checkout: Pricing.addDays(fri, 1) };
  }
  function readSearch() {
    var s = session.get('menucha.search') || {};
    try {
      var q = new URLSearchParams(location.search);
      if (q.get('in')) s.checkin = q.get('in');
      if (q.get('out')) s.checkout = q.get('out');
      if (q.get('g')) s.guests = Number(q.get('g'));
      if (q.get('b')) s.infants = Number(q.get('b'));
      if (q.get('where') != null) s.where = q.get('where');
    } catch (e) { /* בלי פרמטרים */ }
    var today = Pricing.todayIL();
    if (!s.checkin || !Pricing.parseISO(s.checkin) || s.checkin < today) {
      var d = defaultStay(); s.checkin = d.checkin; s.checkout = d.checkout;
    }
    if (!s.checkout || !Pricing.parseISO(s.checkout) || s.checkout <= s.checkin) s.checkout = Pricing.addDays(s.checkin, 1);
    s.guests = Math.max(1, Math.min(30, Number(s.guests) || 2));
    s.infants = Math.max(0, Math.min(6, Number(s.infants) || 0));
    s.where = s.where || '';
    return s;
  }
  function writeSearch(s, updateUrl) {
    session.set('menucha.search', s);
    if (!updateUrl) return;
    try {
      var q = new URLSearchParams(location.search);
      q.set('in', s.checkin); q.set('out', s.checkout); q.set('g', s.guests);
      if (s.infants) q.set('b', s.infants); else q.delete('b');
      if (s.where) q.set('where', s.where); else q.delete('where');
      history.replaceState(null, '', location.pathname + '?' + q.toString() + location.hash);
    } catch (e) { /* בסביבות מסוימות אסור לשנות כתובת — לא קריטי */ }
  }
  function propertyHref(id, s) {
    var q = s ? '?in=' + s.checkin + '&out=' + s.checkout + '&g=' + s.guests + (s.infants ? '&b=' + s.infants : '') : '';
    return 'property.html' + q + '#' + encodeURIComponent(id);
  }

  // ---------- שליחת טפסים ----------
  /**
   * kind: 'lead' | 'property'
   * מחזיר { ok, mode: 'relay' | 'demo' | 'whatsapp', error? }
   */
  function submitForm(kind, payload) {
    if (cfg.demoMode) {
      return new Promise(function (resolve) { setTimeout(function () { resolve({ ok: true, mode: 'demo' }); }, 700); });
    }
    if (!cfg.relayUrl) return Promise.resolve({ ok: false, mode: 'whatsapp' });
    var url = cfg.relayUrl.replace(/\/+$/, '') + '/' + kind;
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, 15000) : null;
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: ctrl ? ctrl.signal : undefined
    }).then(function (r) {
      if (timer) clearTimeout(timer);
      return r.json().catch(function () { return {}; }).then(function (body) {
        if (r.ok && body.ok) return { ok: true, mode: 'relay' };
        return { ok: false, mode: 'relay', error: body.error || ('השרת החזיר שגיאה ' + r.status), fields: body.fields };
      });
    }).catch(function () {
      if (timer) clearTimeout(timer);
      return { ok: false, mode: 'relay', error: 'אין חיבור לשרת כרגע' };
    });
  }

  function whatsappLink(text) {
    if (!cfg.managerWhatsApp) return '';
    return 'https://wa.me/' + cfg.managerWhatsApp.replace(/\D/g, '') + '?text=' + encodeURIComponent(text);
  }

  // ---------- תמונות ----------
  function imageAttrs(img, alt) {
    return 'src="' + esc(img.src) + '" alt="' + esc(img.alt || alt || '') + '" loading="lazy" decoding="async"';
  }

  // ---------- מסגרת העמוד ----------
  function hydrateChrome() {
    if (cfg.siteName && cfg.siteName !== 'מנוחה') document.title = document.title.replace('מנוחה', cfg.siteName);
    document.querySelectorAll('[data-site-name]').forEach(function (el) { el.textContent = cfg.siteName; });
    document.querySelectorAll('[data-site-tagline]').forEach(function (el) { el.textContent = cfg.siteTagline; });
    document.querySelectorAll('[data-year]').forEach(function (el) { el.textContent = new Date().getFullYear(); });
    document.querySelectorAll('[data-manager-phone]').forEach(function (el) {
      if (!cfg.managerPhoneDisplay) { el.hidden = true; return; }
      el.querySelector('[data-phone-text]').textContent = cfg.managerPhoneDisplay;
      var link = el.querySelector('a');
      if (link && cfg.managerWhatsApp) link.href = whatsappLink('שלום, יש לי שאלה לגבי דירה לשבת');
    });
    if (cfg.demoMode) {
      document.querySelectorAll('[data-demo-banner]').forEach(function (el) { el.hidden = false; });
    }
    if (window.Icons) Icons.hydrate();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', hydrateChrome);
  else hydrateChrome();

  window.App = {
    config: cfg,
    esc: esc,
    shortDate: shortDate,
    dayMonth: dayMonth,
    longDate: longDate,
    stayNote: stayNote,
    shabbatInStay: shabbatInStay,
    roomsLabel: roomsLabel,
    WEEKDAY_SHORT: WEEKDAY_SHORT,
    WEEKDAY_LONG: WEEKDAY_LONG,
    MONTHS: MONTHS,
    local: local,
    session: session,
    fetchJSON: fetchJSON,
    loadData: loadData,
    readSearch: readSearch,
    writeSearch: writeSearch,
    defaultStay: defaultStay,
    propertyHref: propertyHref,
    submitForm: submitForm,
    whatsappLink: whatsappLink,
    imageAttrs: imageAttrs
  };
})();
