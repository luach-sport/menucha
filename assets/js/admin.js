/*
 * ממשק המנהל. אין כאן שום סוד: כל הנתונים נמשכים מ-GitHub REST API עם טוקן
 * שהמנהל מדביק, ושנשמר רק בדפדפן שלו. בלי טוקן העמוד ריק.
 */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const esc = App.esc;
  const gcfg = App.config.github;
  const TOKEN_KEY = 'menucha.adminToken';
  const STATUSES = [
    { id: 'New Lead', title: 'פניות חדשות', dot: 'dot-new' },
    { id: 'Approved', title: 'מאושרות', dot: 'dot-approved' },
    { id: 'Closed', title: 'סגורות', dot: 'dot-closed' }
  ];
  const STATUS_IDS = STATUSES.map((s) => s.id);

  const siteRepo = `${gcfg.owner}/${gcfg.repo}`;
  const crmRepo = !gcfg.crmRepo ? siteRepo : gcfg.crmRepo.includes('/') ? gcfg.crmRepo : `${gcfg.owner}/${gcfg.crmRepo}`;

  let token = null;
  let demo = false;
  let apartments = [];
  let leads = [];
  let prs = [];
  let ganttStart = null;
  let pendingConfirm = null;

  // ---------- כלים ----------
  function toast(msg, ms) {
    const t = $('toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => { t.hidden = true; }, ms || 4500);
  }
  const aptById = (id) => apartments.find((a) => a.id === id);
  const aptName = (id) => (aptById(id) ? aptById(id).title : id || 'דירה לא ידועה');
  function range(b) { return `${App.shortDate(b.checkin)} – ${App.shortDate(b.checkout)}`; }

  async function api(method, path, body) {
    const res = await fetch('https://api.github.com' + path, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(body ? { 'Content-Type': 'application/json' } : {})
      },
      body: body ? JSON.stringify(body) : undefined
    });
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch (e) { data = text; }
    if (!res.ok) {
      const err = new Error((data && data.message) || `HTTP ${res.status}`);
      err.status = res.status;
      throw err;
    }
    return data;
  }
  function explain(err, what) {
    if (err.status === 401) return 'הטוקן לא תקף או שפג תוקפו. צרו טוקן חדש והתחברו מחדש.';
    if (err.status === 403) return `לטוקן אין הרשאה ל${what}. בדקו את ההרשאות שלו (README, שלב 6).`;
    if (err.status === 404) return `לא נמצא, או שלטוקן אין גישה (${what}).`;
    if (err.status === 405 || err.status === 409) return 'GitHub לא אפשר את הפעולה — ייתכן שיש התנגשות. פתחו את הבקשה ב-GitHub.';
    return `${what}: ${err.message}`;
  }

  // ---------- פניות ----------
  const BOOKING_RE = /<!--\s*menucha-booking\s+(\{[\s\S]*?\})\s*-->/;
  function toLead(issue) {
    const m = BOOKING_RE.exec(issue.body || '');
    let b = null;
    try { b = m ? JSON.parse(m[1]) : null; } catch (e) { b = null; }
    const labels = (issue.labels || []).map((l) => (typeof l === 'string' ? l : l.name));
    let status = 'New Lead';
    if (labels.includes('Approved')) status = 'Approved';
    else if (labels.includes('Closed') || issue.state === 'closed') status = 'Closed';
    return {
      number: issue.number,
      url: issue.html_url,
      title: issue.title,
      labels,
      status,
      manual: labels.includes('Manual Block'),
      booking: b,
      createdAt: issue.created_at
    };
  }

  async function loadLeads() {
    if (demo) return;
    const [fresh, approved, closed] = await Promise.all([
      api('GET', `/repos/${crmRepo}/issues?labels=${encodeURIComponent('New Lead')}&state=open&per_page=100`),
      api('GET', `/repos/${crmRepo}/issues?labels=Approved&state=all&per_page=100&sort=updated`),
      api('GET', `/repos/${crmRepo}/issues?labels=Closed&state=all&per_page=30&sort=updated`)
    ]);
    const seen = new Set();
    leads = fresh.concat(approved, closed)
      .filter((i) => !i.pull_request && !seen.has(i.number) && seen.add(i.number))
      .map(toLead);
  }

  async function loadPRs() {
    if (demo) return;
    const list = await api('GET', `/repos/${siteRepo}/pulls?state=open&per_page=50`);
    prs = list.filter((p) => (p.labels || []).some((l) => l.name === 'new-property') || String(p.head && p.head.ref).startsWith('property/'));
  }

  function conflictsFor(lead) {
    if (!lead.booking) return [];
    return leads.filter((o) => o !== lead && o.status === 'Approved' && o.booking &&
      o.booking.apartmentId === lead.booking.apartmentId &&
      Pricing.overlaps(lead.booking.checkin, lead.booking.checkout, o.booking.checkin, o.booking.checkout));
  }

  function cardHTML(l) {
    const b = l.booking;
    const conflicts = l.status !== 'Approved' ? conflictsFor(l) : [];
    const phone = b && b.phone;
    const wa = phone ? 'https://wa.me/' + Validate.internationalPhone(phone) : '';
    return `
      <article class="kcard" draggable="true" data-num="${l.number}" aria-label="פניה ${l.number}">
        <div class="kcard-top"><span class="kcard-name">${esc(b ? b.name : l.title)}</span><a class="kcard-num" href="${esc(l.url)}" target="_blank" rel="noopener">#${l.number}</a></div>
        ${b ? `<div class="kcard-meta">
          <span>${Icons.svg('home')}${esc(aptName(b.apartmentId))}</span>
          <span>${Icons.svg('calendar')}${esc(range(b))}</span>
          ${l.manual ? '' : `<span>${Icons.svg('users')}${Pricing.guestsLabel(b.guests || 1)}${b.infants ? ` + ${b.infants === 1 ? 'תינוק' : b.infants + ' תינוקות'}` : ''}</span>`}
        </div>
        ${b.total ? `<span class="kcard-price">${Pricing.formatMoney(b.total)}</span>` : ''}` : '<span class="small muted">אין בפניה פרטי הזמנה שאפשר לקרוא</span>'}
        ${conflicts.length ? `<div class="notice notice-warn conflict">${Icons.svg('alert')}<span>חופף להזמנה מאושרת ${conflicts.map((c) => '#' + c.number).join(', ')}</span></div>` : ''}
        <div class="kcard-actions">
          ${phone ? `<a href="tel:${esc(Validate.normalizePhone(phone))}">${Icons.svg('phone')}<span class="num" dir="ltr">${esc(phone)}</span></a>` : ''}
          ${wa ? `<a href="${esc(wa)}" target="_blank" rel="noopener">${Icons.svg('message')}וואטסאפ</a>` : ''}
          <select aria-label="העברת פניה ${l.number}" data-move="${l.number}">
            ${STATUSES.map((s) => `<option value="${s.id}" ${s.id === l.status ? 'selected' : ''}>${s.title}</option>`).join('')}
          </select>
        </div>
        <div data-confirm="${l.number}"></div>
      </article>`;
  }

  function renderKanban() {
    const filter = $('lead-filter').value;
    const shown = leads.filter((l) => !filter || (l.booking && l.booking.apartmentId === filter));
    $('count-leads').textContent = leads.filter((l) => l.status === 'New Lead').length;
    $('kanban').innerHTML = STATUSES.map((s) => {
      const items = shown.filter((l) => l.status === s.id)
        .sort((a, b) => String(a.booking ? a.booking.checkin : '9').localeCompare(String(b.booking ? b.booking.checkin : '9')));
      return `
        <section class="kcol" data-col="${s.id}" aria-label="${esc(s.title)}">
          <div class="kcol-head"><h2><span class="dot ${s.dot}"></span>${esc(s.title)}</h2><span class="count small muted">${items.length}</span></div>
          ${items.map(cardHTML).join('') || `<p class="small muted" style="padding:8px 4px">${s.id === 'New Lead' ? 'אין פניות חדשות. פניות מהאתר יופיעו כאן.' : 'ריק.'}</p>`}
        </section>`;
    }).join('');
    wireKanban();
  }

  function wireKanban() {
    document.querySelectorAll('.kcard').forEach((card) => {
      card.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/plain', card.dataset.num); card.classList.add('is-dragging'); });
      card.addEventListener('dragend', () => card.classList.remove('is-dragging'));
    });
    document.querySelectorAll('.kcol').forEach((col) => {
      col.addEventListener('dragover', (e) => { e.preventDefault(); col.classList.add('is-over'); });
      col.addEventListener('dragleave', () => col.classList.remove('is-over'));
      col.addEventListener('drop', (e) => {
        e.preventDefault();
        col.classList.remove('is-over');
        requestMove(Number(e.dataTransfer.getData('text/plain')), col.dataset.col);
      });
    });
    document.querySelectorAll('[data-move]').forEach((sel) => sel.addEventListener('change', () => requestMove(Number(sel.dataset.move), sel.value)));
  }

  function requestMove(num, status) {
    const lead = leads.find((l) => l.number === num);
    if (!lead || lead.status === status) return;
    const conflicts = status === 'Approved' ? conflictsFor(lead) : [];
    if (!conflicts.length) { move(lead, status); return; }
    // אישור בתוך הכרטיס (בלי חלון קופץ)
    const box = document.querySelector(`[data-confirm="${num}"]`);
    pendingConfirm = { lead, status };
    box.innerHTML = `
      <div class="inline-confirm">
        <span>התאריכים חופפים ל־${conflicts.map((c) => '#' + c.number).join(', ')} שכבר אושרה. לאשר בכל זאת?</span>
        <div class="row"><button class="btn btn-small btn-danger" type="button" data-yes>לאשר בכל זאת</button><button class="btn btn-small btn-quiet" type="button" data-no>ביטול</button></div>
      </div>`;
    box.querySelector('[data-yes]').addEventListener('click', () => { const p = pendingConfirm; pendingConfirm = null; move(p.lead, p.status); });
    box.querySelector('[data-no]').addEventListener('click', () => { pendingConfirm = null; renderKanban(); });
  }

  async function move(lead, status) {
    const card = document.querySelector(`.kcard[data-num="${lead.number}"]`);
    if (card) card.classList.add('is-busy');
    const labels = lead.labels.filter((l) => !STATUS_IDS.includes(l)).concat(status);
    const stateField = status === 'Closed' ? 'closed' : 'open';
    try {
      if (!demo) await api('PATCH', `/repos/${crmRepo}/issues/${lead.number}`, { labels, state: stateField });
      lead.labels = labels;
      lead.status = status;
      renderKanban();
      renderGantt();
      await afterBookingChange(status === 'Approved' ? 'אושר' : status === 'Closed' ? 'נסגר' : 'הוחזר לפניות חדשות');
    } catch (err) {
      if (card) card.classList.remove('is-busy');
      toast(explain(err, 'עדכון הפניה'), 7000);
      renderKanban();
    }
  }

  /** מפעיל את סנכרון התפוסה באתר מיד, במקום לחכות לריצה המתוזמנת */
  async function afterBookingChange(verb) {
    if (demo) { toast(`${verb}. במצב הדגמה שום דבר לא נשמר.`); return; }
    try {
      await api('POST', `/repos/${siteRepo}/actions/workflows/sync-availability.yml/dispatches`, { ref: gcfg.branch || 'main' });
      toast(`${verb}. התאריכים באתר יתעדכנו תוך כ־2 דקות.`);
      $('sync-note').textContent = 'סנכרון לאתר הופעל ' + new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
    } catch (err) {
      toast(`${verb}. האתר יתעדכן בסנכרון האוטומטי הבא (עד חצי שעה).`, 6000);
    }
  }

  // ---------- יומן תפוסה ----------
  // כל יום = שתי עמודות, כך שהזמנה מתחילה באמצע יום ההגעה ונגמרת באמצע יום העזיבה
  const DAYS = 28;
  function renderGantt() {
    const today = Pricing.todayIL();
    if (!ganttStart) ganttStart = Pricing.addDays(today, -Pricing.dow(today));
    const end = Pricing.addDays(ganttStart, DAYS);
    $('cal-range').textContent = `${App.dayMonth(ganttStart)} – ${App.dayMonth(Pricing.addDays(end, -1))}`;
    const days = [];
    for (let i = 0; i < DAYS; i++) days.push(Pricing.addDays(ganttStart, i));
    const col = (i) => 2 + i * 2;
    const dayCell = (iso, i, head) => {
      const w = Pricing.dow(iso);
      const cls = ['gantt-day'];
      if (w === 5 || w === 6) cls.push('weekend');
      if (iso === today) cls.push(head ? 'today' : 'today-col');
      const d = Number(iso.slice(8));
      const content = head ? `${App.WEEKDAY_SHORT[w]}<br>${d === 1 || i === 0 ? App.dayMonth(iso) : d}` : '';
      return `<div class="${cls.join(' ')}" style="grid-column:${col(i)} / span 2;grid-row:1">${content}</div>`;
    };
    let html = `<div class="gantt-row head" style="--days:${DAYS}"><div class="gantt-label" style="grid-row:1"><strong>דירה</strong></div>${days.map((d, i) => dayCell(d, i, true)).join('')}</div>`;
    apartments.forEach((a) => {
      const bars = leads.filter((l) => l.booking && l.booking.apartmentId === a.id && l.status !== 'Closed' &&
        Pricing.overlaps(l.booking.checkin, Pricing.addDays(l.booking.checkout, 1), ganttStart, end));
      const barHTML = bars.map((l) => {
        const ci = Pricing.nightsBetween(ganttStart, l.booking.checkin);
        const co = Pricing.nightsBetween(ganttStart, l.booking.checkout);
        const s = ci < 0 ? 2 : col(ci) + 1;
        const e = co >= DAYS ? col(DAYS) : col(co) + 1;
        if (e <= s) return '';
        const kind = l.status === 'Approved' ? (l.manual ? 'manual' : 'approved') : 'lead';
        const place = kind === 'lead' ? 'align-self:end;margin-bottom:5px;height:20px' : 'align-self:start;margin-top:7px';
        const label = `${l.booking.name || ''} · ${range(l.booking)}`;
        return `<button type="button" class="gantt-bar ${kind}" style="grid-column:${s} / ${e};grid-row:1;${place}" data-detail="${l.number}" title="${esc(label)}" aria-label="${esc(label)}">${esc(l.booking.name || '')}</button>`;
      }).join('');
      html += `<div class="gantt-row" style="--days:${DAYS};min-height:${bars.some((l) => l.status !== 'Approved') ? 64 : 46}px">
        <div class="gantt-label" style="grid-row:1"><strong>${esc(a.title)}</strong><span>${esc(a.city)}</span></div>
        ${days.map((d, i) => dayCell(d, i, false)).join('')}${barHTML}</div>`;
    });
    if (!apartments.length) html += '<p class="muted" style="padding:16px">אין דירות באתר עדיין.</p>';
    $('gantt').innerHTML = html;
    $('gantt').querySelectorAll('[data-detail]').forEach((b) => b.addEventListener('click', () => showDetail(Number(b.dataset.detail))));
  }

  function showDetail(num) {
    const l = leads.find((x) => x.number === num);
    if (!l || !l.booking) return;
    const b = l.booking;
    const box = $('detail');
    box.hidden = false;
    box.innerHTML = `
      <div class="kcard-top"><strong>${esc(b.name || l.title)}</strong><a href="${esc(l.url)}" target="_blank" rel="noopener">פניה #${l.number} ב-GitHub ${Icons.svg('external')}</a></div>
      <div class="kcard-meta">
        <span>${Icons.svg('home')}${esc(aptName(b.apartmentId))}</span>
        <span>${Icons.svg('calendar')}${esc(App.stayNote(b.checkin, b.checkout))}</span>
        ${b.phone ? `<span>${Icons.svg('phone')}<span class="num" dir="ltr">${esc(b.phone)}</span></span>` : ''}
        ${b.total ? `<span class="kcard-price">${Pricing.formatMoney(b.total)}</span>` : ''}
      </div>
      <span class="status ${l.status === 'Approved' ? 'status-ok' : 'status-warn'}">${l.manual ? 'חסימה ידנית' : l.status === 'Approved' ? 'מאושרת' : 'ממתינה לטיפול'}</span>`;
  }

  async function addBlock(e) {
    e.preventDefault();
    const aptId = $('bf-apt').value, from = $('bf-from').value, to = $('bf-to').value;
    const note = Validate.cleanText($('bf-note').value, 80) || 'חסימה ידנית';
    if (!aptId || !Pricing.parseISO(from) || !Pricing.parseISO(to) || to <= from) { toast('בחרו דירה, ותאריך סיום שאחרי תאריך ההתחלה.'); return; }
    const booking = { apartmentId: aptId, checkin: from, checkout: to, guests: 0, infants: 0, total: 0, name: note, source: 'manual' };
    const body = `חסימה ידנית מממשק הניהול.\n\n**דירה:** ${aptName(aptId)}\n**תאריכים:** ${from} עד ${to}\n**הערה:** ${note}\n\n<!-- menucha-booking ${JSON.stringify(booking)} -->`;
    try {
      let issue;
      if (demo) issue = { number: 900 + leads.length, html_url: '#', title: note, labels: ['Approved', 'Manual Block'], state: 'open', body };
      else issue = await api('POST', `/repos/${crmRepo}/issues`, { title: `⛔ ${note} · ${aptName(aptId)} · ${App.dayMonth(from)}–${App.dayMonth(to)}`, body, labels: ['Approved', 'Manual Block'] });
      leads.push(toLead(issue));
      $('block-form').reset();
      renderGantt();
      renderKanban();
      await afterBookingChange('התאריכים נחסמו');
    } catch (err) {
      toast(explain(err, 'יצירת החסימה'), 7000);
    }
  }

  // ---------- דירות לאישור ----------
  function renderPRs() {
    $('count-props').textContent = prs.length;
    if (!prs.length) {
      $('pr-list').innerHTML = `<div class="empty">${Icons.svg('inbox')}<p>אין דירות שממתינות לאישור. קישור לטופס לבעלי דירות: <a href="add-property.html">add-property.html</a></p></div>`;
      return;
    }
    $('pr-list').innerHTML = prs.map((p) => `
      <article class="pr-item" data-pr="${p.number}">
        <div>
          <h3>${esc(p.title)}</h3>
          <span class="small muted">נשלחה ${new Date(p.created_at).toLocaleDateString('he-IL')} · בקשה #${p.number}</span>
          <div data-pr-confirm="${p.number}"></div>
        </div>
        <div class="pr-actions">
          <a class="btn btn-quiet btn-small" href="${esc(p.html_url)}/files" target="_blank" rel="noopener">${Icons.svg('external')}לבדיקה ב-GitHub</a>
          <button class="btn btn-small" type="button" data-merge="${p.number}">${Icons.svg('check')}אישור ופרסום</button>
          <button class="btn btn-quiet btn-small" type="button" data-reject="${p.number}">דחייה</button>
        </div>
      </article>`).join('');
    $('pr-list').querySelectorAll('[data-merge]').forEach((b) => b.addEventListener('click', () => confirmPR(Number(b.dataset.merge), 'merge')));
    $('pr-list').querySelectorAll('[data-reject]').forEach((b) => b.addEventListener('click', () => confirmPR(Number(b.dataset.reject), 'reject')));
  }

  function confirmPR(num, action) {
    const box = document.querySelector(`[data-pr-confirm="${num}"]`);
    box.innerHTML = `
      <div class="inline-confirm" style="margin-top:8px">
        <span>${action === 'merge' ? 'לפרסם את הדירה באתר? בדקתם תמונות ומחירים?' : 'לדחות את הדירה? הבקשה תיסגר ולא תתפרסם.'}</span>
        <div class="row"><button class="btn btn-small ${action === 'merge' ? '' : 'btn-danger'}" type="button" data-yes>${action === 'merge' ? 'כן, לפרסם' : 'כן, לדחות'}</button><button class="btn btn-small btn-quiet" type="button" data-no>ביטול</button></div>
      </div>`;
    box.querySelector('[data-no]').addEventListener('click', () => { box.innerHTML = ''; });
    box.querySelector('[data-yes]').addEventListener('click', async () => {
      try {
        if (!demo) {
          if (action === 'merge') await api('PUT', `/repos/${siteRepo}/pulls/${num}/merge`, { merge_method: 'squash' });
          else await api('PATCH', `/repos/${siteRepo}/pulls/${num}`, { state: 'closed' });
        }
        prs = prs.filter((p) => p.number !== num);
        renderPRs();
        toast(demo ? 'במצב הדגמה שום דבר לא נשמר.' : action === 'merge' ? 'פורסם. הדירה תופיע באתר תוך כמה דקות.' : 'הבקשה נדחתה ונסגרה.');
      } catch (err) {
        toast(explain(err, action === 'merge' ? 'מיזוג הבקשה' : 'סגירת הבקשה'), 7000);
      }
    });
  }

  // ---------- נתוני הדגמה ----------
  function demoData(blocked) {
    const names = ['משפחת כהן', 'אבי ושרה לוי', 'משפחת מזרחי', 'רינה פרץ', 'משפחת ביטון', 'דוד אברהם', 'נעמה שטרן', 'יוסי גבאי'];
    let n = 101;
    const out = [];
    Object.keys(blocked).forEach((id) => blocked[id].forEach((r, i) => {
      const manual = id === 'jerusalem-rechavia-garden' && i === 1;
      const a = aptById(id);
      const q = a ? Pricing.quote(a, { checkin: r.from, checkout: r.to, guests: (a.pricing && a.pricing.includedGuests) || 2 }) : { total: 0 };
      out.push(toLead({
        number: n++, html_url: '#', state: 'open', title: '',
        labels: manual ? ['Approved', 'Manual Block'] : ['Approved'],
        body: `<!-- menucha-booking ${JSON.stringify({ apartmentId: id, checkin: r.from, checkout: r.to, guests: manual ? 0 : (a && a.pricing.includedGuests) || 2, infants: 0, total: manual ? 0 : q.total, name: manual ? 'שיפוץ במטבח' : names[out.length % names.length], phone: manual ? '' : '052-7' + String(100000 + n * 7919).slice(-6) })} -->`
      }));
    }));
    const fri = Pricing.nextWeekday(Pricing.todayIL(), 5);
    const fresh = [
      { id: 'safed-old-city-stone-house', ci: Pricing.addDays(fri, 21), co: Pricing.addDays(fri, 22), g: 9, b: 1, name: 'מיכל אדלר', phone: '054-3326617' },
      { id: 'jerusalem-rechavia-garden', ci: fri, co: Pricing.addDays(fri, 1), g: 5, b: 0, name: 'אליהו בן דוד', phone: '050-8812044' },
      { id: 'tiberias-kinneret-view', ci: Pricing.addDays(fri, 14), co: Pricing.addDays(fri, 16), g: 6, b: 1, name: 'תמר ויסמן', phone: '058-4410923' }
    ];
    fresh.forEach((f) => {
      const a = aptById(f.id);
      if (!a) return;
      const q = Pricing.quote(a, { checkin: f.ci, checkout: f.co, guests: f.g, infants: f.b });
      out.push(toLead({ number: n++, html_url: '#', state: 'open', title: '', labels: ['New Lead'], body: `<!-- menucha-booking ${JSON.stringify({ apartmentId: f.id, checkin: f.ci, checkout: f.co, guests: f.g, infants: f.b, total: q.total, name: f.name, phone: f.phone })} -->` }));
    });
    const old = apartments[3];
    if (old) out.push(toLead({ number: n++, html_url: '#', state: 'closed', title: '', labels: ['Closed'], body: `<!-- menucha-booking ${JSON.stringify({ apartmentId: old.id, checkin: Pricing.addDays(fri, -7), checkout: Pricing.addDays(fri, -6), guests: 4, infants: 0, total: 1330, name: 'שלמה רוזן', phone: '053-9921180' })} -->` }));
    return out;
  }

  // ---------- כניסה ויציאה ----------
  function showApp(login) {
    $('login').hidden = true;
    $('app').hidden = false;
    $('admin-user').hidden = false;
    $('admin-login').textContent = demo ? 'מצב הדגמה' : login;
  }
  function logout() {
    App.local.remove(TOKEN_KEY);
    App.session.remove(TOKEN_KEY);
    location.reload();
  }

  async function loadAll() {
    $('refresh').disabled = true;
    try {
      const d = await App.loadData();
      apartments = d.apartments;
      if (demo) {
        if (!leads.length) leads = demoData(d.blocked);
        if (!prs.length) prs = [{ number: 14, title: '🏡 דירה חדשה: צימר אבן בראש פינה (ראש פינה)', created_at: new Date().toISOString(), html_url: '#' }];
      } else {
        await Promise.all([loadLeads(), loadPRs().catch((err) => { prs = []; toast(explain(err, 'רשימת הדירות לאישור'), 7000); })]);
      }
      const sel = $('lead-filter');
      const cur = sel.value;
      sel.innerHTML = '<option value="">כל הדירות</option>' + apartments.map((a) => `<option value="${esc(a.id)}">${esc(a.title)}</option>`).join('');
      sel.value = cur;
      $('bf-apt').innerHTML = apartments.map((a) => `<option value="${esc(a.id)}">${esc(a.title)} — ${esc(a.city)}</option>`).join('');
      renderKanban();
      renderGantt();
      renderPRs();
    } catch (err) {
      toast(explain(err, `הפניות ב-${crmRepo}`), 8000);
      if (err.status === 401) logout();
    } finally {
      $('refresh').disabled = false;
    }
  }

  async function login(t, remember) {
    token = t;
    $('login-btn').disabled = true;
    $('token-error').textContent = '';
    try {
      const user = await api('GET', '/user');
      await api('GET', `/repos/${crmRepo}`).catch((err) => { err.repo = crmRepo; throw err; });
      (remember ? App.local : App.session).set(TOKEN_KEY, t);
      showApp(user.login);
      await loadAll();
    } catch (err) {
      token = null;
      $('token-error').textContent = err.repo ? `הטוקן תקין, אבל אין לו גישה ל-${err.repo}. ודאו שהרפוזיטורי נבחר ביצירת הטוקן ושהשם ב-config.js נכון.` : explain(err, 'כניסה');
      $('token').setAttribute('aria-invalid', 'true');
    } finally {
      $('login-btn').disabled = false;
    }
  }

  // ---------- אירועים ----------
  function selectTab(id) {
    ['leads', 'calendar', 'props'].forEach((t) => {
      const on = t === id;
      $('tab-' + t).setAttribute('aria-selected', String(on));
      $('tab-' + t).tabIndex = on ? 0 : -1;
      $('panel-' + t).hidden = !on;
    });
  }
  ['leads', 'calendar', 'props'].forEach((t, i, all) => {
    $('tab-' + t).addEventListener('click', () => selectTab(t));
    $('tab-' + t).addEventListener('keydown', (e) => {
      const dir = e.key === 'ArrowLeft' ? 1 : e.key === 'ArrowRight' ? -1 : 0;
      if (!dir) return;
      const next = all[(i + dir + all.length) % all.length];
      selectTab(next);
      $('tab-' + next).focus();
    });
  });
  $('lead-filter').addEventListener('change', renderKanban);
  $('cal-back').addEventListener('click', () => { ganttStart = Pricing.addDays(ganttStart, -7); renderGantt(); });
  $('cal-fwd').addEventListener('click', () => { ganttStart = Pricing.addDays(ganttStart, 7); renderGantt(); });
  $('cal-today').addEventListener('click', () => { ganttStart = null; renderGantt(); });
  $('block-form').addEventListener('submit', addBlock);
  $('refresh').addEventListener('click', loadAll);
  $('logout').addEventListener('click', logout);
  $('login-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const t = $('token').value.trim();
    if (!t) { $('token-error').textContent = 'הדביקו את הטוקן'; return; }
    login(t, $('remember').checked);
  });
  $('demo-btn').addEventListener('click', () => { demo = true; showApp(); loadAll(); });

  if (!gcfg.owner || /YOUR-/.test(gcfg.owner)) {
    $('config-warning').innerHTML = `<div class="notice notice-warn">${Icons.svg('alert')}<span>עדיין לא עודכן שם המשתמש ב-GitHub בקובץ assets/js/config.js. אפשר לראות את מצב ההדגמה בינתיים.</span></div>`;
  }

  // כניסה אוטומטית
  if (App.config.demoMode) { demo = true; showApp(); loadAll(); return; }
  const saved = App.session.get(TOKEN_KEY) || App.local.get(TOKEN_KEY);
  if (saved) login(saved, !!App.local.get(TOKEN_KEY));
})();
