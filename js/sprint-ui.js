/**
 * sprint-ui.js
 * Fonctions de rendu UI et helpers DOM.
 */

(function (global) {
  function getEl(id) {
    return document.getElementById(id);
  }

  function parseNumberOrNull(value) {
    if (value === '' || value === null || value === undefined) return null;
    const parsed = parseFloat(value);
    return isNaN(parsed) ? null : parsed;
  }

  function setLoadingHidden(hidden) {
    getEl('loading-overlay').classList.toggle('hidden', hidden);
  }

  function populateYearOptions() {
    const select = getEl('f-mois-year');
    select.innerHTML = '<option value="">Année</option>';
    const currentYear = new Date().getFullYear();
    for (let year = currentYear - 5; year <= currentYear + 3; year++) {
      const option = document.createElement('option');
      option.value = year;
      option.textContent = year;
      select.appendChild(option);
    }
  }

  function setSprintBadge(sprint) {
    getEl('form-sprint-badge').textContent = sprint ? `Sprint ${sprint}` : 'Sprint ?';
  }

  function renderVelocityResult(velEstAC) {
    const result = getEl('result-vel-ac');
    if (velEstAC !== null && velEstAC !== undefined) {
      result.textContent = formatVal(velEstAC, 1);
      result.classList.remove('na');
      return;
    }

    result.textContent = '—';
    result.classList.add('na');
  }

  function clearVelocityResult() {
    renderVelocityResult(null);
    setSprintBadge('');
  }

  function formatMois(mois, short = false) {
    if (!mois) return '—';
    const [year, month] = mois.split('-').map(Number);
    const date = new Date(year, month - 1, 1);
    if (short) return date.toLocaleDateString('fr-FR', { month: 'long' });
    return date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  }

  function renderHistory(sprints) {
    const sorted = [...sprints].sort((a, b) => b.sprint - a.sprint);
    const tbody = getEl('history-body');
    const count = sprints.length;

    getEl('sprint-count').textContent =
      count === 0 ? '0 sprint' : count === 1 ? '1 sprint' : `${count} sprints`;

    if (count === 0) {
      tbody.innerHTML = `
        <tr><td colspan="5">
          <div class="empty-state">
            <div class="empty-state-icon">◎</div>
            <p>Aucun sprint enregistré. Commencez par saisir votre premier sprint.</p>
          </div>
        </td></tr>`;
      return;
    }

    tbody.innerHTML = sorted.map((sprint) => `
      <tr onclick="App.openModal('${sprint.id}')">
        <td class="col-sprint">${sprint.sprint}</td>
        <td>
          <span class="month-full">${formatMois(sprint.mois, false)}</span>
          <span class="month-short">${formatMois(sprint.mois, true)}</span>
        </td>
        <td class="col-highlight">${formatVal(sprint.velEstAC, 1)}</td>
        <td class="${sprint.velConst !== null && sprint.velConst !== undefined ? 'col-success' : 'col-muted'}">
          ${sprint.velConst !== null && sprint.velConst !== undefined ? formatVal(sprint.velConst, 1) : '—'}
        </td>
        <td class="col-desktop-only">
          <div class="td-actions">
            <button class="btn-edit" onclick="event.stopPropagation();App.openModal('${sprint.id}')">Éditer</button>
          </div>
        </td>
      </tr>
    `).join('');
  }

  function showEditModal(sprint) {
    getEl('modal-title').textContent = `Modifier Sprint ${sprint.sprint} — ${formatMois(sprint.mois)}`;
    getEl('modal-sprint-id').value = sprint.id;
    getEl('modal-vel-const').value = sprint.velConst ?? '';
    getEl('modal-nb-dev').value = sprint.nbDev ?? '';
    getEl('modal-jours-abs').value = sprint.joursAbsDev ?? '';
    getEl('modal-nb-jours').value = sprint.nbJours ?? '';
    getEl('edit-modal').classList.add('open');
  }

  function hideEditModal(event) {
    if (event && event.target !== getEl('edit-modal')) return;
    getEl('edit-modal').classList.remove('open');
    getEl('modal-sprint-id').value = '';
  }

  function readModalValues() {
    return {
      velConst: parseNumberOrNull(getEl('modal-vel-const').value),
      nbDev: parseNumberOrNull(getEl('modal-nb-dev').value),
      joursAbsDev: parseNumberOrNull(getEl('modal-jours-abs').value),
      nbJours: parseNumberOrNull(getEl('modal-nb-jours').value),
    };
  }

  function toast(message, type = 'success') {
    const container = getEl('toast-container');
    const element = document.createElement('div');
    element.className = `toast ${type}`;
    element.textContent = message;
    container.appendChild(element);
    setTimeout(() => element.remove(), 3500);
  }

  function animateBtn(button) {
    if (!button) return;
    button.classList.remove('btn-press');
    void button.offsetWidth;
    button.classList.add('btn-press');
    button.addEventListener('animationend', () => button.classList.remove('btn-press'), { once: true });
  }

  const api = {
    getEl,
    setLoadingHidden,
    populateYearOptions,
    setSprintBadge,
    renderVelocityResult,
    clearVelocityResult,
    renderHistory,
    showEditModal,
    hideEditModal,
    readModalValues,
    toast,
    animateBtn,
  };

  Object.assign(global, api);
})(window);
