/**
 * app.js
 * Contrôleur principal du Velocity Tracker.
 * Dépend de : firebase-config.js, working-days.js, calculations.js, auth.js,
 * sprint-store.js, sprint-ui.js
 */

const App = (() => {
  let currentUser = null;
  let store = null;
  let allSprints = [];
  let editModal = null;

  async function init() {
    currentUser = await requireAuth('index.html');
    store = createSprintStore(currentUser);

    const projectId = getProjectId() || extractProjectIdFromEmail(currentUser.email);
    getEl('header-project-id').textContent = projectId || currentUser.uid.slice(0, 8);

    initEditModal();
    populateYearOptions();
    bindFormListeners();
    await refreshSprints();
    setLoadingHidden(true);
  }

  async function refreshSprints() {
    allSprints = await store.loadSprints();
    renderHistory(allSprints);
    prefillNextSprint();
  }

  function initEditModal() {
    editModal = createSprintEditModal({
      elements: {
        overlay: getEl('edit-modal'),
        title: getEl('modal-title'),
        sprintId: getEl('modal-sprint-id'),
        velConst: getEl('modal-vel-const'),
        nbDev: getEl('modal-nb-dev'),
        joursAbs: getEl('modal-jours-abs'),
        nbJours: getEl('modal-nb-jours'),
        closeButton: getEl('modal-close-btn'),
        cancelButton: getEl('modal-cancel-btn'),
        saveButton: getEl('modal-save-btn'),
        deleteButton: getEl('modal-delete-btn'),
      },
      getSprintById: (id) => allSprints.find((sprint) => sprint.id === id) || null,
      validateSprint: validateSprintData,
      toast,
      onSave: async (sprintId, mergedSprint) => {
        const patch = {
          nbDev: mergedSprint.nbDev,
          joursAbsDev: mergedSprint.joursAbsDev,
          nbJours: mergedSprint.nbJours,
          velConst: mergedSprint.velConst,
        };
        await store.updateSprint(sprintId, patch, allSprints);
        toast('Sprint mis à jour.', 'success');
        await refreshSprints();
      },
      onDelete: async (sprintId) => {
        await store.deleteSprint(sprintId, allSprints);
        toast('Sprint supprimé.', 'success');
        await refreshSprints();
      },
    });

    editModal.bind();
  }

  function bindFormListeners() {
    getEl('f-mois-month').addEventListener('change', onMoisChange);
    getEl('f-mois-year').addEventListener('change', onMoisChange);

    const sprintInput = getEl('f-sprint');
    const integerInputIds = ['f-sprint', 'f-nb-jours', 'f-vel-const', 'modal-vel-const', 'modal-nb-jours'];
    integerInputIds.forEach((id) => {
      const input = getEl(id);
      if (!input) return;
      input.addEventListener('keydown', (event) => {
        if (['-', '+', '.', ',', 'e'].includes(event.key)) event.preventDefault();
      });
      input.addEventListener('input', () => {
        const clean = input.value.replace(/[^0-9]/g, '');
        if (input.value !== clean) input.value = clean;
        if (id === 'f-sprint') onSprintChange();
        if (['f-nb-jours', 'f-vel-const'].includes(id)) updateLiveCalc();
      });
    });

    ['f-nb-dev', 'f-jours-abs'].forEach((id) => {
      getEl(id).addEventListener('input', updateLiveCalc);
    });
  }

  function parseFloatOrNull(value) {
    if (value === '' || value === null || value === undefined) return null;
    const parsed = parseFloat(value);
    return isNaN(parsed) ? null : parsed;
  }

  function getMoisValue() {
    const month = getEl('f-mois-month').value;
    const year = getEl('f-mois-year').value;
    return month && year ? `${year}-${month}` : '';
  }

  function setMoisValue(yyyymm) {
    if (!yyyymm) {
      getEl('f-mois-month').value = '';
      getEl('f-mois-year').value = '';
      return;
    }

    const [year, month] = yyyymm.split('-');
    getEl('f-mois-month').value = month;
    getEl('f-mois-year').value = year;
  }

  function monthDiff(from, to) {
    const [fromYear, fromMonth] = from.split('-').map(Number);
    const [toYear, toMonth] = to.split('-').map(Number);
    return (toYear - fromYear) * 12 + (toMonth - fromMonth);
  }

  function addMonths(mois, count) {
    const [year, month] = mois.split('-').map(Number);
    const date = new Date(year, month - 1 + count, 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }

  function getFirstSprintMois() {
    return allSprints.length > 0 ? allSprints[0].mois : null;
  }

  function getFirstSprintNumber() {
    return allSprints.length > 0 ? allSprints[0].sprint : 0;
  }

  function isFirstSprint() {
    return allSprints.length === 0;
  }

  function updateWorkingDaysFromMonth() {
    const mois = getMoisValue();
    if (!mois) return;

    const [year, month] = mois.split('-').map(Number);
    getEl('f-nb-jours').value = getFrenchWorkingDays(year, month);
  }

  function computeDraftSprint(data, history = allSprints) {
    const velEstHC = history.length === 0
      ? calcInitialVelEstHC(data.nbDev, data.nbJours, data.joursAbsDev, data.velConst)
      : calcVelEstHCFromHistory(data.nbDev, data.nbJours, history);

    const velEstAC = calcVelEstAC(velEstHC, data.nbDev, data.nbJours, data.joursAbsDev);
    const velCalcHC = calcVelCalcHC(data.nbDev, data.nbJours, data.joursAbsDev, data.velConst);
    const moyVelCalcHC = velCalcHC !== null
      ? calcMoyVelCalcHC([...history, { velCalcHC }])
      : calcMoyVelCalcHC(history);

    return { velEstHC, velEstAC, velCalcHC, moyVelCalcHC };
  }

  function getFormData() {
    return {
      mois: getMoisValue(),
      sprint: parseInt(getEl('f-sprint').value, 10),
      nbDev: parseFloatOrNull(getEl('f-nb-dev').value),
      joursAbsDev: parseFloatOrNull(getEl('f-jours-abs').value) ?? 0,
      nbJours: parseFloatOrNull(getEl('f-nb-jours').value),
      velConst: parseFloatOrNull(getEl('f-vel-const').value),
    };
  }

  function validateSprintData(data, sprintIdToIgnore = null) {
    if (!data.mois) return 'Veuillez renseigner le mois.';
    if (data.sprint === null || Number.isNaN(data.sprint) || data.sprint < 0) {
      return 'Veuillez renseigner le numéro de sprint.';
    }
    if (!data.nbDev || data.nbDev <= 0) return 'Veuillez renseigner le nombre de devs.';
    if (!data.nbJours || data.nbJours <= 0) return 'Veuillez renseigner le nombre de jours ouvrés.';

    const otherSprints = allSprints.filter((sprint) => sprint.id !== sprintIdToIgnore);
    const earliestSprint = otherSprints.length > 0
      ? Math.min(...otherSprints.map((sprint) => sprint.sprint))
      : Infinity;
    const requiresObservedVelocity = otherSprints.length === 0 || data.sprint < earliestSprint;

    if (requiresObservedVelocity && (data.velConst === null || data.velConst <= 0)) {
      return 'Veuillez renseigner la vélocité constatée pour le premier sprint.';
    }

    const duplicate = allSprints.some((sprint) => sprint.id !== sprintIdToIgnore && sprint.sprint === data.sprint);
    if (duplicate) return `Le sprint ${data.sprint} existe déjà dans l'historique.`;

    return null;
  }

  function updateLiveCalc() {
    const data = getFormData();
    const draft = computeDraftSprint(data);
    renderVelocityResult(draft.velEstAC);
  }

  function onMoisChange() {
    const mois = getMoisValue();
    if (!mois) return;

    updateWorkingDaysFromMonth();

    if (!isFirstSprint()) {
      const sprint = getFirstSprintNumber() + monthDiff(getFirstSprintMois(), mois);
      if (sprint >= 0) getEl('f-sprint').value = sprint;
    }

    setSprintBadge(getEl('f-sprint').value);
    updateLiveCalc();
  }

  function onSprintChange() {
    const sprint = parseInt(getEl('f-sprint').value, 10);
    if (Number.isNaN(sprint) || sprint < 0) return;

    if (!isFirstSprint()) {
      const mois = addMonths(getFirstSprintMois(), sprint - getFirstSprintNumber());
      setMoisValue(mois);
      updateWorkingDaysFromMonth();
    }

    setSprintBadge(sprint);
    updateLiveCalc();
  }

  function prefillNextSprint() {
    if (allSprints.length === 0) {
      resetForm(true);
      return;
    }

    const last = allSprints[allSprints.length - 1];
    const nextSprint = last.sprint + 1;
    const nextMois = addMonths(last.mois, 1);
    const [year, month] = nextMois.split('-').map(Number);

    getEl('f-sprint').value = nextSprint;
    setMoisValue(nextMois);
    getEl('f-nb-jours').value = getFrenchWorkingDays(year, month);
    getEl('f-nb-dev').value = last.nbDev ?? '';
    getEl('f-jours-abs').value = '';
    getEl('f-vel-const').value = '';

    setSprintBadge(nextSprint);
    updateLiveCalc();
  }

  function resetForm(skipAnimation = false) {
    if (!skipAnimation) animateBtn(document.querySelector('.btn-reset'));

    setMoisValue('');
    ['f-sprint', 'f-nb-dev', 'f-jours-abs', 'f-nb-jours', 'f-vel-const'].forEach((id) => {
      getEl(id).value = '';
    });

    clearVelocityResult();

    if (allSprints.length > 0) {
      prefillNextSprint();
    }
  }

  async function saveSprint() {
    const button = getEl('save-btn');
    animateBtn(button);

    const data = getFormData();
    const validationError = validateSprintData(data);
    if (validationError) {
      toast(validationError, 'error');
      return;
    }

    button.disabled = true;
    button.innerHTML = '<span class="spinner"></span> Enregistrement…';

    try {
      await store.createSprint(data, allSprints);
      toast('Sprint enregistré avec succès.', 'success');
      await refreshSprints();
      resetForm(true);
    } catch (error) {
      toast(`Erreur lors de l'enregistrement : ${error.message}`, 'error');
    } finally {
      button.disabled = false;
      button.textContent = 'Enregistrer le sprint';
    }
  }

  function openModal(sprintId) {
    const sprint = allSprints.find((item) => item.id === sprintId);
    if (!sprint) return;
    editModal.open(sprint);
  }

  function closeModal(event) {
    editModal.close(event);
  }

  async function saveModal() {
    return editModal.submit();
  }

  async function deleteSprint() {
    return editModal.remove();
  }

  async function deleteSprintFromRow(sprintId) {
    if (!sprintId) return;
    if (!confirm('Supprimer ce sprint ? Cette action est irréversible.')) return;

    try {
      await store.deleteSprint(sprintId, allSprints);
      toast('Sprint supprimé.', 'success');
      await refreshSprints();
    } catch (error) {
      toast(`Erreur : ${error.message}`, 'error');
    }
  }

  async function logout() {
    await logoutProject();
    window.location.href = 'index.html';
  }

  return {
    init,
    saveSprint,
    resetForm,
    openModal,
    closeModal,
    saveModal,
    deleteSprint,
    deleteSprintFromRow,
    logout,
  };
})();

window.App = App;
App.init();
