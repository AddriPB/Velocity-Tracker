/**
 * working-days.js
 * Calcul des jours ouvrés en France pour un mois donné.
 * Algorithme de Meeus/Jones/Butcher pour Pâques.
 */

(function (global) {
  function getEasterDate(year) {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(year, month - 1, day);
  }

  function getFrenchPublicHolidays(year) {
    const easter = getEasterDate(year);
    const easterMs = easter.getTime();
    const DAY = 86400000;

    const addDays = (ms, n) => new Date(ms + n * DAY);

    const holidays = [
      new Date(year, 0, 1),
      new Date(year, 4, 1),
      new Date(year, 4, 8),
      new Date(year, 6, 14),
      new Date(year, 7, 15),
      new Date(year, 10, 1),
      new Date(year, 10, 11),
      new Date(year, 11, 25),
      addDays(easterMs, 1),
      addDays(easterMs, 39),
      addDays(easterMs, 50),
    ];

    const set = new Set();
    for (const holiday of holidays) {
      set.add(
        `${holiday.getFullYear()}-${String(holiday.getMonth() + 1).padStart(2, '0')}-${String(holiday.getDate()).padStart(2, '0')}`
      );
    }
    return set;
  }

  function getFrenchWorkingDays(year, month) {
    const holidays = getFrenchPublicHolidays(year);
    const daysInMonth = new Date(year, month, 0).getDate();
    let count = 0;

    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month - 1, d);
      const dow = date.getDay();
      if (dow === 0 || dow === 6) continue;
      const key = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      if (holidays.has(key)) continue;
      count++;
    }

    return count;
  }

  const api = {
    getEasterDate,
    getFrenchPublicHolidays,
    getFrenchWorkingDays,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  Object.assign(global, api);
})(typeof window !== 'undefined' ? window : globalThis);
