/*
 * מילון האבזור — משותף לאתר, לטופס בעלי הדירות ול-Actions.
 * כדי להוסיף פריט: מוסיפים שורה כאן (ואם רוצים, אייקון ב-icons.js).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Amenities = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var GROUPS = [
    {
      id: 'shabbat',
      title: 'לשבת',
      items: [
        { id: 'plata', label: 'פלטת שבת', icon: 'plata' },
        { id: 'urn', label: 'מיחם', icon: 'urn' },
        { id: 'shabbat_clocks', label: 'שעוני שבת', icon: 'timer' },
        { id: 'kosher_kitchen', label: 'מטבח כשר', icon: 'kosher' },
        { id: 'near_synagogue', label: 'בית כנסת בהליכה', icon: 'synagogue' },
        { id: 'late_checkout_motzash', label: 'יציאה במוצאי שבת', icon: 'motzash' },
        { id: 'keypad_lock', label: 'כניסה בקוד, בלי מפתח', icon: 'keypad' },
        { id: 'sukkah', label: 'סוכה', icon: 'sukkah' }
      ]
    },
    {
      id: 'family',
      title: 'למשפחות',
      items: [
        { id: 'crib', label: 'מיטת תינוק', icon: 'crib' },
        { id: 'high_chair', label: 'כיסא אוכל לתינוק', icon: 'highchair' },
        { id: 'garden', label: 'גינה', icon: 'garden' },
        { id: 'pool', label: 'בריכה', icon: 'pool' }
      ]
    },
    {
      id: 'comfort',
      title: 'בדירה',
      items: [
        { id: 'ac', label: 'מיזוג בכל החדרים', icon: 'ac' },
        { id: 'wifi', label: 'Wi‑Fi', icon: 'wifi' },
        { id: 'parking', label: 'חניה', icon: 'parking' },
        { id: 'elevator', label: 'מעלית', icon: 'elevator' },
        { id: 'washing_machine', label: 'מכונת כביסה', icon: 'washer' },
        { id: 'balcony', label: 'מרפסת', icon: 'balcony' },
        { id: 'bbq', label: 'מנגל', icon: 'bbq' },
        { id: 'accessible', label: 'נגיש לכיסא גלגלים', icon: 'accessible' }
      ]
    }
  ];

  var BY_ID = {};
  GROUPS.forEach(function (g) { g.items.forEach(function (i) { i.group = g.id; BY_ID[i.id] = i; }); });

  /** האבזור שמוצג בתוצאות החיפוש, לפי סדר החשיבות לאורחי שבת */
  var KEY_FOR_LISTING = ['plata', 'urn', 'shabbat_clocks', 'kosher_kitchen', 'near_synagogue', 'late_checkout_motzash', 'crib', 'ac'];

  return {
    GROUPS: GROUPS,
    BY_ID: BY_ID,
    KEY_FOR_LISTING: KEY_FOR_LISTING,
    get: function (id) { return BY_ID[id] || null; },
    isKnown: function (id) { return Object.prototype.hasOwnProperty.call(BY_ID, id); }
  };
});
