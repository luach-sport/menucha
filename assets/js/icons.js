/* סט אייקונים קווי, מצויר במיוחד לאתר (24×24, צבע לפי currentColor) */
(function (root) {
  'use strict';
  var DOT = '<g stroke-width="2.6">';
  var P = {
    // אבזור
    plata: '<rect x="3" y="12" width="18" height="6" rx="1.5"/><path d="M6 18v2.5M18 18v2.5M8 3.5c-1 1.2-1 2.3 0 3.5s1 2.3 0 3.5M12 3.5c-1 1.2-1 2.3 0 3.5s1 2.3 0 3.5M16 3.5c-1 1.2-1 2.3 0 3.5s1 2.3 0 3.5"/>',
    urn: '<path d="M7.5 5h9v12.5a2 2 0 0 1-2 2h-5a2 2 0 0 1-2-2z"/><path d="M9.5 5V3h5v2M16.5 12H19v3M6 21.5h12M10 9h4"/>',
    timer: '<circle cx="12" cy="13.5" r="7.5"/><path d="M12 9.5v4l2.8 1.8M9.5 2.5h5M12 2.5V6"/>',
    kosher: '<path d="M5.5 3v5.5a2.5 2.5 0 0 0 5 0V3M8 3v18M18.5 21V3c-2.2 1.6-3.5 4.4-3.5 7.5V13h3.5"/>',
    synagogue: '<path d="M3.5 21h17M5 21V10.5L12 5l7 5.5V21M10.5 21v-2.5h3V21M12 9.4l2.6 4.5H9.4zM12 15.4l-2.6-4.5h5.2z"/>',
    motzash: '<path d="M5 21V4h9v17M3 21h14M11.5 13h.01"/><path d="M21 7.8A3.2 3.2 0 1 1 17.2 4a2.6 2.6 0 0 0 3.8 3.8z"/>',
    keypad: '<rect x="5" y="2.5" width="14" height="19" rx="2.5"/><path d="M10 18h4"/>' + DOT + '<path d="M9 7h.01M12 7h.01M15 7h.01M9 10.5h.01M12 10.5h.01M15 10.5h.01M9 14h.01M12 14h.01M15 14h.01"/></g>',
    sukkah: '<path d="M5 21V11h14v10M3 21h18M3.5 11h17M6 11l1.5-4M10 11l.8-4.5M14 11l-.8-4.5M18 11l-1.5-4M4.5 7.5c3-1.2 12-1.2 15 0M10 21v-5h4v5"/>',
    crib: '<path d="M4 6v15M20 6v15M4 9h16M4 17h16M8 9v8M12 9v8M16 9v8"/>',
    highchair: '<path d="M8 3h8l-1 8H9zM6.5 11h11M9 11l-2.5 10M15 11l2.5 10M7.5 16.5h9"/>',
    garden: '<circle cx="9" cy="9" r="5"/><path d="M9 14v7M17 21v-5.5M3 21h18M17 15.5c2 0 3-1.5 3-3.5s-1.5-3.5-3-4.5c-1.5 1-3 2.5-3 4.5s1 3.5 3 3.5z"/>',
    pool: '<path d="M2.5 17c1.6 0 1.6-1.2 3.2-1.2s1.6 1.2 3.2 1.2 1.6-1.2 3.2-1.2 1.6 1.2 3.2 1.2 1.6-1.2 3.2-1.2 1.6 1.2 3.2 1.2M2.5 21c1.6 0 1.6-1.2 3.2-1.2s1.6 1.2 3.2 1.2 1.6-1.2 3.2-1.2 1.6 1.2 3.2 1.2 1.6-1.2 3.2-1.2 1.6 1.2 3.2 1.2M8 14V5.5a2 2 0 0 1 4 0M15 14V5.5a2 2 0 0 1 4 0M8 9.5h7"/>',
    ac: '<path d="M12 2.5v19M3.8 7.2l16.4 9.6M20.2 7.2L3.8 16.8M9.5 4l2.5 2 2.5-2M9.5 20l2.5-2 2.5 2M4.4 10.6l3-1.2-.5-3.1M19.6 13.4l-3 1.2.5 3.1M19.6 10.6l-3-1.2.5-3.1M4.4 13.4l3 1.2-.5 3.1"/>',
    wifi: '<path d="M2.5 9a14 14 0 0 1 19 0M5.5 12.5a9.5 9.5 0 0 1 13 0M8.8 16a5 5 0 0 1 6.4 0"/>' + DOT + '<path d="M12 19.5h.01"/></g>',
    parking: '<rect x="3.5" y="3.5" width="17" height="17" rx="3"/><path d="M9.5 17V7.5H13a2.8 2.8 0 0 1 0 5.6H9.5"/>',
    elevator: '<rect x="4" y="2.5" width="16" height="19" rx="2"/><path d="M12 2.5v19M6.5 10L8 8l1.5 2M14.5 14l1.5 2 1.5-2"/>',
    washer: '<rect x="4" y="2.5" width="16" height="19" rx="2"/><circle cx="12" cy="13.5" r="4.5"/><path d="M9.5 14.5c1-.8 2-.8 3 0s2 .8 3 0"/>' + DOT + '<path d="M7.5 6h.01M10.5 6h.01"/></g>',
    balcony: '<circle cx="12" cy="6.5" r="3"/><path d="M3 12.5h18M3 21h18M5 12.5V21M9.5 12.5V21M14.5 12.5V21M19 12.5V21"/>',
    bbq: '<path d="M4 10.5h16a8 6 0 0 1-16 0zM8.5 15.5L6.5 21M15.5 15.5l2 5.5M9 2.5c-.8.8-.8 1.7 0 2.5s.8 1.7 0 2.5M13 2.5c-.8.8-.8 1.7 0 2.5s.8 1.7 0 2.5"/>',
    accessible: '<circle cx="12.5" cy="4" r="1.6"/><path d="M12.5 7.5v6H17l2 5.5M12.5 10.5h4M9.2 10.8a5.5 5.5 0 1 0 6.8 7.4"/>',
    // ממשק
    bed: '<path d="M3 5v14.5M21 19.5V13a2.5 2.5 0 0 0-2.5-2.5H11V15M3 15h18"/><circle cx="7" cy="11.5" r="1.8"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20.5c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.7c2.1.7 3.5 2.8 3.5 5.8"/>',
    door: '<path d="M6 21V3.5h12V21M3.5 21h17M14.5 12.5h.01"/>',
    pin: '<path d="M12 21.5s-7-6.3-7-12a7 7 0 0 1 14 0c0 5.7-7 12-7 12z"/><circle cx="12" cy="9.5" r="2.5"/>',
    calendar: '<rect x="3.5" y="5" width="17" height="16" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    chevronLeft: '<path d="M15 5l-7 7 7 7"/>',
    chevronRight: '<path d="M9 5l7 7-7 7"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    check: '<path d="M4.5 12.5l5 5 10-11"/>',
    phone: '<path d="M6.6 3.5h-2a1.2 1.2 0 0 0-1.2 1.3c.6 8.4 7.4 15.2 15.8 15.8a1.2 1.2 0 0 0 1.3-1.2v-2l-4.2-1.8-2 2.1a12.5 12.5 0 0 1-5.6-5.6l2.1-2z"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3.5 6.5l8.5 6.5 8.5-6.5"/>',
    message: '<path d="M4 20l1.3-4A8.5 8.5 0 1 1 8.4 19z"/>',
    candles: '<path d="M3.5 21h17"/><rect x="6.5" y="11" width="3.5" height="10" rx=".6"/><rect x="14" y="11" width="3.5" height="10" rx=".6"/><path d="M8.25 8.5c-1.1-.9-1.1-2.6 0-4.5 1.1 1.9 1.1 3.6 0 4.5zM15.75 8.5c-1.1-.9-1.1-2.6 0-4.5 1.1 1.9 1.1 3.6 0 4.5z"/>',
    moon: '<path d="M19.5 14.5A8 8 0 1 1 9.5 4.5a6.3 6.3 0 0 0 10 10z"/><path d="M17 3v3.5M15.25 4.75h3.5"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5"/>' + DOT + '<path d="M12 7.8h.01"/></g>',
    alert: '<path d="M10.3 4.2L2.8 17.5A2 2 0 0 0 4.5 20.5h15a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0zM12 9.5v4.5"/>' + DOT + '<path d="M12 17h.01"/></g>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    external: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 19V7.5A1.5 1.5 0 0 1 5.5 6H10"/>',
    refresh: '<path d="M20 11a8 8 0 0 0-14.5-4.5L4 8M4 4v4h4M4 13a8 8 0 0 0 14.5 4.5L20 16M20 20v-4h-4"/>',
    logout: '<path d="M9 20.5H5.5A1.5 1.5 0 0 1 4 19V5a1.5 1.5 0 0 1 1.5-1.5H9M15 16.5l4.5-4.5L15 7.5M19.5 12H9"/>',
    lock: '<rect x="4.5" y="10.5" width="15" height="10.5" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/>',
    image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="9.5" r="1.8"/><path d="M21 16l-5.5-5.5L5 20"/>',
    home: '<path d="M3.5 11L12 4l8.5 7M6 9.5V20h12V9.5"/>',
    grip: DOT + '<path d="M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01"/></g>',
    copy: '<rect x="8.5" y="8.5" width="12" height="12" rx="2"/><path d="M15.5 8.5V5a1.5 1.5 0 0 0-1.5-1.5H5A1.5 1.5 0 0 0 3.5 5v9A1.5 1.5 0 0 0 5 15.5h3.5"/>',
    key: '<circle cx="7.5" cy="15.5" r="4"/><path d="M10.5 12.5L20 3M16.5 6.5l2.5 2.5M14 9l2 2"/>',
    inbox: '<path d="M3 13.5l2.6-8A1.5 1.5 0 0 1 7 4.5h10a1.5 1.5 0 0 1 1.4 1l2.6 8V19a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 19zM3 13.5h5l1.5 2.5h5l1.5-2.5h5"/>'
  };

  function svg(name, cls) {
    var body = P[name];
    if (!body) return '';
    return '<svg class="icon' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + body + '</svg>';
  }

  /** ממלא כל <span data-icon="name"> בעמוד */
  function hydrate(scope) {
    (scope || document).querySelectorAll('[data-icon]').forEach(function (el) {
      if (!el.firstElementChild) el.innerHTML = svg(el.getAttribute('data-icon'), el.getAttribute('data-icon-class'));
    });
  }

  root.Icons = { svg: svg, hydrate: hydrate, names: Object.keys(P) };
})(typeof self !== 'undefined' ? self : this);
