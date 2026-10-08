/* SAMASSA TECHNOLOGIE — Authentification serveur + repli hors ligne */
'use strict';

const Auth = {
  SESSION_KEY: '_samassa_session',
  HASH_KEY: '_samassa_pwd_hash',
  SESSION_HOURS: 8,
  lastError: '',

  isConfigured() { return Boolean(localStorage.getItem(this.HASH_KEY)); },
  async setup(password) {
    if (!password || password.length < 8) return { ok: false, msg: 'Le mot de passe doit contenir au moins 8 caractères.' };
    localStorage.setItem(this.HASH_KEY, await this._hash(password));
    return { ok: true, msg: 'Mot de passe local configuré.' };
  },

  async login(password) {
    this.lastError = '';
    try {
      const response = await fetch('/api/auth', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) });
      if (response.ok) {
        localStorage.setItem(this.SESSION_KEY, JSON.stringify({ expires: Date.now() + this.SESSION_HOURS * 3600000, server: true }));
        return true;
      }
      const data = await response.json().catch(() => ({}));
      if (response.status !== 503) { this.lastError = data.error || 'Mot de passe incorrect.'; return false; }
    } catch { this.lastError = 'Serveur indisponible.'; }

    // Repli local uniquement si le serveur d’authentification n’est pas encore configuré.
    if (this.isConfigured()) {
      const stored = localStorage.getItem(this.HASH_KEY);
      if (stored && await this._secureEqual(await this._hash(password), stored)) {
        localStorage.setItem(this.SESSION_KEY, JSON.stringify({ expires: Date.now() + this.SESSION_HOURS * 3600000, local: true }));
        return true;
      }
    }
    if (!this.lastError) this.lastError = 'Authentification serveur non configurée. Ajoutez les variables Vercel requises.';
    return false;
  },

  async check() {
    if (window.location.pathname.endsWith('login.html')) return;
    if (this._sessionValid()) return;
    try {
      const response = await fetch('/api/auth', { credentials: 'include' });
      if (response.ok) {
        localStorage.setItem(this.SESSION_KEY, JSON.stringify({ expires: Date.now() + this.SESSION_HOURS * 3600000, server: true }));
        return;
      }
    } catch {}
    localStorage.setItem('_samassa_login_target', window.location.href);
    window.location.replace('login.html');
  },

  async logout() {
    try { await fetch('/api/auth', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'logout' }) }); } catch {}
    localStorage.removeItem(this.SESSION_KEY);
    window.location.replace('login.html');
  },

  async changePassword(oldPwd, newPwd) {
    // Le changement partagé doit être réalisé côté Vercel, jamais dans localStorage.
    return { ok: false, msg: 'Le mot de passe partagé se modifie dans les variables Vercel (SAMASSA_LOGIN_PASSWORD).' };
  },

  _sessionValid() {
    try { const s = JSON.parse(localStorage.getItem(this.SESSION_KEY)); return Boolean(s && Number(s.expires) > Date.now()); } catch { return false; }
  },
  async _hash(value) {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(value)));
    return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
  },
  async _secureEqual(a, b) {
    if (a.length !== b.length) return false; let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return diff === 0;
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
