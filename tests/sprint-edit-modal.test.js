const test = require('node:test');
const assert = require('node:assert/strict');

global.formatMois = (mois) => mois;
global.mergeSprintPatch = (baseSprint, patch) => ({
  ...baseSprint,
  nbDev: patch.nbDev ?? baseSprint.nbDev,
  joursAbsDev: patch.joursAbsDev ?? baseSprint.joursAbsDev ?? 0,
  nbJours: patch.nbJours ?? baseSprint.nbJours,
  velConst: patch.velConst ?? baseSprint.velConst ?? null,
});

const { createSprintEditModal } = require('../js/sprint-edit-modal.js');

function createFakeButton() {
  const handlers = {};
  return {
    disabled: false,
    addEventListener(eventName, handler) {
      handlers[eventName] = handler;
    },
    async click() {
      if (!handlers.click) throw new Error('No click handler bound');
      await handlers.click({ preventDefault() {}, target: this });
    },
  };
}

function createFakeInput(value = '') {
  return { value };
}

function createFakeOverlay() {
  const handlers = {};
  const classes = new Set();
  return {
    classList: {
      add(name) { classes.add(name); },
      remove(name) { classes.delete(name); },
      contains(name) { return classes.has(name); },
    },
    addEventListener(eventName, handler) {
      handlers[eventName] = handler;
    },
    clickSelf() {
      if (handlers.click) handlers.click({ target: this });
    },
  };
}

test('SprintEditModal ouvre, collecte, sauvegarde et ferme correctement', async () => {
  const overlay = createFakeOverlay();
  const saveButton = createFakeButton();
  const deleteButton = createFakeButton();
  const closeButton = createFakeButton();
  const cancelButton = createFakeButton();
  const toasts = [];
  const saved = [];

  const elements = {
    overlay,
    title: { textContent: '' },
    sprintId: createFakeInput(),
    velConst: createFakeInput(),
    nbDev: createFakeInput(),
    joursAbs: createFakeInput(),
    nbJours: createFakeInput(),
    closeButton,
    cancelButton,
    saveButton,
    deleteButton,
  };

  const sprint = {
    id: 's1',
    sprint: 2,
    mois: '2025-02',
    nbDev: 5,
    joursAbsDev: 1,
    nbJours: 20,
    velConst: 100,
  };

  const modal = createSprintEditModal({
    elements,
    getSprintById: (id) => (id === sprint.id ? sprint : null),
    validateSprint: () => null,
    toast: (message, type) => toasts.push({ message, type }),
    onSave: async (id, mergedSprint) => {
      saved.push({ id, mergedSprint });
    },
    onDelete: async () => {},
  });

  modal.bind();
  modal.open(sprint);

  assert.equal(overlay.classList.contains('open'), true);
  elements.velConst.value = '123';
  elements.nbDev.value = '6';
  elements.joursAbs.value = '2';
  elements.nbJours.value = '21';

  await saveButton.click();

  assert.equal(saved.length, 1);
  assert.equal(saved[0].id, 's1');
  assert.equal(saved[0].mergedSprint.velConst, 123);
  assert.equal(saved[0].mergedSprint.nbDev, 6);
  assert.equal(saved[0].mergedSprint.joursAbsDev, 2);
  assert.equal(saved[0].mergedSprint.nbJours, 21);
  assert.equal(overlay.classList.contains('open'), false);
  assert.equal(toasts.length, 0);
});

test('SprintEditModal bloque les actions si aucun sprint n’est en cours', async () => {
  const overlay = createFakeOverlay();
  const saveButton = createFakeButton();
  const deleteButton = createFakeButton();
  const closeButton = createFakeButton();
  const cancelButton = createFakeButton();
  const toasts = [];

  const modal = createSprintEditModal({
    elements: {
      overlay,
      title: { textContent: '' },
      sprintId: createFakeInput(),
      velConst: createFakeInput(),
      nbDev: createFakeInput(),
      joursAbs: createFakeInput(),
      nbJours: createFakeInput(),
      closeButton,
      cancelButton,
      saveButton,
      deleteButton,
    },
    getSprintById: () => null,
    validateSprint: () => null,
    toast: (message, type) => toasts.push({ message, type }),
    onSave: async () => {},
    onDelete: async () => {},
  });

  modal.bind();
  await saveButton.click();
  await deleteButton.click();

  assert.equal(toasts.length, 2);
  assert.equal(toasts[0].type, 'error');
  assert.equal(toasts[1].type, 'error');
});
