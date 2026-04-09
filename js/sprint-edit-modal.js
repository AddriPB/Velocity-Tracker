/**
 * sprint-edit-modal.js
 * Contrôleur dédié à la modale d'édition de sprint.
 */

(function (global) {
  function parseNumberOrNull(value) {
    if (value === '' || value === null || value === undefined) return null;
    const parsed = parseFloat(value);
    return isNaN(parsed) ? null : parsed;
  }

  function createSprintEditModal(options) {
    const {
      elements,
      getSprintById,
      validateSprint,
      onSave,
      onDelete,
      toast,
      confirmFn = global.confirm ? global.confirm.bind(global) : () => true,
    } = options;

    let currentSprintId = null;
    let isBound = false;

    function currentSprint() {
      return currentSprintId ? getSprintById(currentSprintId) : null;
    }

    function setBusy(isBusy) {
      [elements.saveButton, elements.deleteButton].forEach((button) => {
        if (!button) return;
        button.disabled = isBusy;
      });
    }

    function fill(sprint) {
      elements.title.textContent = `Modifier Sprint ${sprint.sprint} — ${formatMois(sprint.mois)}`;
      elements.sprintId.value = sprint.id;
      elements.velConst.value = sprint.velConst !== null && sprint.velConst !== undefined ? Math.round(sprint.velConst) : '';
      elements.nbDev.value = sprint.nbDev !== null && sprint.nbDev !== undefined ? Number(sprint.nbDev).toFixed(2).replace(/\.?0+$/, '') : '';
      elements.joursAbs.value = sprint.joursAbsDev !== null && sprint.joursAbsDev !== undefined ? Number(sprint.joursAbsDev).toFixed(2).replace(/\.?0+$/, '') : '';
      elements.nbJours.value = sprint.nbJours !== null && sprint.nbJours !== undefined ? Math.round(sprint.nbJours) : '';
    }

    function open(sprint) {
      if (!sprint) return;
      currentSprintId = sprint.id;
      fill(sprint);
      elements.overlay.classList.add('open');
    }

    function close(event) {
      if (event && event.target && event.target !== elements.overlay) return;
      elements.overlay.classList.remove('open');
      elements.sprintId.value = '';
      currentSprintId = null;
    }

    function collectFormValues() {
      return {
        velConst: parseNumberOrNull(elements.velConst.value),
        nbDev: parseNumberOrNull(elements.nbDev.value),
        joursAbsDev: parseNumberOrNull(elements.joursAbs.value),
        nbJours: parseNumberOrNull(elements.nbJours.value),
      };
    }

    async function submit() {
      const sprint = currentSprint();
      if (!sprint) {
        toast('Aucun sprint en cours de modification.', 'error');
        return false;
      }

      const mergedSprint = mergeSprintPatch(sprint, collectFormValues());
      const validationError = validateSprint(mergedSprint, sprint.id);
      if (validationError) {
        toast(validationError, 'error');
        return false;
      }

      setBusy(true);
      try {
        await onSave(sprint.id, mergedSprint);
        close();
        return true;
      } catch (error) {
        toast(`Erreur : ${error.message}`, 'error');
        return false;
      } finally {
        setBusy(false);
      }
    }

    async function remove() {
      const sprint = currentSprint();
      if (!sprint) {
        toast('Aucun sprint en cours de modification.', 'error');
        return false;
      }

      if (!confirmFn('Supprimer ce sprint ? Cette action est irréversible.')) {
        return false;
      }

      setBusy(true);
      try {
        await onDelete(sprint.id);
        close();
        return true;
      } catch (error) {
        toast(`Erreur : ${error.message}`, 'error');
        return false;
      } finally {
        setBusy(false);
      }
    }

    function bind() {
      if (isBound) return;
      isBound = true;

      elements.closeButton.addEventListener('click', (event) => {
        event.preventDefault();
        close();
      });

      if (elements.cancelButton) {
        elements.cancelButton.addEventListener('click', (event) => {
          event.preventDefault();
          close();
        });
      }

      elements.saveButton.addEventListener('click', async (event) => {
        event.preventDefault();
        await submit();
      });

      elements.deleteButton.addEventListener('click', async (event) => {
        event.preventDefault();
        await remove();
      });

      elements.overlay.addEventListener('click', (event) => close(event));
    }

    return {
      bind,
      open,
      close,
      collectFormValues,
      submit,
      remove,
      getCurrentSprintId: () => currentSprintId,
    };
  }

  const api = {
    createSprintEditModal,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  Object.assign(global, api);
})(typeof window !== 'undefined' ? window : globalThis);
