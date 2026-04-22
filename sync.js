/* ============================================================
   SAMASSA TECHNOLOGIE — sync.js v2.0
   
   CORRECTION MAJEURE : Interception de localStorage.setItem
   → Toutes les écritures (saveDoc, intervention, etc.)
     déclenchent automatiquement la sync Firebase,
     sans modifier les autres fichiers.
   ============================================================ */
'use strict';

/* ── Clés à synchroniser ── */
const SYNC_KEYS = [
  'samassa_recus',
  'samassa_factures',
  'samassa_devis',
  'samassa_interventions',
  'samassa_mouvements',
  'samassa_recus_cyber',
  'samassa_factures_cyber'
];

/* ════════════════════════════════════════════════════════════
   MOTEUR DE SYNC
════════════════════════════════════════════════════════════ */
const SyncEngine = {
  db:      null,
  ready:   false,
  online:  navigator.onLine,

  /* ── 1. Démarrage ── */
  async init() {
    this._updateStatus('init');

    if (typeof FIREBASE_CONFIG === 'undefined' || !FIREBASE_ENABLED) {
      this._updateStatus('offline');
      return;
    }
    if (FIREBASE_CONFIG.apiKey === 'VOTRE_API_KEY') {
      this._updateStatus('not-configured');
      this._showSetupBanner();
      return;
    }

    try {
      await this._loadSDK();
      /* Pull initial : charger les données depuis Firebase */
      this._updateStatus('syncing');
      await this._pullAll();
      /* Push local vers Firebase (données déjà en local) */
      await this._pushAll();
      this._updateStatus('synced');
      this.ready = true;
      /* Écoute temps réel */
      this._listenAll();
    } catch (e) {
      console.error('[Sync]', e.message);
      this._updateStatus('error');
    }

    window.addEventListener('online',  () => { this.online = true;  this._updateStatus('syncing'); this._pushAll().then(() => this._updateStatus('synced')); });
    window.addEventListener('offline', () => { this.online = false; this._updateStatus('offline'); });
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && this.ready) this._pullAll();
    });
  },

  /* ── 2. Charger Firebase SDK ── */
  _loadSDK() {
    return new Promise((resolve, reject) => {
      if (window.firebase?.database) { this._initDB(); resolve(); return; }
      const load = (src, cb) => {
        const s = document.createElement('script');
        s.src = src; s.onload = cb; s.onerror = reject;
        document.head.appendChild(s);
      };
      load('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js', () => {
        load('https://www.gstatic.com/firebasejs/9.23.0/firebase-database-compat.js', () => {
          this._initDB(); resolve();
        });
      });
    });
  },

  _initDB() {
    if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
    this.db = firebase.database();
  },

  /* ── 3. PUSH une clé vers Firebase ── */
  async _pushKey(key) {
    if (!this.db || !this.online) return;
    const val = localStorage.getItem(key) || '[]';
    try {
      await this.db.ref(`${SAMASSA_STORE_ID}/${key}`).set({
        data:      val,
        updatedAt: Date.now(),
        device:    this._deviceId()
      });
    } catch (e) {
      console.warn('[Sync] push échoué:', key, e.message);
    }
  },

  /* ── 4. PUSH tout ── */
  async _pushAll() {
    await Promise.allSettled(SYNC_KEYS.map(k => this._pushKey(k)));
  },

  /* ── 5. PULL une clé depuis Firebase ── */
  async _pullKey(key) {
    if (!this.db) return false;
    try {
      const snap = await this.db.ref(`${SAMASSA_STORE_ID}/${key}`).get();
      if (!snap.exists()) return false;
      const remote = snap.val();
      const localTs = parseInt(localStorage.getItem(`_ts_${key}`) || '0');
      if (remote.updatedAt > localTs) {
        /* Désactiver l'intercepteur pendant l'écriture distante */
        this._skipNext = true;
        localStorage.setItem(key, remote.data || '[]');
        localStorage.setItem(`_ts_${key}`, String(remote.updatedAt));
        this._skipNext = false;
        return true; /* données mises à jour */
      }
    } catch (e) {
      console.warn('[Sync] pull échoué:', key, e.message);
    }
    return false;
  },

  /* ── 6. PULL tout + rafraîchir UI si changements ── */
  async _pullAll() {
    const results = await Promise.allSettled(SYNC_KEYS.map(k => this._pullKey(k)));
    const anyNew = results.some(r => r.value === true);
    if (anyNew) {
      document.dispatchEvent(new CustomEvent('samassa:sync', { detail: { all: true } }));
    }
  },

  /* ── 7. Écoute en temps réel (autres appareils) ── */
  _listenAll() {
    if (!this.db) return;
    SYNC_KEYS.forEach(key => {
      this.db.ref(`${SAMASSA_STORE_ID}/${key}`).on('value', snap => {
        if (!snap.exists()) return;
        const remote = snap.val();
        if (remote.device === this._deviceId()) return; /* propre écriture */
        const localTs = parseInt(localStorage.getItem(`_ts_${key}`) || '0');
        if (remote.updatedAt > localTs) {
          this._skipNext = true;
          localStorage.setItem(key, remote.data || '[]');
          localStorage.setItem(`_ts_${key}`, String(remote.updatedAt));
          this._skipNext = false;
          document.dispatchEvent(new CustomEvent('samassa:sync', { detail: { key } }));
          this._updateStatus('synced');
          if (typeof ST !== 'undefined') ST.toast('🔄 Données mises à jour (autre appareil)', 'info');
        }
      });
    });
  },

  /* ── 8. INTERCEPTION localStorage.setItem ← CŒUR DE LA CORRECTION ── */
  _interceptLocalStorage() {
    const engine  = this;
    const _orig   = localStorage.setItem.bind(localStorage);

    localStorage.setItem = function(key, value) {
      /* Toujours écrire en local en premier */
      _orig(key, value);

      /* Si c'est une clé à synchroniser et qu'on n'est pas en train de pull */
      if (!engine._skipNext && SYNC_KEYS.includes(key)) {
        /* Mettre à jour le timestamp local */
        const now = Date.now();
        _orig(`_ts_${key}`, String(now));

        /* Push vers Firebase en arrière-plan */
        if (engine.ready && engine.online) {
          engine._updateStatus('syncing');
          engine._pushKey(key)
            .then(() => engine._updateStatus('synced'))
            .catch(() => engine._updateStatus('error'));
        }
      }
    };
  },

  /* ── Identifiant appareil ── */
  _deviceId() {
    let id = localStorage.getItem('_samassa_device_id');
    if (!id) { id = 'dev-' + Math.random().toString(36).substr(2,9); localStorage.setItem('_samassa_device_id', id); }
    return id;
  },

  /* ── Indicateur visuel ── */
  _updateStatus(state) {
    const map = {
      'init':           ['☁', 'Connexion...',   '#D97706'],
      'syncing':        ['☁', 'Sync...',         '#D97706'],
      'synced':         ['☁', 'Synchronisé',     '#16A34A'],
      'offline':        ['☁', 'Hors-ligne',      '#8099B0'],
      'error':          ['☁', 'Erreur sync',     '#DC2626'],
      'not-configured': ['⚙', 'Non configuré',   '#D97706']
    };
    const [icon, text, dotColor] = map[state] || map['offline'];
    document.querySelectorAll('.sync-indicator, #cloud-status').forEach(el => {
      el.textContent = icon + ' ' + text;
      el.className = (el.className||'').replace(/sync-\w+/g,'') + ' sync-indicator sync-' + (state==='synced'?'ok':state==='syncing'?'syncing':state==='error'?'error':state==='not-configured'?'warn':'offline');
    });
    const dot = document.getElementById('sync-dot');
    if (dot) dot.style.background = dotColor;
  },

  /* ── Bannière si non configuré ── */
  _showSetupBanner() {
    if (document.getElementById('fb-banner')) return;
    const b = document.createElement('div');
    b.id = 'fb-banner';
    b.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:9999;background:#1E1B4B;color:white;padding:11px 18px;display:flex;align-items:center;gap:12px;flex-wrap:wrap;font-family:Segoe UI,sans-serif;font-size:13px;box-shadow:0 -4px 20px rgba(0,0,0,.3)';
    b.innerHTML = `<span>⚙️</span><div style="flex:1"><strong>Sync non configurée</strong> — <span style="opacity:.8">Éditez firebase-config.js</span></div><a href="setup-firebase.html" style="background:#4338CA;color:white;padding:7px 14px;border-radius:8px;text-decoration:none;font-weight:700;font-size:12px">📋 Guide de configuration</a><button onclick="this.parentElement.remove()" style="background:rgba(255,255,255,.15);border:none;color:white;width:26px;height:26px;border-radius:50%;cursor:pointer">✕</button>`;
    document.body.appendChild(b);
  }
};

