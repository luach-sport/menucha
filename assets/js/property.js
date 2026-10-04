/* עמוד דירה: גלריה, אבזור, לוח תפוסה, מחשבון מחיר וטופס בקשת שריון */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const esc = App.esc;
  const root = $('prop-root');

  const state = App.readSearch();
  let apt = null;
  let blocked = [];
  let calMonth = null;          // 'YYYY-MM-01' של החודש המוצג
  let pickMode = 'start';       // בלוח: הלחיצה הבאה בוחרת הגעה או עזיבה
  let formShownAt = Date.now();
  let lastQuote = null;

  function aptId() {
    const hash = decodeURIComponent((location.hash || '').slice(1));
    if (hash) return hash;
    try { return new URLSearchParams(location.search).get('id') || ''; } catch (e) { return ''; }
  }

  // ---------- גלריה ----------
  function galleryHTML(a) {
    const imgs = a.images && a.images.length ? a.images : [];
    if (!imgs.length) return '';
    const placeholder = imgs.some((i) => i.placeholder);
    return `
      <div class="gallery">
        <div class="gallery-main">
          <img id="gal-img" ${App.imageAttrs(imgs[0], a.title)} loading="eager">
          ${imgs.length > 1 ? `
            <button class="gallery-nav prev" type="button" id="gal-prev" aria-label="התמונה הקודמת">${Icons.svg('chevronRight')}</button>
            <button class="gallery-nav next" type="button" id="gal-next" aria-label="התמונה הבאה">${Icons.svg('chevronLeft')}</button>
            <span class="gallery-count" id="gal-count" dir="ltr">1 / ${imgs.length}</span>` : ''}
          ${placeholder ? '<span class="photo-note">איור להמחשה — התמונות האמיתיות יתווספו בקרוב</span>' : ''}
        </div>
        ${imgs.length > 1 ? `<div class="thumbs" role="list">${imgs.map((im, i) => `
          <button type="button" role="listitem" data-thumb="${i}" aria-label="תמונה ${i + 1}: ${esc(im.alt || '')}" ${i === 0 ? 'aria-current="true"' : ''}>
            <img src="${esc(im.src)}" alt="" loading="lazy">
          </button>`).join('')}</div>` : ''}
      </div>`;
  }
  function wireGallery(a) {
    const imgs = a.images || [];
    if (imgs.length < 2) return;
    let i = 0;
    const show = (n) => {
      i = (n + imgs.length) % imgs.length;
      const img = $('gal-img');
      img.src = imgs[i].src;
      img.alt = imgs[i].alt || a.title;
      $('gal-count').textContent = `${i + 1} / ${imgs.length}`;
      document.querySelectorAll('[data-thumb]').forEach((b) => b.setAttribute('aria-current', String(Number(b.dataset.thumb) === i)));
    };
    $('gal-prev').addEventListener('click', () => show(i - 1));
    $('gal-next').addEventListener('click', () => show(i + 1));
    document.querySelectorAll('[data-thumb]').forEach((b) => b.addEventListener('click', () => show(Number(b.dataset.thumb))));
    document.querySelector('.gallery-main').addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') show(i + 1);
      if (e.key === 'ArrowRight') show(i - 1);
    });
  }

  // ---------- תוכן ----------
  function amenitiesHTML(a) {
    const have = a.amenities || [];
    const essentials = ['plata', 'urn', 'shabbat_clocks', 'kosher_kitchen'];
    return Amenities.GROUPS.map((g) => {
      const items = g.items.filter((it) => have.includes(it.id) || (g.id === 'shabbat' && essentials.includes(it.id)));
      if (!items.length) return '';
      return `<div class="amenity-group"><h3>${esc(g.title)}</h3><ul>${items.map((it) => {
        const missing = !have.includes(it.id);
        return `<li class="${missing ? 'is-missing' : ''}">${Icons.svg(it.icon)}<span>${esc(it.label)}${missing ? '<span class="sr-only"> — אין בדירה</span>' : ''}</span></li>`;
      }).join('')}</ul></div>`;
    }).join('');
  }

  function pricingRulesHTML(a) {
    const p = Pricing.normalize(a.pricing);
    const names = { 4: 'חמישי', 5: 'שישי', 6: 'מוצאי שבת' };
    const wk = p.weekendNights.filter((d) => names[d]).map((d) => `ליל ${names[d]}`);
    const rows = [];
    rows.push(`לילה רגיל: <strong class="num">${Pricing.formatMoney(p.nightly)}</strong>`);
    if (p.weekendNightly != null) rows.push(`${esc(wk.join(' ו') || 'לילות סופ״ש')}: <strong class="num">${Pricing.formatMoney(p.weekendNightly)}</strong>`);
    rows.push(`המחיר כולל עד ${p.includedGuests} אורחים${p.extraGuestPerNight ? `, ומעבר לזה <strong class="num">${Pricing.formatMoney(p.extraGuestPerNight)}</strong> לאורח ללילה` : ''}. תינוקות עד גיל 2 לא נספרים.`);
    if (p.cleaningFee) rows.push(`ניקיון: <strong class="num">${Pricing.formatMoney(p.cleaningFee)}</strong> פעם אחת לשהייה`);
    if (p.minNights > 1) rows.push(`מינימום ${Pricing.nightsLabel(p.minNights)}`);
    p.lengthDiscounts.forEach((d) => rows.push(`${d.percent}% הנחה מ־${d.minNights} לילות ומעלה`));
    p.specialPeriods.filter((s) => s.to >= Pricing.todayIL()).forEach((s) => {
      rows.push(`${esc(s.name)} (${App.dayMonth(s.from)}–${App.dayMonth(s.to)}): <strong class="num">${Pricing.formatMoney(s.nightly)}</strong> ללילה${s.minNights > 1 ? `, מינימום ${Pricing.nightsLabel(s.minNights)}` : ''}`);
    });
    return `<ul class="rules">${rows.map((r) => `<li>${r}</li>`).join('')}</ul>`;
  }

  function render() {
    const a = apt;
    document.title = `${a.title} · ${App.config.siteName}`;
    const place = [a.neighborhood, a.city].filter(Boolean).join(', ');
    const paragraphs = String(a.description || '').split(/\n{2,}/).map((p) => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('');
    root.innerHTML = `
      <div class="prop-head">
        <h1>${esc(a.title)}</h1>
        <span class="place">${Icons.svg('pin')}${esc(place)}</span>
        <div class="facts">
          <span>${Icons.svg('users')}עד ${a.maxGuests} אורחים</span>
          <span>${Icons.svg('bed')}${a.beds} מקומות לינה</span>
          <span>${Icons.svg('door')}${App.roomsLabel(a.rooms)}</span>
          ${a.cribs ? `<span>${Icons.svg('crib')}${a.cribs === 1 ? 'מיטת תינוק' : a.cribs + ' מיטות תינוק'}</span>` : ''}
        </div>
      </div>
      ${galleryHTML(a)}
      <div class="prop-layout">
        <div class="prop-main">
          <section class="prop-section" aria-labelledby="h-about">
            <h2 id="h-about">על הדירה</h2>
            <div class="prose">${paragraphs}</div>
            ${a.highlights && a.highlights.length ? `<ul class="highlights">${a.highlights.map((h) => `<li>${Icons.svg('check')}<span>${esc(h)}</span></li>`).join('')}</ul>` : ''}
          </section>
          <section class="prop-section" aria-labelledby="h-amen">
            <h2 id="h-amen">מה יש בדירה</h2>
            <div class="amenity-groups">${amenitiesHTML(a)}</div>
          </section>
          <section class="prop-section" aria-labelledby="h-price">
            <h2 id="h-price">איך מחושב המחיר</h2>
            ${pricingRulesHTML(a)}
          </section>
          <section class="prop-section" aria-labelledby="h-rules">
            <h2 id="h-rules">כניסה, יציאה וכללי הבית</h2>
            <div class="times-row">
              <span>${Icons.svg('door')}כניסה מ־${esc(a.checkInTime || '14:00')}</span>
              <span>${Icons.svg('logout')}יציאה עד ${esc(a.checkOutTime || '11:00')}</span>
              ${(a.amenities || []).includes('late_checkout_motzash') ? `<span>${Icons.svg('motzash')}כשהיציאה בשבת — אחרי צאת השבת</span>` : ''}
            </div>
            ${a.houseRules && a.houseRules.length ? `<ul class="rules">${a.houseRules.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>` : ''}
          </section>
        </div>
        <aside class="booking" id="booking" aria-labelledby="h-book">
          <div class="booking-head"><h2 id="h-book">בקשת שריון</h2><span class="small muted">בלי תשלום עכשיו</span></div>
          <div class="booking-dates">
            <div class="field"><label for="b-in">הגעה</label><input class="input" type="date" id="b-in"></div>
            <div class="field"><label for="b-out">עזיבה</label><input class="input" type="date" id="b-out"></div>
          </div>
          <div class="booking-guests">
            <div class="field">
              <span class="label" id="bg-label">אורחים</span>
              <div class="stepper" role="group" aria-labelledby="bg-label">
                <button type="button" data-bstep="guests" data-delta="-1" aria-label="פחות אורחים">${Icons.svg('minus')}</button>
                <output id="b-guests">2</output>
                <button type="button" data-bstep="guests" data-delta="1" aria-label="עוד אורח">${Icons.svg('plus')}</button>
              </div>
            </div>
            <div class="field">
              <span class="label" id="bi-label">תינוקות</span>
              <div class="stepper" role="group" aria-labelledby="bi-label">
                <button type="button" data-bstep="infants" data-delta="-1" aria-label="פחות תינוקות">${Icons.svg('minus')}</button>
                <output id="b-infants">0</output>
                <button type="button" data-bstep="infants" data-delta="1" aria-label="עוד תינוק">${Icons.svg('plus')}</button>
              </div>
            </div>
          </div>
          <p class="small muted" id="b-stay"></p>
          <div id="b-avail"></div>
          <div class="cal" id="cal"></div>
          <div class="quote" id="quote" aria-live="polite"></div>
          <div id="zmanim"></div>
          <form class="form-grid" id="lead-form" novalidate>
            <div class="field">
              <label for="f-name">שם מלא</label>
              <input class="input" id="f-name" name="name" autocomplete="name" required maxlength="80">
              <span class="field-error" id="e-name"></span>
            </div>
            <div class="field">
              <label for="f-phone">טלפון</label>
              <input class="input num" id="f-phone" name="phone" type="tel" inputmode="tel" autocomplete="tel" dir="ltr" placeholder="050-1234567" required maxlength="20">
              <span class="field-error" id="e-phone"></span>
            </div>
            <div class="field">
              <label for="f-email">אימייל</label>
              <input class="input" id="f-email" name="email" type="email" inputmode="email" autocomplete="email" dir="ltr" placeholder="name@gmail.com" required maxlength="120">
              <span class="field-error" id="e-email"></span>
            </div>
            <div class="hp-field" aria-hidden="true">
              <label for="f-website">אתר אינטרנט (השאירו ריק)</label>
              <input id="f-website" name="website" type="text" tabindex="-1" autocomplete="off">
            </div>
            <div id="form-msg" aria-live="assertive"></div>
            <button class="btn" type="submit" id="f-submit">שליחת בקשת שריון</button>
            <p class="form-note">זו בקשה, לא הזמנה סופית. המנהל יחזור אליכם בטלפון כדי לאשר זמינות ולסגור. לא צריך כרטיס אשראי. הפרטים משמשים רק כדי לחזור אליכם לגבי הבקשה.</p>
          </form>
        </aside>
      </div>`;

    wireGallery(a);
    wireBooking();
    formShownAt = Date.now();
  }

  // ---------- לוח שנה ----------
  function isBusyNight(iso) {
    return blocked.some((r) => iso >= r.from && iso < r.to);
  }
  function monthStart(iso) { return iso.slice(0, 8) + '01'; }
  function addMonths(first, n) {
    const [y, m] = first.split('-').map(Number);
    const d = new Date(Date.UTC(y, m - 1 + n, 1));
    return d.toISOString().slice(0, 10);
  }
  function renderCalendar() {
    const today = Pricing.todayIL();
    if (!calMonth) calMonth = monthStart(state.checkin);
    const [y, m] = calMonth.split('-').map(Number);
    const startDow = Pricing.dow(calMonth);
    const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const canPrev = calMonth > monthStart(today);
    let cells = App.WEEKDAY_SHORT.map((d) => `<span class="dow">${d}</span>`).join('');
    for (let i = 0; i < startDow; i++) cells += '<span></span>';
    for (let d = 1; d <= days; d++) {
      const iso = `${calMonth.slice(0, 8)}${String(d).padStart(2, '0')}`;
      const cls = ['cal-day'];
      const past = iso < today;
      const busy = !past && isBusyNight(iso);
      if (past) cls.push('is-past');
      if (busy) cls.push('is-busy');
      if (Pricing.dow(iso) === 5 || Pricing.dow(iso) === 6) cls.push('is-shabbat');
      if (iso === state.checkin) cls.push('is-start');
      else if (iso === state.checkout) cls.push('is-end');
      else if (iso > state.checkin && iso < state.checkout) cls.push('in-range');
      const label = `${App.longDate(iso)}${busy ? ', הלילה תפוס' : ''}`;
      cells += `<button type="button" class="${cls.join(' ')}" data-day="${iso}" aria-label="${esc(label)}" ${past ? 'disabled' : ''}>${d}</button>`;
    }
    $('cal').innerHTML = `
      <div class="cal-head">
        <button type="button" id="cal-prev" aria-label="החודש הקודם" ${canPrev ? '' : 'disabled'}>${Icons.svg('chevronRight')}</button>
        <strong>${App.MONTHS[m - 1]} ${y}</strong>
        <button type="button" id="cal-next" aria-label="החודש הבא">${Icons.svg('chevronLeft')}</button>
      </div>
      <div class="cal-grid">${cells}</div>
      <div class="cal-legend"><span><i class="lg-sel"></i>התאריכים שלכם</span><span><i class="lg-busy"></i>תפוס</span><span>${pickMode === 'end' ? 'עכשיו בחרו את יום העזיבה' : 'לחצו על יום ההגעה'}</span></div>`;
    $('cal-prev').addEventListener('click', () => { calMonth = addMonths(calMonth, -1); renderCalendar(); });
    $('cal-next').addEventListener('click', () => { calMonth = addMonths(calMonth, 1); renderCalendar(); });
    $('cal').querySelectorAll('[data-day]').forEach((b) => b.addEventListener('click', () => pickDay(b.dataset.day)));
  }
  function pickDay(iso) {
    if (pickMode === 'start' || iso <= state.checkin) {
      if (isBusyNight(iso)) { flashAvail('הלילה של ' + App.shortDate(iso) + ' כבר תפוס. בחרו יום אחר.'); return; }
      state.checkin = iso;
      state.checkout = Pricing.addDays(iso, 1);
      pickMode = 'end';
    } else {
      const nights = Pricing.eachNight(state.checkin, iso);
      if (nights.some(isBusyNight)) { flashAvail('יש לילה תפוס בטווח הזה. בחרו עזיבה מוקדמת יותר.'); return; }
      state.checkout = iso;
      pickMode = 'start';
    }
    update();
  }
  function flashAvail(msg) {
    $('b-avail').innerHTML = `<div class="notice notice-warn">${Icons.svg('info')}<span>${esc(msg)}</span></div>`;
  }

  // ---------- מחיר וזמנים ----------
  function renderQuote() {
    const q = Pricing.quote(apt, state);
    lastQuote = q;
    const available = Pricing.isAvailable(blocked, state.checkin, state.checkout);
    $('b-avail').innerHTML = available
      ? `<div class="notice notice-ok">${Icons.svg('check')}<span>פנוי בתאריכים האלה</span></div>`
      : `<div class="notice notice-danger">${Icons.svg('x')}<span>חלק מהלילות כבר תפוסים. בחרו תאריכים אחרים בלוח.</span></div>`;

    let html = '';
    if (q.errors.length) html += `<div class="quote-errors">${q.errors.map((e) => `<div class="notice notice-danger">${Icons.svg('alert')}<span>${esc(e)}</span></div>`).join('')}</div>`;
    if (q.lines.length) {
      html += q.lines.map((l) => `
        <div class="quote-line${l.amount < 0 ? ' is-discount' : ''}">
          <span>${esc(l.label)}</span><span class="amt">${l.amount < 0 ? '−' : ''}${Pricing.formatMoney(Math.abs(l.amount))}</span>
          <span class="detail">${esc(l.detail)}</span>
        </div>`).join('');
      html += `<div class="quote-total"><span>סה״כ משוער</span><strong class="num">${Pricing.formatMoney(q.total)}</strong></div>`;
    }
    q.warnings.forEach((w) => { html += `<div class="notice notice-warn">${Icons.svg('info')}<span>${esc(w)}</span></div>`; });
    $('quote').innerHTML = html;

    const canSend = q.ok && available;
    $('f-submit').disabled = !canSend;
    $('mobile-bar').hidden = !q.lines.length;
    $('mobile-total').textContent = q.lines.length ? Pricing.formatMoney(q.total) : '';
    $('mobile-for').textContent = q.lines.length ? `${Pricing.nightsLabel(q.nights)}, ${Pricing.guestsLabel(q.guests)}` : '';
  }

  function renderZmanim() {
    const fri = App.shabbatInStay(state.checkin, state.checkout);
    if (!fri || !apt.geo) { $('zmanim').innerHTML = ''; return; }
    const t = Zmanim.shabbatTimes(fri, apt.geo.lat, apt.geo.lng, apt.candleLightingMinutes);
    if (!t) { $('zmanim').innerHTML = ''; return; }
    const heb = Zmanim.hebrewDate(Pricing.addDays(fri, 1));
    $('zmanim').innerHTML = `
      <div class="zmanim-box">
        <span class="title">השבת ב${esc(apt.city)}${heb ? ', ' + esc(heb) : ''}</span>
        <div class="row"><span>${Icons.svg('candles')}הדלקת נרות</span><span>${Zmanim.formatTime(t.candles)}</span></div>
        <div class="row"><span>${Icons.svg('moon')}צאת שבת</span><span>${Zmanim.formatTime(t.havdalah)}</span></div>
        <span class="small muted">זמנים משוערים. כדאי להגיע לפחות שעתיים לפני השבת.</span>
      </div>`;
  }

  function update() {
    App.writeSearch(state, true);
    $('b-in').value = state.checkin;
    $('b-in').min = Pricing.todayIL();
    $('b-out').value = state.checkout;
    $('b-out').min = Pricing.addDays(state.checkin, 1);
    $('b-guests').textContent = state.guests;
    $('b-infants').textContent = state.infants;
    const max = apt.maxGuests || apt.beds || 30;
    document.querySelectorAll('[data-bstep]').forEach((b) => {
      const key = b.dataset.bstep;
      const v = state[key] + Number(b.dataset.delta);
      b.disabled = key === 'guests' ? v < 1 || v > max : v < 0 || v > 6;
    });
    $('b-stay').textContent = App.stayNote(state.checkin, state.checkout);
    const back = $('back-link');
    back.href = 'index.html?in=' + state.checkin + '&out=' + state.checkout + '&g=' + state.guests + (state.infants ? '&b=' + state.infants : '');
    if (monthStart(state.checkin) !== calMonth && pickMode === 'start') calMonth = monthStart(state.checkin);
    renderCalendar();
    renderQuote();
    renderZmanim();
  }

  // ---------- טופס ----------
  function setFieldError(field, msg) {
    const input = $('f-' + field);
    const err = $('e-' + field);
    if (!input || !err) return;
    err.textContent = msg || '';
    if (msg) input.setAttribute('aria-invalid', 'true');
    else input.removeAttribute('aria-invalid');
  }

  function leadText() {
    const q = lastQuote || {};
    return [
      'שלום, אני רוצה לשריין דירה:',
      `${apt.title} (${[apt.neighborhood, apt.city].filter(Boolean).join(', ')})`,
      App.stayNote(state.checkin, state.checkout),
      `${Pricing.guestsLabel(state.guests)}${state.infants ? ` + ${state.infants === 1 ? 'תינוק' : state.infants + ' תינוקות'}` : ''}`,
      q.total ? `מחיר משוער: ${Pricing.formatMoney(q.total)}` : '',
      '',
      `שם: ${$('f-name').value.trim()}`,
      `טלפון: ${$('f-phone').value.trim()}`,
      `אימייל: ${$('f-email').value.trim()}`
    ].filter((l) => l !== '').join('\n');
  }

  function showSuccess(mode, lead) {
    const form = $('lead-form');
    const msg = mode === 'demo'
      ? 'מצב הדגמה: הבקשה לא נשלחה באמת. באתר האמיתי היא נשמרת כפניה, והמנהל מקבל התראה לטלפון.'
      : `המנהל קיבל את הבקשה ויחזור אליך בטלפון ${esc(lead.phone)}, בדרך כלל באותו יום.`;
    form.innerHTML = `
      <div class="success">
        <h3>הבקשה נשלחה</h3>
        <p>${msg}</p>
        <div class="copy-box small">${esc(App.stayNote(lead.checkin, lead.checkout))}, ${Pricing.guestsLabel(lead.guests)}, ${Pricing.formatMoney(lead.quotedTotal)}</div>
        <button class="link-button" type="button" id="another">בקשה נוספת</button>
      </div>`;
    $('another').addEventListener('click', () => { render(); update(); });
  }

  function showWhatsAppFallback(reason) {
    const link = App.whatsappLink(leadText());
    $('form-msg').innerHTML = `
      <div class="notice ${reason ? 'notice-danger' : 'notice-info'}">${Icons.svg(reason ? 'alert' : 'message')}
        <span>${reason ? esc(reason) + '. ' : ''}${link ? 'אפשר לשלוח את אותה בקשה ישירות למנהל בוואטסאפ — ההודעה כבר מוכנה.' : 'נסו שוב בעוד כמה דקות.'}</span>
      </div>
      ${link ? `<a class="btn btn-whatsapp" href="${esc(link)}" target="_blank" rel="noopener">${Icons.svg('message')}שליחה בוואטסאפ</a>` : ''}
      ${App.config.managerPhoneDisplay ? `<p class="form-note">או בטלפון: <span class="num" dir="ltr">${esc(App.config.managerPhoneDisplay)}</span></p>` : ''}`;
  }

  async function onSubmit(e) {
    e.preventDefault();
    $('form-msg').innerHTML = '';
    const payload = {
      name: $('f-name').value,
      phone: $('f-phone').value,
      email: $('f-email').value,
      apartmentId: apt.id,
      checkin: state.checkin,
      checkout: state.checkout,
      guests: state.guests,
      infants: state.infants,
      quotedTotal: lastQuote ? lastQuote.total : 0,
      website: $('f-website').value,
      elapsedMs: Date.now() - formShownAt
    };
    const check = Validate.validateLead(payload);
    ['name', 'phone', 'email'].forEach((f) => setFieldError(f, check.errors[f]));
    if (!check.ok) {
      const first = ['name', 'phone', 'email'].find((f) => check.errors[f]);
      if (first) $('f-' + first).focus();
      else if (check.errors.dates) $('form-msg').innerHTML = `<div class="notice notice-danger">${Icons.svg('alert')}<span>${esc(check.errors.dates)}</span></div>`;
      return;
    }
    // רובוט שמילא את שדה המלכודת מקבל "הצלחה" מזויפת ולא נשלח כלום
    if (Validate.looksLikeBot(payload)) { showSuccess('demo', check.value); return; }

    const btn = $('f-submit');
    btn.disabled = true;
    btn.textContent = 'שולח…';
    const res = await App.submitForm('lead', Object.assign({}, check.value, { website: payload.website, elapsedMs: payload.elapsedMs }));
    btn.disabled = false;
    btn.textContent = 'שליחת בקשת שריון';
    if (res.ok) { showSuccess(res.mode, check.value); return; }
    if (res.fields) Object.keys(res.fields).forEach((f) => setFieldError(f, res.fields[f]));
    showWhatsAppFallback(res.mode === 'whatsapp' ? '' : res.error);
  }

  function wireBooking() {
    $('b-in').addEventListener('change', (e) => {
      const v = e.target.value;
      if (!Pricing.parseISO(v)) return;
      const len = Math.max(1, Pricing.nightsBetween(state.checkin, state.checkout));
      state.checkin = v < Pricing.todayIL() ? Pricing.todayIL() : v;
      if (state.checkout <= state.checkin) state.checkout = Pricing.addDays(state.checkin, len);
      pickMode = 'start';
      update();
    });
    $('b-out').addEventListener('change', (e) => {
      const v = e.target.value;
      if (!Pricing.parseISO(v)) return;
      state.checkout = v <= state.checkin ? Pricing.addDays(state.checkin, 1) : v;
      pickMode = 'start';
      update();
    });
    document.querySelectorAll('[data-bstep]').forEach((b) => b.addEventListener('click', () => {
      const key = b.dataset.bstep;
      const max = key === 'guests' ? (apt.maxGuests || 30) : 6;
      const min = key === 'guests' ? 1 : 0;
      state[key] = Math.min(max, Math.max(min, state[key] + Number(b.dataset.delta)));
      update();
    }));
    ['name', 'phone', 'email'].forEach((f) => $('f-' + f).addEventListener('input', () => setFieldError(f, '')));
    $('f-phone').addEventListener('blur', (e) => {
      if (Validate.isIsraeliPhone(e.target.value)) e.target.value = Validate.formatPhone(e.target.value);
    });
    $('lead-form').addEventListener('submit', onSubmit);
  }

  // ---------- טעינה ----------
  function notFound() {
    root.innerHTML = `<div class="empty">${Icons.svg('home')}<p>לא מצאנו את הדירה הזו. אולי הקישור ישן.</p><a class="btn btn-quiet" href="index.html">לכל הדירות</a></div>`;
  }

  App.loadData().then((d) => {
    apt = d.apartments.find((a) => a.id === aptId());
    if (!apt) { notFound(); return; }
    blocked = d.blocked[apt.id] || [];
    state.guests = Math.min(state.guests, apt.maxGuests || state.guests);
    render();
    update();
  }).catch((err) => {
    console.error(err);
    root.innerHTML = `<div class="empty">${Icons.svg('alert')}<p>לא הצלחנו לטעון את פרטי הדירה. רעננו את העמוד בעוד רגע.</p></div>`;
  });

  $('mobile-book').addEventListener('click', () => {
    const el = $('booking');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  window.addEventListener('hashchange', () => { if (apt && aptId() && aptId() !== apt.id) location.reload(); });
})();
