const test = require('node:test');
const assert = require('node:assert/strict');

const {
  getEasterDate,
  getFrenchPublicHolidays,
  getFrenchWorkingDays,
} = require('../js/working-days.js');

test('getEasterDate retourne la bonne date pour 2025', () => {
  const easter = getEasterDate(2025);
  assert.equal(easter.getFullYear(), 2025);
  assert.equal(easter.getMonth(), 3);
  assert.equal(easter.getDate(), 20);
});

test('getFrenchPublicHolidays inclut les fêtes mobiles françaises', () => {
  const holidays = getFrenchPublicHolidays(2025);
  assert.equal(holidays.has('2025-04-21'), true);
  assert.equal(holidays.has('2025-05-29'), true);
  assert.equal(holidays.has('2025-06-09'), true);
});

test('getFrenchWorkingDays calcule des mois avec jours fériés', () => {
  assert.equal(getFrenchWorkingDays(2025, 5), 19);
  assert.equal(getFrenchWorkingDays(2025, 6), 20);
});