/* ════════════════════════════════════════════════════════════
   STYLES
════════════════════════════════════════════════════════════ */
(function() {
  const s = document.createElement('style');
  s.textContent = `
.sync-indicator{display:inline-flex;align-items:center;gap:5px;font-size:11px;padding:4px 10px;border-radius:20px;font-family:'Segoe UI',sans-serif;font-weight:600;transition:all .3s}
.sync-ok{background:rgba(22,163,74,.18);color:#16A34A;border:1px solid rgba(22,163,74,.3)}
.sync-syncing{background:rgba(217,119,6,.15);color:#D97706;border:1px solid rgba(217,119,6,.3);animation:sp 1s infinite}
.sync-offline{background:rgba(128,153,176,.12);color:#8099B0;border:1px solid rgba(128,153,176,.25)}
.sync-error{background:rgba(220,38,38,.12);color:#DC2626;border:1px solid rgba(220,38,38,.3)}
.sync-warn{background:rgba(217,119,6,.12);color:#D97706;border:1px solid rgba(217,119,6,.25)}
@keyframes sp{0%,100%{opacity:1}50%{opacity:.4}}`;
  document.head.appendChild(s);
})();

/* ════════════════════════════════════════════════════════════
   DÉMARRAGE — s'exécute dès que le script est chargé
════════════════════════════════════════════════════════════ */

/* ÉTAPE 1 : Mettre en place l'intercepteur IMMÉDIATEMENT
   (avant même que les autres scripts soient chargés) */
SyncEngine._skipNext = false;
SyncEngine._interceptLocalStorage();

/* ÉTAPE 2 : Démarrer Firebase après chargement DOM */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => SyncEngine.init());
} else {
  SyncEngine.init();
}
