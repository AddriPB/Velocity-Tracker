/**
 * calculations.js
 * Toutes les formules métier du Velocity Tracker.
 * Fonctions pures sans I/O.
 */

(function (global) {
  function calcCapacity(nbDev, nbJours) {
    if (!nbDev || !nbJours || nbDev <= 0 || nbJours <= 0) return null;
    return nbDev * nbJours;
  }

  /**
   * Nb Dév réel = (nbDev × nbJours − joursAbsDev) / nbJours
   */
  function calcNbDevReel(nbDev, nbJours, joursAbsDev) {
    if (!nbJours || nbJours === 0) return null;
    return (nbDev * nbJours - joursAbsDev) / nbJours;
  }

  /**
   * Vélocité estimée Avec Congés
   * = velEstHC × (nbDev × nbJours − joursAbsDev) / (nbDev × nbJours)
   * = velEstHC × nbDevReel / nbDev
   */
  function calcVelEstAC(velEstHC, nbDev, nbJours, joursAbsDev) {
    const capacity = calcCapacity(nbDev, nbJours);
    if (!capacity || velEstHC === null || velEstHC === undefined) return null;
    return velEstHC * (capacity - joursAbsDev) / capacity;
  }

  /**
   * Vélocité calculée Hors Congés
   * = (nbDev × nbJours) × velConst / (nbDev × nbJours − joursAbsDev)
   * Requiert velConst renseigné.
   */
  function calcVelCalcHC(nbDev, nbJours, joursAbsDev, velConst) {
    if (velConst === null || velConst === undefined || velConst === '') return null;
    const capacity = calcCapacity(nbDev, nbJours);
    if (!capacity) return null;
    const denominator = capacity - joursAbsDev;
    if (denominator === 0) return null;
    return capacity * velConst / denominator;
  }

  function calcMoyNbDev(sprints, windowSize = 6) {
    const recent = sprints.filter((s) => s.nbDev != null).slice(-windowSize);
    if (recent.length === 0) return null;
    return recent.reduce((sum, s) => sum + s.nbDev, 0) / recent.length;
  }

  /**
   * Moyenne glissante des N dernières valeurs de Vélocité calc HC.
   */
  function calcMoyVelCalcHC(sprints, windowSize = 6) {
    const validValues = sprints
      .filter((s) => s.velCalcHC !== null && s.velCalcHC !== undefined)
      .map((s) => s.velCalcHC);

    if (validValues.length === 0) return null;

    const window = validValues.slice(-windowSize);
    const sum = window.reduce((acc, v) => acc + v, 0);
    return sum / window.length;
  }

  /**
   * Vélocité estimée HC basée sur l'historique.
   * Méthode métier retenue :
   * - prendre la moyenne glissante des velCalcHC des 6 derniers sprints
   * - ne pas re-scaler cette moyenne par la capacité du sprint courant
   * - appliquer ensuite une seule fois la pondération du sprint courant via calcVelEstAC
   */
  function calcVelEstHCFromHistory(nbDevCurrent, nbJoursCurrent, sprints, windowSize = 6) {
    const moyVelCalcHC = calcMoyVelCalcHC(sprints, windowSize);

    if (calcCapacity(nbDevCurrent, nbJoursCurrent) === null || moyVelCalcHC === null || moyVelCalcHC === undefined) {
      return null;
    }

    return moyVelCalcHC;
  }

  function calcInitialVelEstHC(nbDev, nbJours, joursAbsDev, velConst) {
    return calcVelCalcHC(nbDev, nbJours, joursAbsDev, velConst);
  }

  function computeSprintDerived(sprint, previousSprints, windowSize = 6) {
    const velEstHC = previousSprints.length === 0
      ? calcInitialVelEstHC(sprint.nbDev, sprint.nbJours, sprint.joursAbsDev, sprint.velConst)
      : calcVelEstHCFromHistory(sprint.nbDev, sprint.nbJours, previousSprints, windowSize);

    const velEstAC = calcVelEstAC(velEstHC, sprint.nbDev, sprint.nbJours, sprint.joursAbsDev);
    const velCalcHC = calcVelCalcHC(sprint.nbDev, sprint.nbJours, sprint.joursAbsDev, sprint.velConst);
    const moyVelCalcHC = calcMoyVelCalcHC([...previousSprints, { velCalcHC }], windowSize);

    return { velEstHC, velEstAC, velCalcHC, moyVelCalcHC };
  }

  function recomputeAllSprintMetrics(sprints, windowSize = 6) {
    const sorted = [...sprints].sort((a, b) => a.sprint - b.sprint);
    const recomputed = [];

    sorted.forEach((sprint) => {
      const derived = computeSprintDerived(sprint, recomputed, windowSize);
      recomputed.push({ ...sprint, ...derived });
    });

    return recomputed;
  }

  function mergeSprintPatch(baseSprint, patch) {
    return {
      ...baseSprint,
      nbDev: patch.nbDev ?? baseSprint.nbDev,
      joursAbsDev: patch.joursAbsDev ?? baseSprint.joursAbsDev ?? 0,
      nbJours: patch.nbJours ?? baseSprint.nbJours,
      velConst: patch.velConst ?? baseSprint.velConst ?? null,
    };
  }

  function formatVal(val, decimals = 2) {
    if (val === null || val === undefined || isNaN(val)) return '—';
    return Number(val).toFixed(decimals);
  }

  const api = {
    calcCapacity,
    calcNbDevReel,
    calcVelEstAC,
    calcVelCalcHC,
    calcMoyNbDev,
    calcMoyVelCalcHC,
    calcVelEstHCFromHistory,
    calcInitialVelEstHC,
    computeSprintDerived,
    recomputeAllSprintMetrics,
    mergeSprintPatch,
    formatVal,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  Object.assign(global, api);
})(typeof window !== 'undefined' ? window : globalThis);
