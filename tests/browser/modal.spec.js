const path = require('node:path');
const { test, expect } = require('@playwright/test');

const calculationsPath = path.resolve(__dirname, '../../js/calculations.js');
const modalPath = path.resolve(__dirname, '../../js/sprint-edit-modal.js');

async function bootstrapModal(page) {
  await page.setContent(`
    <!DOCTYPE html>
    <html>
      <body>
        <div class="modal-overlay" id="edit-modal">
          <div class="modal">
            <div class="modal-header">
              <h3 id="modal-title">Modifier le sprint</h3>
              <button id="modal-close-btn" type="button">✕</button>
            </div>
            <input type="hidden" id="modal-sprint-id" />
            <input id="modal-vel-const" />
            <input id="modal-nb-dev" />
            <input id="modal-jours-abs" />
            <input id="modal-nb-jours" />
            <button id="modal-delete-btn" type="button">Supprimer</button>
            <button id="modal-cancel-btn" type="button">Annuler</button>
            <button id="modal-save-btn" type="button">Enregistrer</button>
          </div>
        </div>
      </body>
    </html>
  `);

  await page.addScriptTag({ path: calculationsPath });
  await page.addScriptTag({ path: modalPath });

  await page.evaluate(() => {
    window.formatMois = (mois) => mois;
    window.__saveCalls = [];
    window.__deleteCalls = [];
    window.__toastCalls = [];

    const sprint = {
      id: 's1',
      sprint: 2,
      mois: '2025-02',
      nbDev: 5,
      joursAbsDev: 1,
      nbJours: 20,
      velConst: 100,
    };

    window.__modal = createSprintEditModal({
      elements: {
        overlay: document.getElementById('edit-modal'),
        title: document.getElementById('modal-title'),
        sprintId: document.getElementById('modal-sprint-id'),
        velConst: document.getElementById('modal-vel-const'),
        nbDev: document.getElementById('modal-nb-dev'),
        joursAbs: document.getElementById('modal-jours-abs'),
        nbJours: document.getElementById('modal-nb-jours'),
        closeButton: document.getElementById('modal-close-btn'),
        cancelButton: document.getElementById('modal-cancel-btn'),
        saveButton: document.getElementById('modal-save-btn'),
        deleteButton: document.getElementById('modal-delete-btn'),
      },
      getSprintById: (id) => (id === sprint.id ? sprint : null),
      validateSprint: () => null,
      toast: (message, type) => window.__toastCalls.push({ message, type }),
      confirmFn: () => true,
      onSave: async (id, mergedSprint) => {
        window.__saveCalls.push({ id, mergedSprint });
      },
      onDelete: async (id) => {
        window.__deleteCalls.push(id);
      },
    });

    window.__modal.bind();
    window.__modal.open(sprint);
  });
}

test('desktop: le bouton enregistrer déclenche bien la sauvegarde', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 900 });
  await bootstrapModal(page);

  await page.fill('#modal-vel-const', '123');
  await page.fill('#modal-nb-dev', '6');
  await page.fill('#modal-jours-abs', '2');
  await page.fill('#modal-nb-jours', '21');
  await page.click('#modal-save-btn');

  const saveCalls = await page.evaluate(() => window.__saveCalls);
  await expect(saveCalls.length).toBe(1);
  await expect(saveCalls[0].mergedSprint.velConst).toBe(123);
  await expect(saveCalls[0].mergedSprint.nbDev).toBe(6);
});

test('mobile: le bouton supprimer déclenche bien la suppression', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await bootstrapModal(page);

  await page.click('#modal-delete-btn');

  const deleteCalls = await page.evaluate(() => window.__deleteCalls);
  await expect(deleteCalls.length).toBe(1);
  await expect(deleteCalls[0]).toBe('s1');
});
