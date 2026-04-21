/* ============================================================
   SAMASSA TECHNOLOGIE — firebase-config.js
   
   ⚙️  CONFIGURATION FIREBASE — À REMPLIR UNE SEULE FOIS
   
   Étapes pour obtenir vos identifiants :
   1. Allez sur https://console.firebase.google.com
   2. Cliquez "Ajouter un projet" → donnez un nom (ex: samassa-pro)
   3. Dans le projet, allez dans "Configuration" (⚙️ > Paramètres)
   4. Descendez jusqu'à "Vos applications" → cliquez l'icône Web (</>)
   5. Copiez les valeurs ci-dessous et remplacez les "VOTRE_XXX"
   6. Dans "Realtime Database", activez la base et copiez l'URL
   7. Dans les règles (Rules), mettez : 
      { "rules": { ".read": true, ".write": true } }
      (Pour plus de sécurité, ajoutez une authentification plus tard)
============================================================ */

const FIREBASE_CONFIG = {
  apiKey:            "VOTRE_API_KEY",
  authDomain:        "VOTRE_PROJECT.firebaseapp.com",
  databaseURL:       "https://VOTRE_PROJECT-default-rtdb.firebaseio.com",
  projectId:         "VOTRE_PROJECT_ID",
  storageBucket:     "VOTRE_PROJECT.appspot.com",
  messagingSenderId: "VOTRE_SENDER_ID",
  appId:             "VOTRE_APP_ID"
};

/* Identifiant unique de votre point de vente
   (permet d'avoir plusieurs appareils sur le même compte) */
const SAMASSA_STORE_ID = "kayes-principal";

/* Activer/désactiver la sync Firebase
   false = uniquement localStorage (mode hors-ligne total) */
const FIREBASE_ENABLED = true;
