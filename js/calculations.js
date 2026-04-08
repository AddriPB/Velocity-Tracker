/**
 * calculations.js
 * Toutes les formules métier du Velocity Tracker.
 * Fonctions pures sans I/O.
 */

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
  if (!nbDev || !nbJours || nbDev === 0) return null;
  const denominator = nbDev * nbJours;
  if (denominator === 0) return null;
  return velEstHC * (nbDev * nbJours - joursAbsDev) / denominator;
}

/**
 * Vélocité calculée Hors Congés
 * = (nbDev × nbJours) × velConst / (nbDev × nbJours − joursAbsDev)
 * Requiert velConst renseigné.
 */
function calcVelCalcHC(nbDev, nbJours, joursAbsDev, velConst) {
  if (velConst === null || velConst === undefined || velConst === '') return null;
  const numerator = nbDev * nbJours;
  const denominator = nbDev * nbJours - joursAbsDev;
  if (denominator === 0) return null;
  return numerator * velConst / denominator;
}

/**
 * Vélocité estimée Hors Congés pour le sprint N
 * = Moy_Vel_calc_HC × (nbDevCurrent / moyNbDev_6mois)
 *
 * Normalise la vélocité historique moyenne par le nombre moyen de devs
 * sur la période (cohérent avec la fenêtre glissante 6 mois),
 * puis la scale au nombre de devs du sprint en cours.
 *
 * @param {number} nbDevCurrent  - Nombre de devs du sprint à venir
 * @param {number} moyNbDev      - Moyenne du nb de devs sur les 6 derniers sprints
 * @param {number} moyVelCalcHC  - Moy. Vél. calc. HC (6 derniers sprints)
 * @returns {number|null}
 */
function calcVelEstHCPrefill(nbDevCurrent, moyNbDev, moyVelCalcHC) {
  if (!moyNbDev || moyNbDev === 0 || moyVelCalcHC === null || moyVelCalcHC === undefined) return null;
  return (nbDevCurrent / moyNbDev) * moyVelCalcHC;
}

/**
 * Moyenne du nombre de devs sur les N derniers sprints.
 * Utilisée pour normaliser la Vélocité est. HC lors d'un changement d'effectif.
 *
 * @param {Array<{nbDev: number}>} sprints - Sprints triés chronologiquement
 * @param {number} windowSize
 * @returns {number|null}
 */
function calcMoyNbDev(sprints, windowSize = 6) {
  const recent = sprints.filter(s => s.nbDev != null).slice(-windowSize);
  if (recent.length === 0) return null;
  return recent.reduce((sum, s) => sum + s.nbDev, 0) / recent.length;
}

/**
 * Moyenne glissante des N dernières valeurs de Vélocité calc HC.
 * Fenêtre par défaut : 6 mois.
 *
 * @param {Array<{velCalcHC: number|null}>} sprints - Sprints triés par ordre chronologique
 * @param {number} windowSize - Taille de la fenêtre (défaut 6)
 * @returns {number|null}
 */
function calcMoyVelCalcHC(sprints, windowSize = 6) {
  // Ne garder que les sprints avec une valeur de velCalcHC
  const validValues = sprints
    .filter(s => s.velCalcHC !== null && s.velCalcHC !== undefined)
    .map(s => s.velCalcHC);

  if (validValues.length === 0) return null;

  const window = validValues.slice(-windowSize);
  const sum = window.reduce((acc, v) => acc + v, 0);
  return sum / window.length;
}

/**
 * Recalcule le champ moyVelCalcHC pour tous les sprints en tenant compte
 * de la fenêtre glissante de 6 mois.
 * Retourne une copie des sprints avec moyVelCalcHC mis à jour.
 *
 * @param {Array} sprints - Sprints triés chronologiquement (sprint ASC)
 * @param {number} windowSize
 * @returns {Array}
 */
function recomputeAllMoyVelCalcHC(sprints, windowSize = 6) {
  return sprints.map((sprint, index) => {
    const precedents = sprints.slice(0, index + 1);
    const moy = calcMoyVelCalcHC(precedents, windowSize);
    return { ...sprint, moyVelCalcHC: moy };
  });
}

/**
 * Formate un nombre avec au plus 2 décimales, ou retourne '—' si null/undefined.
 */
function formatVal(val, decimals = 2) {
  if (val === null || val === undefined || isNaN(val)) return '—';
  return Number(val).toFixed(decimals);
}
