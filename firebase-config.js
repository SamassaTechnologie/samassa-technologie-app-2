// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDzFAcugyNIo51JLb2dGuQgPcJ5ggMRTC0",
  authDomain: "samassa-kayes.firebaseapp.com",
  databaseURL: "https://samassa-kayes-default-rtdb.firebaseio.com",
  projectId: "samassa-kayes",
  storageBucket: "samassa-kayes.firebasestorage.app",
  messagingSenderId: "213594348320",
  appId: "1:213594348320:web:dddfaba34e14ada7a51545",
  measurementId: "G-XK2Y7M2RGV"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
