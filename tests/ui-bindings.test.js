const test = require('node:test');
const assert = require('node:assert/strict');

const { bindModalActionButtons } = require('../js/ui-bindings.js');

function createFakeButton() {
  let clickHandler = null;

  return {
    addEventListener(eventName, handler) {
      if (eventName === 'click') clickHandler = handler;
    },
    click() {
      if (!clickHandler) throw new Error('No click handler bound');
      clickHandler({
        preventDefault() {},
      });
    },
  };
}

test('bindModalActionButtons relie bien les actions fermer, enregistrer et supprimer', () => {
  const closeButton = createFakeButton();
  const cancelButton = createFakeButton();
  const saveButton = createFakeButton();
  const deleteButton = createFakeButton();

  let closeCalls = 0;
  let saveCalls = 0;
  let deleteCalls = 0;

  bindModalActionButtons(
    { closeButton, cancelButton, saveButton, deleteButton },
    {
      onClose: () => { closeCalls += 1; },
      onSave: () => { saveCalls += 1; },
      onDelete: () => { deleteCalls += 1; },
    }
  );

  closeButton.click();
  cancelButton.click();
  saveButton.click();
  deleteButton.click();

  assert.equal(closeCalls, 2);
  assert.equal(saveCalls, 1);
  assert.equal(deleteCalls, 1);
});
