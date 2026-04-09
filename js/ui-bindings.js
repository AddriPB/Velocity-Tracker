/**
 * ui-bindings.js
 * Helpers de binding d'actions UI testables sans DOM complet.
 */

(function (global) {
  function bindButtonClick(button, handler) {
    if (!button || typeof button.addEventListener !== 'function' || typeof handler !== 'function') return;
    button.addEventListener('click', (event) => {
      event.preventDefault();
      handler(event);
    });
  }

  function bindModalActionButtons(elements, handlers) {
    bindButtonClick(elements.closeButton, handlers.onClose);
    bindButtonClick(elements.cancelButton, handlers.onClose);
    bindButtonClick(elements.saveButton, handlers.onSave);
    bindButtonClick(elements.deleteButton, handlers.onDelete);
  }

  const api = {
    bindButtonClick,
    bindModalActionButtons,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  Object.assign(global, api);
})(typeof window !== 'undefined' ? window : globalThis);
