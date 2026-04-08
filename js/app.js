/**
 * app.js
 * Logique principale du Velocity Tracker.
 * Dépend de : firebase-config.js, working-days.js, calculations.js, auth.js
 */

const App = (() => {

  let currentUser = null;
  let allSprints = [];       // Triés chronologiquement (sprint ASC)
  let editingSprintId = null;
  let isFirstSprint = true;
  let firstSprintMois = null; // "YYYY-MM" du premier sprint enregistré

  // ── Init ──────────────────────────────────────────────────────────────────

  async function init() {
    currentUser = await requireAuth('index.html');
    const pid = getProjectId() || extractProjectIdFromEmail(currentUser.email);
    document.getElementById('header-project-id').textContent = pid || currentUser.uid.slice(0, 8);
    document.getElementById('loading-overlay').classList.add('hidden');

    initYearOptions();
    await loadSprints();
    bindFormListeners();
  }

  function initYearOptions() {
    const sel = document.getElementById('f-mois-year');
    const cur = new Date().getFullYear();
    for (let y = cur - 5; y <= cur + 3; y++) {
      const opt = document.createElement('option');
      opt.value = y;
      opt.textContent = y;
      sel.appendChild(opt);
    }
  }

  function getMoisValue() {
    const m = document.getElementById('f-mois-month').value;
    const y = document.getElementById('f-mois-year').value;
    return (m && y) ? `${y}-${m}` : '';
  }

  function setMoisValue(yyyymm) {
    if (!yyyymm) {
      document.getElementById('f-mois-month').value = '';
      document.getElementById('f-mois-year').value = '';
      return;
    }
    const [y, m] = yyyymm.split('-');
    document.getElementById('f-mois-month').value = m;
    document.getElementById('f-mois-year').value = y;
  }

  // ── Firestore ─────────────────────────────────────────────────────────────

  function sprintsRef() {
    return db.collection('users').doc(currentUser.uid).collection('sprints');
  }

  async function loadSprints() {
    const snap = await sprintsRef().orderBy('sprint', 'asc').get();
    allSprints = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    isFirstSprint = allSprints.length === 0;
    firstSprintMois = allSprints.length > 0 ? allSprints[0].mois : null;
    renderHistory();
    prefillNextSprint();
  }

  async function saveSprint() {
    const data = collectFormData();
    if (!data) return;

    const btn = document.getElementById('save-btn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Enregistrement…';

    try {
      const computed = computeFields(data, allSprints);
      const record = { ...data, ...computed, createdAt: firebase.firestore.FieldValue.serverTimestamp() };

      await sprintsRef().add(record);
      toast('Sprint enregistré avec succès.', 'success');
      await loadSprints();
      resetForm();
    } catch (err) {
      toast('Erreur lors de l\'enregistrement : ' + err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Enregistrer le sprint';
    }
  }

  async function saveModal() {
    if (!editingSprintId) return;

    const velConst = parseFloatOrNull(document.getElementById('modal-vel-const').value);
    const nbDev    = parseFloatOrNull(document.getElementById('modal-nb-dev').value);
    const joursAbs = parseFloatOrNull(document.getElementById('modal-jours-abs').value);
    const nbJours  = parseFloatOrNull(document.getElementById('modal-nb-jours').value);
    const velHC    = parseFloatOrNull(document.getElementById('modal-vel-hc').value);

    const idx = allSprints.findIndex(s => s.id === editingSprintId);
    if (idx === -1) return;

    // Reconstruct this sprint with updated values, recompute
    const updatedSprint = {
      ...allSprints[idx],
      nbDev:    nbDev    ?? allSprints[idx].nbDev,
      joursAbsDev: joursAbs ?? allSprints[idx].joursAbsDev,
      nbJours:  nbJours  ?? allSprints[idx].nbJours,
      velEstHC: velHC    ?? allSprints[idx].velEstHC,
      velConst: velConst,
    };

    // Recompute derived fields
    updatedSprint.velEstAC = calcVelEstAC(updatedSprint.velEstHC, updatedSprint.nbDev, updatedSprint.nbJours, updatedSprint.joursAbsDev);
    updatedSprint.velCalcHC = calcVelCalcHC(updatedSprint.nbDev, updatedSprint.nbJours, updatedSprint.joursAbsDev, updatedSprint.velConst);

    // Update in allSprints, recompute moyVelCalcHC for all
    const tempSprints = [...allSprints];
    tempSprints[idx] = updatedSprint;
    const recomputed = recomputeAllMoyVelCalcHC(tempSprints);

    try {
      // Batch update all sprints' moyVelCalcHC
      const batch = db.batch();
      recomputed.forEach(s => {
        const ref = sprintsRef().doc(s.id);
        const payload = {
          nbDev: s.nbDev,
          joursAbsDev: s.joursAbsDev,
          nbJours: s.nbJours,
          velEstHC: s.velEstHC,
          velEstAC: s.velEstAC,
          velConst: s.velConst ?? null,
          velCalcHC: s.velCalcHC ?? null,
          moyVelCalcHC: s.moyVelCalcHC ?? null,
        };
        if (s.id === editingSprintId) Object.assign(payload, { nbDev: updatedSprint.nbDev });
        batch.update(ref, payload);
      });
      await batch.commit();
      toast('Sprint mis à jour.', 'success');
      closeModal();
      await loadSprints();
    } catch (err) {
      toast('Erreur : ' + err.message, 'error');
    }
  }

  async function deleteSprint() {
    if (!editingSprintId) return;
    if (!confirm('Supprimer ce sprint ? Cette action est irréversible.')) return;

    try {
      await sprintsRef().doc(editingSprintId).delete();
      toast('Sprint supprimé.', 'success');
      closeModal();
      await loadSprints();
    } catch (err) {
      toast('Erreur : ' + err.message, 'error');
    }
  }

  // ── Form Helpers ──────────────────────────────────────────────────────────

  function bindFormListeners() {
    // Synchronisation Mois ↔ Sprint (deux selects)
    document.getElementById('f-mois-month').addEventListener('change', onMoisChange);
    document.getElementById('f-mois-year').addEventListener('change', onMoisChange);
    document.getElementById('f-sprint').addEventListener('input', onSprintChange);

    // Recalcul temps réel
    ['f-nb-dev', 'f-jours-abs', 'f-nb-jours', 'f-vel-hc', 'f-vel-const'].forEach(id => {
      document.getElementById(id).addEventListener('input', updateLiveCalc);
    });
  }

  function onMoisChange() {
    const moisVal = getMoisValue();
    if (!moisVal) return;

    // Auto-calcul jours ouvrés
    const [year, month] = moisVal.split('-').map(Number);
    document.getElementById('f-nb-jours').value = getFrenchWorkingDays(year, month);

    // Si premier sprint : laisser le champ sprint libre
    if (isFirstSprint) {
      updateBadge();
      updateLiveCalc();
      return;
    }

    // Sinon : calculer le N° sprint à partir du mois du premier sprint
    const sprintNum = monthDiff(firstSprintMois, moisVal) + 1;
    if (sprintNum > 0) document.getElementById('f-sprint').value = sprintNum;
    updateBadge();
    updateLiveCalc();
  }

  function onSprintChange() {
    const sprintVal = parseInt(document.getElementById('f-sprint').value, 10);
    if (!sprintVal || sprintVal < 1) return;

    // Si premier sprint : laisser le champ mois libre
    if (isFirstSprint) {
      updateBadge();
      updateLiveCalc();
      return;
    }

    // Calculer le mois correspondant
    if (firstSprintMois) {
      const mois = addMonths(firstSprintMois, sprintVal - 1);
      setMoisValue(mois);
      const [year, month] = mois.split('-').map(Number);
      document.getElementById('f-nb-jours').value = getFrenchWorkingDays(year, month);
    }
    updateBadge();
    updateLiveCalc();
  }

  function updateBadge() {
    const sprint = document.getElementById('f-sprint').value;
    document.getElementById('form-sprint-badge').textContent = sprint ? `Sprint ${sprint}` : 'Sprint ?';
  }

  function updateLiveCalc() {
    const nbDev    = parseFloatOrNull(document.getElementById('f-nb-dev').value);
    const joursAbs = parseFloatOrNull(document.getElementById('f-jours-abs').value) ?? 0;
    const nbJours  = parseFloatOrNull(document.getElementById('f-nb-jours').value);
    const velHC    = parseFloatOrNull(document.getElementById('f-vel-hc').value);
    const velConst = parseFloatOrNull(document.getElementById('f-vel-const').value);

    const nbDevReel = (nbDev && nbJours) ? calcNbDevReel(nbDev, nbJours, joursAbs) : null;
    const velAC     = (velHC && nbDev && nbJours) ? calcVelEstAC(velHC, nbDev, nbJours, joursAbs) : null;
    const velCalcHC = (nbDev && nbJours && velConst !== null) ? calcVelCalcHC(nbDev, nbJours, joursAbs, velConst) : null;

    // Moy Vél calc HC (simulation avec sprint courant)
    const tempSprints = [...allSprints, { velCalcHC }];
    const moy = velCalcHC !== null ? calcMoyVelCalcHC(tempSprints) : calcMoyVelCalcHC(allSprints);

    // Affichage
    const velACEl = document.getElementById('result-vel-ac');
    if (velAC !== null) {
      velACEl.textContent = formatVal(velAC, 1);
      velACEl.classList.remove('na');
    } else {
      velACEl.textContent = '—';
      velACEl.classList.add('na');
    }

    document.getElementById('result-nb-dev-reel').textContent = nbDevReel !== null ? formatVal(nbDevReel, 1) : '—';
    document.getElementById('result-vel-calc-hc').textContent = velCalcHC !== null ? formatVal(velCalcHC, 2) : '—';
    document.getElementById('result-moy-vel').textContent     = moy !== null ? formatVal(moy, 2) : '—';
  }

  function prefillNextSprint() {
    if (allSprints.length === 0) return;

    const last = allSprints[allSprints.length - 1];
    const nextSprintNum = last.sprint + 1;
    const nextMois = addMonths(last.mois, 1);
    const [year, month] = nextMois.split('-').map(Number);
    const nextNbJours = getFrenchWorkingDays(year, month);

    document.getElementById('f-sprint').value = nextSprintNum;
    setMoisValue(nextMois);
    document.getElementById('f-nb-jours').value = nextNbJours;

    // Pré-remplir Nb devs avec le dernier sprint
    document.getElementById('f-nb-dev').value = last.nbDev ?? '';
    document.getElementById('f-jours-abs').value = '';

    // Pré-remplir Vélocité est HC
    const lastMoyVel = last.moyVelCalcHC;
    if (lastMoyVel !== null && lastMoyVel !== undefined && last.nbDev) {
      const nbDevNext = last.nbDev; // par défaut identique, l'user peut changer
      const prefill = calcVelEstHCPrefill(nbDevNext, last.nbDev, lastMoyVel);
      document.getElementById('f-vel-hc').value = prefill !== null ? formatVal(prefill, 2) : '';
    }

    updateBadge();
    updateLiveCalc();
  }

  function collectFormData() {
    const mois     = getMoisValue();
    const sprint   = parseInt(document.getElementById('f-sprint').value, 10);
    const nbDev    = parseFloatOrNull(document.getElementById('f-nb-dev').value);
    const joursAbs = parseFloatOrNull(document.getElementById('f-jours-abs').value) ?? 0;
    const nbJours  = parseFloatOrNull(document.getElementById('f-nb-jours').value);
    const velHC    = parseFloatOrNull(document.getElementById('f-vel-hc').value);
    const velConst = parseFloatOrNull(document.getElementById('f-vel-const').value);

    if (!mois) { toast('Veuillez renseigner le mois.', 'error'); return null; }
    if (!sprint || sprint < 1) { toast('Veuillez renseigner le numéro de sprint.', 'error'); return null; }
    if (!nbDev || nbDev <= 0) { toast('Veuillez renseigner le nombre de devs.', 'error'); return null; }
    if (!nbJours || nbJours <= 0) { toast('Veuillez renseigner le nombre de jours ouvrés.', 'error'); return null; }
    if (!velHC || velHC <= 0) { toast('Veuillez renseigner la vélocité estimée Hors Congés.', 'error'); return null; }

    // Vérifier doublon sprint
    if (allSprints.some(s => s.sprint === sprint)) {
      toast(`Le sprint ${sprint} existe déjà dans l'historique.`, 'error');
      return null;
    }

    return { mois, sprint, nbDev, joursAbsDev: joursAbs, nbJours, velEstHC: velHC, velConst };
  }

  function computeFields(data, existingSprints) {
    const { nbDev, nbJours, joursAbsDev, velEstHC, velConst } = data;

    const velEstAC  = calcVelEstAC(velEstHC, nbDev, nbJours, joursAbsDev);
    const velCalcHC = calcVelCalcHC(nbDev, nbJours, joursAbsDev, velConst);

    // Calcul Moy Vél avec ce nouveau sprint inclus
    const tempSprints = [...existingSprints, { velCalcHC }];
    const moyVelCalcHC = calcMoyVelCalcHC(tempSprints);

    return { velEstAC, velCalcHC, moyVelCalcHC };
  }

  function resetForm() {
    setMoisValue('');
    ['f-sprint', 'f-nb-dev', 'f-jours-abs', 'f-nb-jours', 'f-vel-hc', 'f-vel-const'].forEach(id => {
      document.getElementById(id).value = '';
    });
    document.getElementById('result-vel-ac').textContent = '—';
    document.getElementById('result-vel-ac').classList.add('na');
    document.getElementById('result-nb-dev-reel').textContent = '—';
    document.getElementById('result-vel-calc-hc').textContent = '—';
    document.getElementById('result-moy-vel').textContent = '—';
    document.getElementById('form-sprint-badge').textContent = 'Sprint ?';
    prefillNextSprint();
  }

  // ── History Render ────────────────────────────────────────────────────────

  function renderHistory() {
    const sorted = [...allSprints].sort((a, b) => b.sprint - a.sprint);
    const tbody = document.getElementById('history-body');
    const count = allSprints.length;

    document.getElementById('sprint-count').textContent =
      count === 0 ? '0 sprint' : count === 1 ? '1 sprint' : `${count} sprints`;

    if (count === 0) {
      tbody.innerHTML = `
        <tr><td colspan="8">
          <div class="empty-state">
            <div class="empty-state-icon">◎</div>
            <p>Aucun sprint enregistré. Commencez par saisir votre premier sprint.</p>
          </div>
        </td></tr>`;
      return;
    }

    tbody.innerHTML = sorted.map(s => `
      <tr onclick="App.openModal('${s.id}')">
        <td class="col-sprint">${s.sprint}</td>
        <td>
          <span class="month-full">${formatMois(s.mois, false)}</span>
          <span class="month-short">${formatMois(s.mois, true)}</span>
        </td>
        <td class="col-desktop-only">${s.nbDev ?? '—'}</td>
        <td class="col-desktop-only">${s.joursAbsDev ?? 0}</td>
        <td class="col-desktop-only">${s.nbJours ?? '—'}</td>
        <td class="col-highlight">${formatVal(s.velEstAC, 1)}</td>
        <td class="${s.velConst !== null && s.velConst !== undefined ? 'col-success' : 'col-muted'}">
          ${s.velConst !== null && s.velConst !== undefined ? formatVal(s.velConst, 1) : '—'}
        </td>
        <td class="col-desktop-only">
          <div class="td-actions">
            <button class="btn-edit" onclick="event.stopPropagation();App.openModal('${s.id}')">Éditer</button>
          </div>
        </td>
      </tr>
    `).join('');
  }

  // ── Modal ─────────────────────────────────────────────────────────────────

  function openModal(sprintId) {
    const sprint = allSprints.find(s => s.id === sprintId);
    if (!sprint) return;

    editingSprintId = sprintId;
    document.getElementById('modal-title').textContent = `Modifier Sprint ${sprint.sprint} — ${formatMois(sprint.mois)}`;
    document.getElementById('modal-sprint-id').value = sprintId;
    document.getElementById('modal-vel-const').value = sprint.velConst ?? '';
    document.getElementById('modal-nb-dev').value    = sprint.nbDev ?? '';
    document.getElementById('modal-jours-abs').value = sprint.joursAbsDev ?? '';
    document.getElementById('modal-nb-jours').value  = sprint.nbJours ?? '';
    document.getElementById('modal-vel-hc').value    = sprint.velEstHC ?? '';

    document.getElementById('edit-modal').classList.add('open');
  }

  function closeModal(e) {
    if (e && e.target !== document.getElementById('edit-modal')) return;
    document.getElementById('edit-modal').classList.remove('open');
    editingSprintId = null;
  }

  // ── Utils ─────────────────────────────────────────────────────────────────

  function parseFloatOrNull(val) {
    if (val === '' || val === null || val === undefined) return null;
    const n = parseFloat(val);
    return isNaN(n) ? null : n;
  }

  /**
   * Différence en mois entre deux strings "YYYY-MM".
   * monthDiff("2024-07", "2025-01") → 6
   */
  function monthDiff(from, to) {
    const [fy, fm] = from.split('-').map(Number);
    const [ty, tm] = to.split('-').map(Number);
    return (ty - fy) * 12 + (tm - fm);
  }

  /**
   * Ajoute N mois à une string "YYYY-MM".
   */
  function addMonths(mois, n) {
    const [y, m] = mois.split('-').map(Number);
    const date = new Date(y, m - 1 + n, 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }

  /**
   * Formate "2025-03".
   * short=false → "mars 2025" (desktop)
   * short=true  → "mars"      (mobile)
   */
  function formatMois(mois, short = false) {
    if (!mois) return '—';
    const [y, m] = mois.split('-').map(Number);
    const date = new Date(y, m - 1, 1);
    if (short) return date.toLocaleDateString('fr-FR', { month: 'long' });
    return date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  }

  // ── Toast ─────────────────────────────────────────────────────────────────

  function toast(msg, type = 'success') {
    const container = document.getElementById('toast-container');
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = msg;
    container.appendChild(el);
    setTimeout(() => el.remove(), 3500);
  }

  // ── Logout ────────────────────────────────────────────────────────────────

  async function logout() {
    await logoutProject();
    window.location.href = 'index.html';
  }

  // ── Public API ────────────────────────────────────────────────────────────
  return { init, saveSprint, resetForm, openModal, closeModal, saveModal, deleteSprint, logout };

})();

// Démarrage
App.init();
