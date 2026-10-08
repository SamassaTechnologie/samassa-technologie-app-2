/* ============================================================
   SAMASSA TECHNOLOGIE — auth.js v2.0
   Protection locale durcie pour le mode hors ligne.
   Pour une sécurité multi-utilisateur complète, utiliser l'authentification serveur.
============================================================ */
'use strict';

const Auth = {
  SESSION_KEY: '_samassa_session',
  HASH_KEY: '_samassa_pwd_hash',
  SESSION_HOURS: 8,

  isConfigured() {
    return Boolean(localStorage.getItem(this.HASH_KEY));
  },

  async setup(password) {
    if (!password || password.length < 8) {
      return { ok: false, msg: 'Le mot de passe doit contenir au moins 8 caractères.' };
    }
    localStorage.setItem(this.HASH_KEY, await this._hash(password));
    return { ok: true, msg: 'Mot de passe initial configuré.' };
  },

  check() {
    if (window.location.pathname.endsWith('login.html')) return;
    if (!this.isConfigured() || !this._sessionValid()) {
      localStorage.setItem('_samassa_login_target', window.location.href);
      window.location.replace('login.html');
    }
  },

  async login(password) {
    const stored = localStorage.getItem(this.HASH_KEY);
    if (!stored || !(await this._secureEqual(await this._hash(password), stored))) return false;
    const expires = Date.now() + this.SESSION_HOURS * 3600000;
    localStorage.setItem(this.SESSION_KEY, JSON.stringify({ expires }));
    return true;
  },

  logout() {
    localStorage.removeItem(this.SESSION_KEY);
    window.location.replace('login.html');
  },

  async changePassword(oldPwd, newPwd) {
    const stored = localStorage.getItem(this.HASH_KEY);
    if (!stored || !(await this._secureEqual(await this._hash(oldPwd), stored))) {
      return { ok: false, msg: 'Mot de passe actuel incorrect.' };
    }
    if (!newPwd || newPwd.length < 8) {
      return { ok: false, msg: 'Le nouveau mot de passe doit faire au moins 8 caractères.' };
    }
    localStorage.setItem(this.HASH_KEY, await this._hash(newPwd));
    return { ok: true, msg: 'Mot de passe modifié avec succès.' };
  },

  _sessionValid() {
    try {
      const s = JSON.parse(localStorage.getItem(this.SESSION_KEY));
      return Boolean(s && Number(s.expires) > Date.now());
    } catch { return false; }
  },

  async _hash(value) {
    const data = new TextEncoder().encode(String(value));
    const digest = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
  },

  async _secureEqual(a, b) {
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return diff === 0;
  },

  addLogoutButton() {
    const topbar = document.querySelector('.topbar');
    if (!topbar || document.getElementById('logout-btn')) return;
    const btn = document.createElement('button');
    btn.id = 'logout-btn';
    btn.style.cssText = 'background:rgba(220,38,38,.15);border:1px solid rgba(220,38,38,.3);color:#FCA5A5;padding:6px 12px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;white-space:nowrap;flex-shrink:0;transition:all .2s';
    btn.textContent = '🔒 Déco.';
    btn.onclick = () => { if (confirm('Voulez-vous vous déconnecter ?')) Auth.logout(); };
    topbar.appendChild(btn);
  }
};

Auth.check();
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => Auth.addLogoutButton());
} else {
  Auth.addLogoutButton();
}
