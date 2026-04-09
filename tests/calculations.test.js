const test = require('node:test');
const assert = require('node:assert/strict');

const {
  calcVelEstAC,
  calcVelCalcHC,
  calcMoyVelCalcHC,
  calcVelEstHCFromHistory,
  computeSprintDerived,
  recomputeAllSprintMetrics,
  mergeSprintPatch,
} = require('../js/calculations.js');

test('calcVelCalcHC neutralise les absences pour retrouver la capacité hors congés', () => {
  const value = calcVelCalcHC(5, 21, 3, 120);
  assert.equal(Number(value.toFixed(2)), 123.53);
});

test('calcVelEstAC applique la pondération des absences', () => {
  const value = calcVelEstAC(123.53, 5, 21, 3);
  assert.equal(Number(value.toFixed(2)), 120);
});

test('calcMoyVelCalcHC garde une fenêtre glissante de 6 valeurs', () => {
  const sprints = [10, 20, 30, 40, 50, 60, 70].map((velCalcHC) => ({ velCalcHC }));
  assert.equal(calcMoyVelCalcHC(sprints), 45);
});

test('calcVelEstHCFromHistory reprend la moyenne historique sans re-scaling de capacité', () => {
  const history = [
    { nbDev: 5, nbJours: 10, velCalcHC: 100 },
    { nbDev: 5, nbJours: 20, velCalcHC: 200 },
  ];

  const shortSprint = calcVelEstHCFromHistory(5, 10, history);
  const longSprint = calcVelEstHCFromHistory(5, 20, history);

  assert.equal(shortSprint, 150);
  assert.equal(longSprint, 150);
});

test('computeSprintDerived calcule le premier sprint sans velEstHC saisi', () => {
  const derived = computeSprintDerived(
    { nbDev: 5, nbJours: 21, joursAbsDev: 3, velConst: 120 },
    []
  );

  assert.equal(Number(derived.velEstHC.toFixed(2)), 123.53);
  assert.equal(Number(derived.velEstAC.toFixed(2)), 120);
  assert.equal(Number(derived.moyVelCalcHC.toFixed(2)), 123.53);
});

test('recomputeAllSprintMetrics recalcule toute la timeline après insertion ou suppression', () => {
  const sprints = [
    { id: 'a', sprint: 1, mois: '2025-01', nbDev: 5, nbJours: 21, joursAbsDev: 3, velConst: 120 },
    { id: 'b', sprint: 2, mois: '2025-02', nbDev: 5, nbJours: 20, joursAbsDev: 0, velConst: 110 },
    { id: 'c', sprint: 3, mois: '2025-03', nbDev: 5, nbJours: 10, joursAbsDev: 0, velConst: null },
  ];

  const recomputed = recomputeAllSprintMetrics(sprints);

  assert.equal(Number(recomputed[0].velEstHC.toFixed(2)), 123.53);
  assert.equal(Number(recomputed[1].moyVelCalcHC.toFixed(2)), 116.76);
  assert.equal(Number(recomputed[2].velEstHC.toFixed(2)), 116.76);
  assert.equal(Number(recomputed[2].velEstAC.toFixed(2)), 116.76);
});

test('recomputeAllSprintMetrics suit le comportement attendu du fichier xlsx sur juillet-aout-septembre 2024', () => {
  const sprints = [
    { id: 's1', sprint: 1, mois: '2024-07', nbDev: 7, joursAbsDev: 28, nbJours: 20, velConst: 128 },
    { id: 's2', sprint: 2, mois: '2024-08', nbDev: 7, joursAbsDev: 60, nbJours: 24, velConst: 223 },
    { id: 's3', sprint: 3, mois: '2024-09', nbDev: 7, joursAbsDev: 16, nbJours: 20, velConst: 198 },
  ];

  const recomputed = recomputeAllSprintMetrics(sprints);

  assert.equal(Math.round(recomputed[0].velEstAC), 128);
  assert.equal(Math.round(recomputed[1].velEstAC), 103);
  assert.equal(Math.round(recomputed[2].velEstAC), 224);
});

test('mergeSprintPatch conserve les valeurs existantes quand le patch modal est partiel', () => {
  const current = {
    id: 'b',
    sprint: 2,
    mois: '2025-02',
    nbDev: 5.5,
    joursAbsDev: 1.25,
    nbJours: 20,
    velConst: 110,
  };

  const merged = mergeSprintPatch(current, {
    nbDev: 6.25,
    joursAbsDev: null,
    nbJours: null,
    velConst: null,
  });

  assert.deepEqual(merged, {
    id: 'b',
    sprint: 2,
    mois: '2025-02',
    nbDev: 6.25,
    joursAbsDev: 1.25,
    nbJours: 20,
    velConst: 110,
  });
});
