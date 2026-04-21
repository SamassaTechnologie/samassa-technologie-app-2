const firebaseConfig = {
  apiKey: "AIzaSyDzFAcugyNIo51JLb2dGuQgPcJ5ggMRTC0",
  authDomain: "samassa-kayes.firebaseapp.com",
  databaseURL: "https://samassa-kayes-default-rtdb.firebaseio.com",
  projectId: "samassa-kayes",
  storageBucket: "samassa-kayes.firebasestorage.app",
  messagingSenderId: "213594348320",
  appId: "1:213594348320:web:dddfaba34e14ada7a51545"
};

// Initialisation
firebase.initializeApp(firebaseConfig);

// Base de données
const db = firebase.database();
