/**
 * auth.js
 * Gestion de l'authentification Firebase.
 * L'ID Projet est transformé en email fictif : {projectId}@velocitytracker.app
 */

const AUTH_DOMAIN_SUFFIX = '@velocitytracker.app';

function buildEmail(projectId) {
  return projectId.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '-') + AUTH_DOMAIN_SUFFIX;
}

async function loginProject(projectId, code) {
  const email = buildEmail(projectId);
  const result = await auth.signInWithEmailAndPassword(email, code);
  const pid = projectId.trim();
  sessionStorage.setItem('projectId', pid);
  localStorage.setItem('projectId', pid);
  return result;
}

async function createProject(projectId, code) {
  if (code.length < 6) throw new Error('Le code doit contenir au moins 6 caractères.');
  const email = buildEmail(projectId);
  const result = await auth.createUserWithEmailAndPassword(email, code);
  const pid = projectId.trim();
  sessionStorage.setItem('projectId', pid);
  localStorage.setItem('projectId', pid);
  return result;
}

async function logoutProject() {
  sessionStorage.removeItem('projectId');
  localStorage.removeItem('projectId');
  await auth.signOut();
}

function getProjectId() {
  return sessionStorage.getItem('projectId') || localStorage.getItem('projectId') || '';
}

/** Extrait l'ID projet depuis l'email Firebase (fallback si storage vide). */
function extractProjectIdFromEmail(email) {
  if (!email) return '';
  return email.replace(AUTH_DOMAIN_SUFFIX, '');
}

// Redirige selon l'état d'authentification
function requireAuth(redirectTo = 'index.html') {
  return new Promise((resolve) => {
    auth.onAuthStateChanged((user) => {
      if (!user) {
        window.location.href = redirectTo;
      } else {
        resolve(user);
      }
    });
  });
}

function requireGuest(redirectTo = 'dashboard.html') {
  return new Promise((resolve) => {
    auth.onAuthStateChanged((user) => {
      if (user) {
        window.location.href = redirectTo;
      } else {
        resolve();
      }
    });
  });
}
