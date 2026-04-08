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
