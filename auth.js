/* ============================================================
   SAMASSA TECHNOLOGIE — auth.js v1.0
   Système de protection par mot de passe
============================================================ */
'use strict';

const Auth = {
  SESSION_KEY:   '_samassa_session',
  HASH_KEY:      '_samassa_pwd_hash',
  SESSION_HOURS: 8,
  DEFAULT_PASSWORD: 'samassa2025',

  check() {
    if (window.location.pathname.endsWith('login.html')) return;
    if (!localStorage.getItem(this.HASH_KEY)) {
      localStorage.setItem(this.HASH_KEY, this._hash(this.DEFAULT_PASSWORD));
    }
    if (!this._sessionValid()) {
      localStorage.setItem('_samassa_login_target', window.location.href);
      window.location.replace('login.html');
    }
  },

  login(password) {
    const stored = localStorage.getItem(this.HASH_KEY) || this._hash(this.DEFAULT_PASSWORD);
    if (this._hash(password) === stored) {
      const expires = Date.now() + this.SESSION_HOURS * 3600000;
      localStorage.setItem(this.SESSION_KEY, JSON.stringify({ expires }));
      return true;
    }
    return false;
  },

  logout() {
    localStorage.removeItem(this.SESSION_KEY);
    window.location.replace('login.html');
  },

  changePassword(oldPwd, newPwd) {
    const stored = localStorage.getItem(this.HASH_KEY) || this._hash(this.DEFAULT_PASSWORD);
    if (this._hash(oldPwd) !== stored) return { ok:false, msg:'Mot de passe actuel incorrect.' };
    if (!newPwd || newPwd.length < 4) return { ok:false, msg:'Le nouveau mot de passe doit faire au moins 4 caractères.' };
    localStorage.setItem(this.HASH_KEY, this._hash(newPwd));
    return { ok:true, msg:'Mot de passe modifié avec succès ✓' };
  },

  _sessionValid() {
    try {
      const s = JSON.parse(localStorage.getItem(this.SESSION_KEY));
      return s && s.expires > Date.now();
    } catch { return false; }
  },

  _hash(str) {
    let h = 5381;
    for (let i = 0; i < str.length; i++) {
      h = ((h << 5) + h) ^ str.charCodeAt(i);
      h = h >>> 0;
    }
    return 'h' + h.toString(16).padStart(8, '0');
  },

  addLogoutButton() {
    const topbar = document.querySelector('.topbar');
    if (!topbar || document.getElementById('logout-btn')) return;
    const btn = document.createElement('button');
    btn.id = 'logout-btn';
    btn.style.cssText = 'background:rgba(220,38,38,.15);border:1px solid rgba(220,38,38,.3);color:#FCA5A5;padding:6px 12px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;white-space:nowrap;flex-shrink:0;transition:all .2s';
    btn.textContent = '🔒 Déco.';
    btn.onmouseenter = () => { btn.style.background='rgba(220,38,38,.35)'; btn.style.color='white'; };
    btn.onmouseleave = () => { btn.style.background='rgba(220,38,38,.15)'; btn.style.color='#FCA5A5'; };
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
