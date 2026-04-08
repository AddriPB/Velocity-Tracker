/**
 * firebase-config.js
 *
 * INSTRUCTIONS :
 * 1. Rendez-vous sur https://console.firebase.google.com
 * 2. Créez un projet Firebase
 * 3. Dans "Authentication" → activez le fournisseur "E-mail/Mot de passe"
 * 4. Dans "Firestore Database" → créez une base de données (mode production)
 * 5. Dans les paramètres du projet → "Vos applications" → ajoutez une app Web
 * 6. Copiez l'objet firebaseConfig ci-dessous et remplacez les valeurs
 *
 * Règles Firestore recommandées :
 *   rules_version = '2';
 *   service cloud.firestore {
 *     match /databases/{database}/documents {
 *       match /users/{userId}/{document=**} {
 *         allow read, write: if request.auth != null && request.auth.uid == userId;
 *       }
 *     }
 *   }
 */

const firebaseConfig = {
  apiKey: "AIzaSyBT1obat9GA87eOMYnGvnyL2bireT-Ks24",
  authDomain: "velocity-tracker-72065.firebaseapp.com",
  projectId: "velocity-tracker-72065",
  storageBucket: "velocity-tracker-72065.firebasestorage.app",
  messagingSenderId: "286827924696",
  appId: "1:286827924696:web:158927e0b90ef5215bdbad"
};

// Initialisation Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();
