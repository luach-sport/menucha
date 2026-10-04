/* טופס בעלי דירות: בניית אובייקט הדירה, תצוגה מקדימה של המחיר, שמירת טיוטה ושליחה */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const esc = App.esc;
  const DRAFT_KEY = 'menucha.ownerDraft';
  const shownAt = Date.now();

  // ---------- צ'ק-ליסט האבזור ----------
  $('amenity-checks').innerHTML = Amenities.GROUPS.map((g) => `
    <div class="check-group">
      <h3>${esc(g.title)}</h3>
      <div class="checks">${g.items.map((it) => `
        <label class="check"><input type="checkbox" name="amenity" value="${it.id}">${Icons.svg(it.icon)}<span>${esc(it.label)}</span></label>`).join('')}
      </div>
    </div>`).join('');

  if (App.config.ownerCodeRequired) $('code-field').hidden = false;

  // ---------- קריאת הטופס ----------
  const num = (id) => { const v = $(id).value.trim(); return v === '' ? null : Number(v); };
  const lines = (id) => $(id).value.split('\n').map((s) => s.trim()).filter(Boolean);

  function parseMapLink(url) {
    const s = String(url || '');
    const m = s.match(/@(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)/) || s.match(/[?&](?:q|query|ll)=(-?\d{1,2}\.\d+),\s*(-?\d{1,3}\.\d+)/) || s.match(/^\s*(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)\s*$/);
    if (!m) return null;
    const lat = Number(m[1]), lng = Number(m[2]);
    return lat > 29 && lat < 33.6 && lng > 34 && lng < 36 ? { lat: +lat.toFixed(4), lng: +lng.toFixed(4) } : null;
  }

  function readProperty() {
    const weekendNights = Array.from($('weekend-nights').querySelectorAll('input:checked')).map((i) => Number(i.value));
    const geo = parseMapLink($('p-map').value);
    return {
      title: $('p-title').value.trim(),
      summary: $('p-summary').value.trim(),
      city: $('p-city').value.trim(),
      neighborhood: $('p-neighborhood').value.trim(),
      rooms: num('p-rooms'),
      beds: num('p-beds'),
      maxGuests: num('p-maxGuests'),
      cribs: num('p-cribs') || 0,
      description: $('p-description').value.trim(),
      highlights: lines('p-highlights').slice(0, 5),
      amenities: Array.from(document.querySelectorAll('input[name="amenity"]:checked')).map((i) => i.value),
      houseRules: lines('p-rules').slice(0, 6),
      images: lines('p-images').slice(0, 12),
      checkInTime: $('p-checkIn').value || '14:00',
      checkOutTime: $('p-checkOut').value || '11:00',
      geo: geo || undefined,
      pricing: {
        nightly: num('p-nightly'),
        weekendNightly: num('p-weekendNightly'),
        weekendNights,
        includedGuests: num('p-includedGuests'),
        extraGuestPerNight: num('p-extraGuest') || 0,
        cleaningFee: num('p-cleaningFee') || 0,
        minNights: num('p-minNights') || 1,
        lengthDiscount: { minNights: num('p-discountNights') || 0, percent: num('p-discountPercent') || 0 }
      }
    };
  }
  function readOwner() {
    return { name: $('o-name').value.trim(), phone: $('o-phone').value.trim(), email: $('o-email').value.trim() };
  }

  // ---------- תצוגה מקדימה של המחיר ----------
  function previewApartment(p) {
    const pr = p.pricing;
    return {
      maxGuests: Math.max(p.beds || 1, p.maxGuests || 1),
      beds: p.beds || 1,
      cribs: p.cribs,
      pricing: Object.assign({}, pr, {
        lengthDiscounts: pr.lengthDiscount.minNights > 1 && pr.lengthDiscount.percent > 0 ? [pr.lengthDiscount] : []
      })
    };
  }
  function renderPreview() {
    const p = readProperty();
    const a = previewApartment(p);
    const fri = Pricing.nextWeekday(Pricing.todayIL(), 5);
    const guests = Math.min(a.maxGuests, (p.pricing.includedGuests || 2) + 2);
    const nights = Math.max(1, p.pricing.minNights || 1);
    const q = Pricing.quote(a, { checkin: fri, checkout: Pricing.addDays(fri, nights), guests });
    $('preview-title').textContent = `כך זה ייראה לאורחים: ${App.stayNote(fri, Pricing.addDays(fri, nights))}, ${Pricing.guestsLabel(guests)}`;
    if (!p.pricing.nightly) {
      $('preview-quote').innerHTML = '<span class="muted small">מלאו מחיר ללילה כדי לראות דוגמה.</span>';
      return;
    }
    $('preview-quote').innerHTML = q.lines.map((l) => `
      <div class="quote-line${l.amount < 0 ? ' is-discount' : ''}"><span>${esc(l.label)}</span><span class="amt">${l.amount < 0 ? '−' : ''}${Pricing.formatMoney(Math.abs(l.amount))}</span><span class="detail">${esc(l.detail)}</span></div>`).join('') +
      `<div class="quote-total"><span>סה״כ לאורחים</span><strong class="num">${Pricing.formatMoney(q.total)}</strong></div>`;
  }

  // ---------- טיוטה בדפדפן ----------
  const form = $('owner-form');
  function saveDraft() {
    const values = {};
    form.querySelectorAll('input, textarea').forEach((el) => {
      if (!el.id || el.id === 'o-website' || el.id === 'o-code') return;
      values[el.id] = el.type === 'checkbox' ? el.checked : el.value;
    });
    values.amenities = Array.from(document.querySelectorAll('input[name="amenity"]:checked')).map((i) => i.value);
    values.weekend = Array.from($('weekend-nights').querySelectorAll('input:checked')).map((i) => i.value);
    App.local.set(DRAFT_KEY, values);
    $('draft-note').textContent = 'הטיוטה נשמרת בדפדפן הזה';
  }
  function loadDraft() {
    const d = App.local.get(DRAFT_KEY);
    if (!d) return;
    Object.keys(d).forEach((id) => { const el = $(id); if (el && el.type !== 'checkbox') el.value = d[id]; });
    (d.amenities || []).forEach((v) => { const el = form.querySelector(`input[name="amenity"][value="${v}"]`); if (el) el.checked = true; });
    if (d.weekend) $('weekend-nights').querySelectorAll('input').forEach((i) => { i.checked = d.weekend.includes(i.value); });
    $('draft-note').textContent = 'המשכנו מהטיוטה ששמרתם';
  }

  // ---------- בדיקה ושליחה ----------
  function setError(id, msg) {
    const err = $('e-' + id);
    if (err) err.textContent = msg || '';
    const map = { oname: 'o-name', ophone: 'o-phone', oemail: 'o-email', ocode: 'o-code' };
    const input = $(map[id] || 'p-' + id);
    if (input) { if (msg) input.setAttribute('aria-invalid', 'true'); else input.removeAttribute('aria-invalid'); }
  }
  function validate(p, o) {
    const errors = {};
    if (p.title.length < 3) errors.title = 'תנו לדירה שם, למשל "דירת גן ברחביה"';
    if (p.city.length < 2) errors.city = 'באיזו עיר הדירה?';
    if (!(p.beds >= 1)) errors.beds = 'כמה אנשים יכולים לישון בדירה?';
    if (p.description.length < 30) errors.description = 'כתבו לפחות שני משפטים על הדירה';
    if (!(p.pricing.nightly > 0)) errors.nightly = 'מה המחיר ללילה רגיל?';
    if (!Validate.isName(o.name)) errors.oname = 'כתבו שם מלא';
    if (!Validate.isIsraeliPhone(o.phone)) errors.ophone = 'מספר טלפון ישראלי, למשל 050-1234567';
    if (o.email && !Validate.isEmail(o.email)) errors.oemail = 'כתובת אימייל לא תקינה';
    if (App.config.ownerCodeRequired && !$('o-code').value.trim()) errors.ocode = 'צריך את הקוד מהמנהל';
    return errors;
  }

  function summaryText(p, o) {
    return [
      'שלום, אני רוצה להוסיף דירה לאתר:',
      `${p.title} — ${[p.neighborhood, p.city].filter(Boolean).join(', ')}`,
      `${p.rooms || '?'} חדרים, ${p.beds} מקומות לינה, עד ${p.maxGuests || p.beds} אורחים`,
      `מחיר: ${Pricing.formatMoney(p.pricing.nightly)} ללילה${p.pricing.weekendNightly ? `, ${Pricing.formatMoney(p.pricing.weekendNightly)} בסופ״ש` : ''}`,
      '',
      p.description,
      '',
      `${o.name}, ${o.phone}${o.email ? ', ' + o.email : ''}`
    ].join('\n');
  }

  function showDone(mode) {
    App.local.remove(DRAFT_KEY);
    form.innerHTML = `
      <div class="form-step success">
        <h2>הדירה נשלחה לאישור</h2>
        <p>${mode === 'demo' ? 'מצב הדגמה: שום דבר לא נשלח באמת. באתר האמיתי נוצרת בקשת אישור למנהל, והוא מקבל התראה.' : 'המנהל קיבל הודעה ויעבור על הפרטים. נעדכן אתכם בטלפון כשהדירה עולה לאתר.'}</p>
        ${App.config.managerWhatsApp ? `<a class="btn btn-whatsapp" target="_blank" rel="noopener" href="${esc(App.whatsappLink('שלום, שלחתי עכשיו דירה לאישור באתר. מצרף תמונות:'))}">${Icons.svg('image')}שליחת תמונות למנהל בוואטסאפ</a>` : ''}
      </div>`;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    $('owner-msg').innerHTML = '';
    const p = readProperty();
    const o = readOwner();
    const errors = validate(p, o);
    ['title', 'city', 'beds', 'description', 'nightly', 'oname', 'ophone', 'oemail', 'ocode'].forEach((k) => setError(k, errors[k]));
    const first = Object.keys(errors)[0];
    if (first) {
      const map = { oname: 'o-name', ophone: 'o-phone', oemail: 'o-email', ocode: 'o-code' };
      const el = $(map[first] || 'p-' + first);
      if (el) el.focus();
      $('owner-msg').innerHTML = `<div class="notice notice-danger">${Icons.svg('alert')}<span>חסרים ${Object.keys(errors).length === 1 ? 'פרט אחד' : Object.keys(errors).length + ' פרטים'} — הם מסומנים באדום.</span></div>`;
      return;
    }
    const payload = { property: p, owner: o, code: $('o-code').value.trim(), website: $('o-website').value, elapsedMs: Date.now() - shownAt };
    if (Validate.looksLikeBot(payload, 8000)) { showDone('demo'); return; }

    const btn = $('owner-submit');
    btn.disabled = true;
    btn.textContent = 'שולח…';
    const res = await App.submitForm('property', payload);
    btn.disabled = false;
    btn.textContent = 'שליחת הדירה לאישור';
    if (res.ok) { showDone(res.mode); return; }
    if (res.fields) Object.keys(res.fields).forEach((k) => setError(k === 'code' ? 'ocode' : k, res.fields[k]));
    const link = App.whatsappLink(summaryText(p, o));
    $('owner-msg').innerHTML = `
      <div class="notice ${res.mode === 'whatsapp' ? 'notice-info' : 'notice-danger'}">${Icons.svg(res.mode === 'whatsapp' ? 'message' : 'alert')}
        <span>${res.mode === 'whatsapp' ? 'שליחה אוטומטית עוד לא מוגדרת באתר.' : esc(res.error || 'השליחה נכשלה') + '.'} ${link ? 'אפשר לשלוח את הפרטים למנהל בוואטסאפ — ההודעה מוכנה.' : ''}</span>
      </div>
      ${link ? `<p style="margin-top:10px"><a class="btn btn-whatsapp" target="_blank" rel="noopener" href="${esc(link)}">${Icons.svg('message')}שליחה בוואטסאפ</a></p>` : ''}`;
  });

  form.addEventListener('input', (e) => {
    if (e.target.id === 'p-map') {
      const g = parseMapLink(e.target.value);
      $('map-hint').textContent = e.target.value.trim() === '' ? 'משמש לחישוב זמני השבת בעמוד הדירה. הכתובת המדויקת לא מתפרסמת.'
        : g ? `זיהינו מיקום: ${g.lat}, ${g.lng}` : 'לא זיהינו מיקום בקישור. פתחו את המקום בגוגל מפות והעתיקו את הכתובת משורת הדפדפן.';
    }
    if (e.target.id === 'o-phone' || e.target.id === 'o-name') setError(e.target.id === 'o-phone' ? 'ophone' : 'oname', '');
    renderPreview();
    saveDraft();
  });
  $('o-phone').addEventListener('blur', (e) => { if (Validate.isIsraeliPhone(e.target.value)) e.target.value = Validate.formatPhone(e.target.value); });

  loadDraft();
  renderPreview();
})();
