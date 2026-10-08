/* SAMASSA TECHNOLOGIE — Firebase Authentication */
'use strict';

const Auth = {
  lastError: '',
  _readyPromise: null,
  auth: null,
  config: window.SAMASSA_FIREBASE_CONFIG || {
    apiKey: 'AIzaSyDxRqnmRraoF4JpHLPAwEmMbLw9qRb2h58',
    authDomain: 'samassa-kayes-79fbb.firebaseapp.com',
    projectId: 'samassa-kayes-79fbb',
    storageBucket: 'samassa-kayes-79fbb.firebasestorage.app',
    messagingSenderId: '704230186166',
    appId: '1:704230186166:web:041b7d413d1671178e5a17'
  },

  async ready() {
    if (this._readyPromise) return this._readyPromise;
    this._readyPromise = (async () => {
      await this._loadScript('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
      await this._loadScript('https://www.gstatic.com/firebasejs/9.23.0/firebase-auth-compat.js');
      if (!firebase.apps.length) firebase.initializeApp(this.config);
      this.auth = firebase.auth();
      await this.auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
      return this.auth;
    })();
    return this._readyPromise;
  },

  _loadScript(src) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) return resolve();
      const script = document.createElement('script');
      script.src = src; script.onload = resolve; script.onerror = () => reject(new Error('Firebase indisponible'));
      document.head.appendChild(script);
    });
  },

  async login(email, password) {
    this.lastError = '';
    try {
      const auth = await this.ready();
      await auth.signInWithEmailAndPassword(String(email).trim(), password);
      return true;
    } catch (error) {
      this.lastError = this._message(error);
      return false;
    }
  },

  async check() {
    if (window.location.pathname.endsWith('login.html')) return;
    try {
      const auth = await this.ready();
      await new Promise((resolve, reject) => {
        const unsubscribe = auth.onAuthStateChanged(user => { unsubscribe(); user ? resolve(user) : reject(new Error('not-authenticated')); });
      });
    } catch {
      localStorage.setItem('_samassa_login_target', window.location.href);
      window.location.replace('login.html');
    }
  },

  async logout() {
    try { const auth = await this.ready(); await auth.signOut(); } catch {}
    window.location.replace('login.html');
  },

  async changePassword(oldPwd, newPwd) {
    try {
      const auth = await this.ready();
      const user = auth.currentUser;
      if (!user || !user.email) return { ok: false, msg: 'Session Firebase introuvable.' };
      if (!newPwd || newPwd.length < 8) return { ok: false, msg: 'Le nouveau mot de passe doit faire au moins 8 caractères.' };
      const credential = firebase.auth.EmailAuthProvider.credential(user.email, oldPwd);
      await user.reauthenticateWithCredential(credential);
      await user.updatePassword(newPwd);
      return { ok: true, msg: 'Mot de passe Firebase modifié avec succès.' };
    } catch (error) { return { ok: false, msg: this._message(error) }; }
  },

  currentUser() { return this.auth?.currentUser || null; },

  _message(error) {
    const code = error?.code || '';
    const messages = {
      'auth/invalid-credential': 'Email ou mot de passe incorrect.',
      'auth/wrong-password': 'Email ou mot de passe incorrect.',
      'auth/user-not-found': 'Aucun compte administrateur trouvé avec cet email.',
      'auth/invalid-email': 'Adresse email invalide.',
      'auth/too-many-requests': 'Trop de tentatives. Réessayez plus tard.',
      'auth/network-request-failed': 'Connexion réseau impossible.',
      'auth/requires-recent-login': 'Reconnectez-vous avant de changer le mot de passe.'
    };
    return messages[code] || error?.message || 'Erreur d’authentification Firebase.';
  },

  addLogoutButton() {
    const topbar = document.querySelector('.topbar');
    if (!topbar || document.getElementById('logout-btn')) return;
    const btn = document.createElement('button'); btn.id = 'logout-btn'; btn.textContent = '🔒 Déco.';
    btn.style.cssText = 'background:rgba(220,38,38,.15);border:1px solid rgba(220,38,38,.3);color:#FCA5A5;padding:6px 12px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;white-space:nowrap;flex-shrink:0';
    btn.onclick = () => { if (confirm('Voulez-vous vous déconnecter ?')) Auth.logout(); }; topbar.appendChild(btn);
  }
};

Auth.check();
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => Auth.addLogoutButton());
else Auth.addLogoutButton();
