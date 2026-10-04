/* עמוד הבית: זמני שבת, חיפוש ותוצאות עם מחיר אמיתי לתאריכים */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var esc = App.esc;
  var state = App.readSearch();
  var data = null;

  // ---------- זמני השבת הקרובה ----------
  function renderZmanim(apartments) {
    var fri = Pricing.nextWeekday(Pricing.todayIL(), 5);
    var sat = Pricing.addDays(fri, 1);
    var heb = Zmanim.hebrewDate(sat);
    $('this-shabbat-date').textContent = App.shortDate(fri) + (heb ? ', שבת ' + heb : '');
    var cities = {};
    apartments.forEach(function (a) {
      if (!a.geo) return;
      if (!cities[a.city]) cities[a.city] = { city: a.city, geo: a.geo, minutes: a.candleLightingMinutes, count: 0 };
      cities[a.city].count++;
    });
    var list = Object.keys(cities).map(function (k) { return cities[k]; })
      .sort(function (a, b) { return b.count - a.count || a.city.localeCompare(b.city, 'he'); })
      .slice(0, 4);
    if (!list.length) { $('this-shabbat').hidden = true; return; }
    $('zmanim-rows').innerHTML = list.map(function (c) {
      var t = Zmanim.shabbatTimes(fri, c.geo.lat, c.geo.lng, c.minutes);
      if (!t) return '';
      return '<tr><td>' + esc(c.city) + '</td>' +
        '<td>' + Icons.svg('candles', 'flame-flicker') + Zmanim.formatTime(t.candles) + '</td>' +
        '<td>' + Icons.svg('moon') + Zmanim.formatTime(t.havdalah) + '</td></tr>';
    }).join('');
  }

  // ---------- תאריכים מהירים ----------
  function quickOptions() {
    var today = Pricing.todayIL();
    var fri = Pricing.nextWeekday(today, 5);
    var thu = Pricing.addDays(fri, -1);
    var opts = [{ label: 'השבת הקרובה', checkin: fri, checkout: Pricing.addDays(fri, 1) }];
    if (thu >= today) opts.push({ label: 'חמישי עד מוצ״ש', checkin: thu, checkout: Pricing.addDays(fri, 1) });
    opts.push({ label: 'שבת ועוד לילה', checkin: fri, checkout: Pricing.addDays(fri, 2) });
    opts.push({ label: 'השבת שאחריה', checkin: Pricing.addDays(fri, 7), checkout: Pricing.addDays(fri, 8) });
    return opts;
  }
  function rangeText(a, b) {
    var pa = a.split('-').map(Number), pb = b.split('-').map(Number);
    return pa[1] === pb[1] ? pa[2] + '–' + pb[2] + '.' + pb[1] : App.dayMonth(a) + '–' + App.dayMonth(b);
  }
  function renderQuick() {
    var box = $('quick-dates');
    box.querySelectorAll('.chip').forEach(function (c) { c.remove(); });
    quickOptions().forEach(function (o) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip';
      b.setAttribute('aria-pressed', String(o.checkin === state.checkin && o.checkout === state.checkout));
      b.innerHTML = esc(o.label) + ' <small class="num">' + rangeText(o.checkin, o.checkout) + '</small>';
      b.addEventListener('click', function () { state.checkin = o.checkin; state.checkout = o.checkout; sync(); });
      box.appendChild(b);
    });
  }

  // ---------- טופס ----------
  function fillWhere(apartments) {
    var byCity = {};
    apartments.forEach(function (a) {
      byCity[a.city] = byCity[a.city] || {};
      if (a.neighborhood) byCity[a.city][a.neighborhood] = true;
    });
    var sel = $('where');
    Object.keys(byCity).sort(function (a, b) { return a.localeCompare(b, 'he'); }).forEach(function (city) {
      var hoods = Object.keys(byCity[city]).sort(function (a, b) { return a.localeCompare(b, 'he'); });
      var g = document.createElement('optgroup');
      g.label = city;
      g.innerHTML = '<option value="' + esc(city) + '">' + esc(city) + ' — כל העיר</option>' +
        (hoods.length > 1 ? hoods.map(function (h) { return '<option value="' + esc(city + '|' + h) + '">' + esc(h) + '</option>'; }).join('') : '');
      sel.appendChild(g);
    });
    sel.value = state.where;
    if (sel.value !== state.where) { state.where = ''; sel.value = ''; }
  }

  function syncInputs() {
    var today = Pricing.todayIL();
    $('checkin').min = today;
    $('checkin').value = state.checkin;
    $('checkout').min = Pricing.addDays(state.checkin, 1);
    $('checkout').value = state.checkout;
    $('guests').textContent = state.guests;
    $('infants').textContent = state.infants;
    document.querySelectorAll('[data-step]').forEach(function (b) {
      var key = b.getAttribute('data-step'), d = Number(b.getAttribute('data-delta'));
      var v = state[key] + d;
      b.disabled = key === 'guests' ? (v < 1 || v > 30) : (v < 0 || v > 6);
    });
    var sat = App.shabbatInStay(state.checkin, state.checkout);
    var heb = sat ? Zmanim.hebrewDate(Pricing.addDays(sat, 1)) : '';
    var note = App.stayNote(state.checkin, state.checkout);
    var parts = note.split(': ');
    $('stay-summary').innerHTML = '<span><strong>' + esc(parts[0]) + '</strong>: ' + esc(parts.slice(1).join(': ')) + '</span>' +
      (heb ? '<span class="heb">שבת ' + esc(heb) + '</span>' : '');
  }

  function sync() {
    App.writeSearch(state, true);
    syncInputs();
    renderQuick();
    renderResults();
  }

  // ---------- תוצאות ----------
  function matchesWhere(a) {
    if (!state.where) return true;
    var p = state.where.split('|');
    return a.city === p[0] && (!p[1] || a.neighborhood === p[1]);
  }

  function amenityTags(a) {
    var have = a.amenities || [];
    return Amenities.KEY_FOR_LISTING.filter(function (id) { return have.indexOf(id) !== -1; }).slice(0, 5).map(function (id) {
      var am = Amenities.get(id);
      return '<span class="amenity-tag">' + Icons.svg(am.icon) + esc(am.label) + '</span>';
    }).join('');
  }

  function listingHTML(item) {
    var a = item.apt, q = item.quote;
    var img = (a.images || [])[0];
    var href = App.propertyHref(a.id, state);
    var priceBlock;
    if (!item.available) {
      priceBlock = '<span class="status status-busy">' + Icons.svg('x') + 'תפוס בתאריכים האלה</span>' +
        '<span class="price-total num">' + Pricing.formatMoney(q.total) + '</span>' +
        '<a class="btn btn-quiet" href="' + href + '">לתאריכים פנויים</a>';
    } else if (!q.ok) {
      priceBlock = '<span class="status status-warn">' + Icons.svg('info') + esc(q.errors[0]) + '</span>' +
        '<span class="price-from">מ־<strong class="num">' + Pricing.formatMoney(Pricing.fromPrice(a)) + '</strong> ללילה</span>' +
        '<a class="btn btn-quiet" href="' + href + '">לפרטים</a>';
    } else {
      priceBlock = '<span class="price-total num">' + Pricing.formatMoney(q.total) + '</span>' +
        '<span class="price-for">ל' + (q.nights === 1 ? 'לילה אחד' : '־' + q.nights + ' לילות') + ', ' + Pricing.guestsLabel(q.guests) + ', כולל ניקיון</span>' +
        '<a class="btn" href="' + href + '">לפרטים ולשריון</a>';
    }
    var facts = '<span>' + Icons.svg('users') + 'עד ' + a.maxGuests + ' אורחים</span>' +
      '<span>' + Icons.svg('door') + App.roomsLabel(a.rooms) + '</span>' +
      (a.cribs ? '<span>' + Icons.svg('crib') + (a.cribs === 1 ? 'מיטת תינוק' : a.cribs + ' מיטות תינוק') + '</span>' : '');
    return '<article class="listing' + (item.available ? '' : ' is-unavailable') + '">' +
      '<a class="listing-media" href="' + href + '" tabindex="-1" aria-hidden="true">' +
      (img ? '<img ' + App.imageAttrs(img, a.title) + '>' : '') +
      (img && img.placeholder ? '<span class="photo-note">איור להמחשה</span>' : '') + '</a>' +
      '<div class="listing-body">' +
      '<h3><a href="' + href + '">' + esc(a.title) + '</a></h3>' +
      '<span class="place">' + Icons.svg('pin') + esc([a.neighborhood, a.city].filter(Boolean).join(', ')) + '</span>' +
      '<div class="facts">' + facts + '</div>' +
      (a.summary ? '<p class="listing-summary">' + esc(a.summary) + '</p>' : '') +
      '<div class="amenity-row">' + amenityTags(a) + '</div>' +
      '</div>' +
      '<div class="listing-price">' + priceBlock + '</div>' +
      '</article>';
  }

  function renderResults() {
    if (!data) return;
    var sort = $('sort').value;
    var pool = data.apartments.filter(matchesWhere);
    var fits = pool.filter(function (a) { return (a.maxGuests || a.beds) >= state.guests; });
    var items = fits.map(function (a) {
      return {
        apt: a,
        quote: Pricing.quote(a, state),
        available: Pricing.isAvailable(data.blocked[a.id], state.checkin, state.checkout)
      };
    });
    items.sort(function (x, y) {
      var ax = x.available && x.quote.ok ? 0 : x.available ? 1 : 2;
      var ay = y.available && y.quote.ok ? 0 : y.available ? 1 : 2;
      if (ax !== ay) return ax - ay;
      if (sort === 'size') return (y.apt.maxGuests || 0) - (x.apt.maxGuests || 0);
      if (sort === 'new') return String(y.apt.createdAt || '').localeCompare(String(x.apt.createdAt || ''));
      return x.quote.total - y.quote.total;
    });
    var free = items.filter(function (i) { return i.available; }).length;
    var busy = items.length - free;

    $('results-title').textContent = free === 0 ? 'אין דירה פנויה' : free === 1 ? 'דירה אחת פנויה' : free + ' דירות פנויות';
    var sub = Pricing.guestsLabel(state.guests) + ', ' + rangeText(state.checkin, state.checkout);
    if (busy) sub += '. ' + (busy === 1 ? 'עוד דירה אחת תפוסה' : 'עוד ' + busy + ' תפוסות') + ' בתאריכים האלה.';
    $('results-sub').textContent = sub;

    if (!items.length) {
      var tooMany = pool.length && !fits.length;
      $('listings').innerHTML = '<div class="empty">' + Icons.svg('inbox') +
        '<p>' + (tooMany ? 'אין לנו דירה ל־' + state.guests + ' אורחים' + (state.where ? ' באזור הזה' : '') + '. נסו פחות אורחים או אזור אחר.' : 'אין דירות באזור הזה. נסו "כל הארץ".') + '</p>' +
        (App.config.managerWhatsApp ? '<a class="btn btn-quiet" target="_blank" rel="noopener" href="' + esc(App.whatsappLink('שלום, אני מחפש/ת דירה ל־' + state.guests + ' אורחים בתאריכים ' + rangeText(state.checkin, state.checkout))) + '">' + Icons.svg('message') + 'לשאול את המנהל בוואטסאפ</a>' : '') +
        '</div>';
      return;
    }
    $('listings').innerHTML = items.map(listingHTML).join('');
  }

  // ---------- אירועים ----------
  $('checkin').addEventListener('change', function (e) {
    var v = e.target.value;
    if (!Pricing.parseISO(v)) return;
    var len = Math.max(1, Pricing.nightsBetween(state.checkin, state.checkout));
    state.checkin = v < Pricing.todayIL() ? Pricing.todayIL() : v;
    if (state.checkout <= state.checkin) state.checkout = Pricing.addDays(state.checkin, len);
    sync();
  });
  $('checkout').addEventListener('change', function (e) {
    var v = e.target.value;
    if (!Pricing.parseISO(v)) return;
    state.checkout = v <= state.checkin ? Pricing.addDays(state.checkin, 1) : v;
    sync();
  });
  $('where').addEventListener('change', function (e) { state.where = e.target.value; sync(); });
  $('sort').addEventListener('change', renderResults);
  document.querySelectorAll('[data-step]').forEach(function (b) {
    b.addEventListener('click', function () {
      var key = b.getAttribute('data-step');
      var max = key === 'guests' ? 30 : 6, min = key === 'guests' ? 1 : 0;
      state[key] = Math.min(max, Math.max(min, state[key] + Number(b.getAttribute('data-delta'))));
      sync();
    });
  });
  $('search').addEventListener('submit', function (e) {
    e.preventDefault();
    $('results').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  syncInputs();
  renderQuick();
  App.loadData().then(function (d) {
    data = d;
    fillWhere(d.apartments);
    renderZmanim(d.apartments);
    renderResults();
  }).catch(function (err) {
    console.error(err);
    $('listings').innerHTML = '<div class="empty">' + Icons.svg('alert') + '<p>לא הצלחנו לטעון את רשימת הדירות. רעננו את העמוד בעוד רגע.</p></div>';
    $('this-shabbat').hidden = true;
  });
})();
