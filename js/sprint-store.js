/**
 * sprint-store.js
 * Accès Firestore et persistance des sprints.
 */

(function (global) {
  function createSprintStore(currentUser) {
    function sprintsRef() {
      return db.collection('users').doc(currentUser.uid).collection('sprints');
    }

    async function loadSprints() {
      const snap = await sprintsRef().orderBy('sprint', 'asc').get();
      return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    }

    function buildPersistedPayload(sprint) {
      return {
        mois: sprint.mois,
        sprint: sprint.sprint,
        nbDev: sprint.nbDev,
        joursAbsDev: sprint.joursAbsDev,
        nbJours: sprint.nbJours,
        velEstHC: sprint.velEstHC ?? null,
        velEstAC: sprint.velEstAC ?? null,
        velConst: sprint.velConst ?? null,
        velCalcHC: sprint.velCalcHC ?? null,
        moyVelCalcHC: sprint.moyVelCalcHC ?? null,
      };
    }

    async function createSprint(data, existingSprints) {
      const ref = sprintsRef().doc();
      const candidate = { id: ref.id, ...data };
      const recomputed = recomputeAllSprintMetrics([...existingSprints, candidate]);
      const batch = db.batch();

      recomputed.forEach((sprint) => {
        const docRef = sprintsRef().doc(sprint.id);
        const payload = buildPersistedPayload(sprint);

        if (sprint.id === ref.id) {
          batch.set(docRef, {
            ...payload,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          });
        } else {
          batch.update(docRef, payload);
        }
      });

      await batch.commit();
      return recomputed;
    }

    async function updateSprint(sprintId, patch, existingSprints) {
      const updated = existingSprints.map((sprint) => (
        sprint.id === sprintId ? { ...sprint, ...patch } : sprint
      ));
      const recomputed = recomputeAllSprintMetrics(updated);
      const batch = db.batch();

      recomputed.forEach((sprint) => {
        batch.update(sprintsRef().doc(sprint.id), buildPersistedPayload(sprint));
      });

      await batch.commit();
      return recomputed;
    }

    async function deleteSprint(sprintId, existingSprints) {
      const remaining = existingSprints.filter((sprint) => sprint.id !== sprintId);
      const recomputed = recomputeAllSprintMetrics(remaining);
      const batch = db.batch();

      batch.delete(sprintsRef().doc(sprintId));
      recomputed.forEach((sprint) => {
        batch.update(sprintsRef().doc(sprint.id), buildPersistedPayload(sprint));
      });

      await batch.commit();
      return recomputed;
    }

    return {
      loadSprints,
      createSprint,
      updateSprint,
      deleteSprint,
    };
  }

  global.createSprintStore = createSprintStore;
})(window);
