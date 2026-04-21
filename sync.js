/* ============================================================
   SAMASSA TECHNOLOGIE — sync.js v1.0
   Moteur de synchronisation Firebase + localStorage
   
   Fonctionnement :
   • Sauvegarde IMMÉDIATE dans localStorage (0 ms de latence)
   • Synchronisation en ARRIÈRE-PLAN vers Firebase
   • Chargement depuis Firebase au démarrage (nouveaux appareils)
   • Mode hors-ligne complet si pas de connexion
   • Indicateur visuel de l'état de synchronisation
   ============================================================ */
'use strict';

/* ══════════════════════════════════════════════════════════
   CLÉS À SYNCHRONISER
══════════════════════════════════════════════════════════ */
const SYNC_KEYS = [
  'samassa_recus',
  'samassa_factures',
  'samassa_devis',
  'samassa_interventions',
  'samassa_mouvements',
  'samassa_recus_cyber',
  'samassa_factures_cyber'
];

/* ══════════════════════════════════════════════════════════
   ÉTAT INTERNE
══════════════════════════════════════════════════════════ */
const SyncEngine = {
  db:           null,
  ready:        false,
  online:       navigator.onLine,
  pendingSync:  false,
  _listeners:   {},

  /* ─── Initialisation ─── */
  async init() {
    this._updateStatus('init');

    /* Vérifier la config */
    if (typeof FIREBASE_CONFIG === 'undefined' || !FIREBASE_ENABLED) {
      console.log('[Sync] Firebase désactivé — mode localStorage uniquement');
      this._updateStatus('offline');
      return;
    }

    if (FIREBASE_CONFIG.apiKey === 'VOTRE_API_KEY') {
      console.warn('[Sync] Firebase non configuré — éditez firebase-config.js');
      this._updateStatus('not-configured');
      this._showSetupBanner();
      return;
    }

    /* Charger Firebase SDK depuis CDN */
    try {
      await this._loadFirebase();
      this._updateStatus('syncing');
      /* Pull initial depuis le cloud */
      await this._pullAll();
      this._updateStatus('synced');
      this.ready = true;
      /* Écouter les changements distants en temps réel */
      this._listenAll();
    } catch (err) {
      console.error('[Sync] Erreur Firebase :', err);
      this._updateStatus('error');
    }

    /* Resync quand on revient en ligne */
    window.addEventListener('online',  () => { this.online = true;  this._pushAll(); this._updateStatus('synced'); });
    window.addEventListener('offline', () => { this.online = false; this._updateStatus('offline'); });
    /* Resync quand on revient sur l'onglet/l'app */
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && this.ready) this._pullAll().then(() => this._updateStatus('synced'));
    });
  },

  /* ─── Charger le SDK Firebase (Compat v9) depuis CDN ─── */
  _loadFirebase() {
    return new Promise((resolve, reject) => {
      if (window.firebase) { this._initDB(); resolve(); return; }
      const script = document.createElement('script');
      script.src = 'https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js';
      script.onload = () => {
        const script2 = document.createElement('script');
        script2.src = 'https://www.gstatic.com/firebasejs/9.23.0/firebase-database-compat.js';
        script2.onload = () => { this._initDB(); resolve(); };
        script2.onerror = reject;
        document.head.appendChild(script2);
      };
      script.onerror = reject;
      document.head.appendChild(script);
    });
  },

  _initDB() {
    if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
    this.db = firebase.database();
  },

  /* ─── Chemin Firebase pour une clé ─── */
  _path(key) {
    return `${SAMASSA_STORE_ID}/${key}`;
  },

  /* ─── PUSH : envoyer une clé vers Firebase ─── */
  async _pushKey(key) {
    if (!this.db || !this.online) return;
    try {
      const data = localStorage.getItem(key);
      const payload = {
        data:      data || '[]',
        updatedAt: Date.now(),
        device:    this._deviceId()
      };
      await this.db.ref(this._path(key)).set(payload);
    } catch (e) {
      console.warn('[Sync] Push échoué pour', key, e.message);
    }
  },

  /* ─── PUSH ALL : tout envoyer ─── */
  async _pushAll() {
    if (!this.db) return;
    this._updateStatus('syncing');
    const tasks = SYNC_KEYS.map(k => this._pushKey(k));
    await Promise.allSettled(tasks);
    this._updateStatus('synced');
  },

  /* ─── PULL : recevoir une clé depuis Firebase ─── */
  async _pullKey(key) {
    if (!this.db) return;
    try {
      const snap = await this.db.ref(this._path(key)).get();
      if (!snap.exists()) return;
      const remote = snap.val();
      /* Comparaison : garder le plus récent */
      const localMeta = this._getMeta(key);
      if (!localMeta || remote.updatedAt > localMeta.updatedAt) {
        localStorage.setItem(key, remote.data || '[]');
        this._setMeta(key, remote.updatedAt);
      }
    } catch (e) {
      console.warn('[Sync] Pull échoué pour', key, e.message);
    }
  },

  /* ─── PULL ALL ─── */
  async _pullAll() {
    if (!this.db) return;
    const tasks = SYNC_KEYS.map(k => this._pullKey(k));
    await Promise.allSettled(tasks);
  },

  /* ─── ÉCOUTE TEMPS RÉEL : mise à jour automatique ─── */
  _listenAll() {
    if (!this.db) return;
    SYNC_KEYS.forEach(key => {
      const ref = this.db.ref(this._path(key));
      ref.on('value', snap => {
        if (!snap.exists()) return;
        const remote = snap.val();
        const localMeta = this._getMeta(key);
        /* Ne pas appliquer sa propre mise à jour */
        if (remote.device === this._deviceId()) return;
        if (!localMeta || remote.updatedAt > localMeta.updatedAt) {
          localStorage.setItem(key, remote.data || '[]');
          this._setMeta(key, remote.updatedAt);
          this._notifyUpdate(key);
        }
      });
    });
  },

  /* ─── Notifier les pages d'une mise à jour distante ─── */
  _notifyUpdate(key) {
    document.dispatchEvent(new CustomEvent('samassa:sync', { detail: { key } }));
    /* Afficher une notification discrète */
    const msg = '🔄 Données mises à jour depuis un autre appareil';
    if (typeof ST !== 'undefined') ST.toast(msg, 'info');
  },

  /* ─── API publique : sauvegarder une clé ─── */
  saveKey(key, data) {
    /* 1. localStorage immédiat */
    localStorage.setItem(key, JSON.stringify(data));
    this._setMeta(key, Date.now());
    /* 2. Firebase en arrière-plan (non-bloquant) */
    if (this.ready && this.online) {
      this._pushKey(key).then(() => this._updateStatus('synced'));
      this._updateStatus('syncing');
    }
  },

  /* ─── Lire une clé ─── */
  getKey(key) {
    try {
      return JSON.parse(localStorage.getItem(key) || '[]');
    } catch {
      return [];
    }
  },

  /* ─── Métadonnées de sync (timestamp) ─── */
  _getMeta(key) {
    try { return JSON.parse(localStorage.getItem('_sync_meta_' + key)); } catch { return null; }
  },
  _setMeta(key, ts) {
    localStorage.setItem('_sync_meta_' + key, JSON.stringify({ updatedAt: ts }));
  },

  /* ─── ID unique de l'appareil ─── */
  _deviceId() {
    let id = localStorage.getItem('_samassa_device_id');
    if (!id) {
      id = 'dev-' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('_samassa_device_id', id);
    }
    return id;
  },

  /* ─── Indicateur visuel ─── */
  _updateStatus(state) {
    const indicators = document.querySelectorAll('.sync-indicator');
    const configs = {
      'init':           { icon: '☁', text: 'Connexion...', cls: 'sync-init',    dot: '#D97706' },
      'syncing':        { icon: '☁', text: 'Sync...',      cls: 'sync-syncing', dot: '#D97706' },
      'synced':         { icon: '☁', text: 'Synchronisé',  cls: 'sync-ok',      dot: '#16A34A' },
      'offline':        { icon: '☁', text: 'Hors-ligne',   cls: 'sync-offline', dot: '#8099B0' },
      'error':          { icon: '☁', text: 'Erreur sync',  cls: 'sync-error',   dot: '#DC2626' },
      'not-configured': { icon: '⚙', text: 'Non configuré',cls: 'sync-warn',    dot: '#D97706' }
    };
    const cfg = configs[state] || configs['offline'];
    indicators.forEach(el => {
      el.textContent = cfg.icon + ' ' + cfg.text;
      el.className   = 'sync-indicator ' + cfg.cls;
    });
    /* Dot dans la sidebar (index.html) */
    const dot = document.getElementById('sync-dot');
    if (dot) dot.style.background = cfg.dot;
    /* Badge cloud dans topbar */
    const badge = document.getElementById('cloud-status');
    if (badge) {
      badge.textContent = cfg.icon + ' ' + cfg.text;
    }
  },

  /* ─── Bannière de configuration ─── */
  _showSetupBanner() {
    const existing = document.getElementById('firebase-setup-banner');
    if (existing) return;
    const banner = document.createElement('div');
    banner.id = 'firebase-setup-banner';
    banner.style.cssText = `
      position:fixed;bottom:0;left:0;right:0;z-index:9998;
      background:#1E1B4B;color:white;padding:12px 20px;
      display:flex;align-items:center;gap:14px;flex-wrap:wrap;
      font-family:'Segoe UI',sans-serif;font-size:13px;
      box-shadow:0 -4px 20px rgba(0,0,0,.3);
    `;
    banner.innerHTML = `
      <span style="font-size:20px">⚙️</span>
      <div style="flex:1;min-width:200px">
        <strong>Synchronisation cloud non configurée</strong><br>
        <span style="opacity:.8;font-size:12px">Éditez <code style="background:rgba(255,255,255,.15);padding:1px 6px;border-radius:4px">firebase-config.js</code> pour activer la sync multi-appareils</span>
      </div>
      <a href="https://console.firebase.google.com" target="_blank"
         style="background:#4338CA;color:white;padding:8px 16px;border-radius:8px;text-decoration:none;font-weight:700;font-size:12px;white-space:nowrap">
        🔗 Créer un projet Firebase
      </a>
      <button onclick="document.getElementById('firebase-setup-banner').remove()"
              style="background:rgba(255,255,255,.15);border:none;color:white;width:28px;height:28px;border-radius:50%;cursor:pointer;font-size:16px;flex-shrink:0">
        ✕
      </button>`;
    document.body.appendChild(banner);
  }
};

/* ══════════════════════════════════════════════════════════
   EXTENSION DE ST : remplacer les méthodes de stockage
══════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  /* Patch ST.save pour utiliser SyncEngine */
  if (typeof ST !== 'undefined') {
    const _originalSave = ST.save.bind(ST);
    ST.save = function(key, record) {
      const list = SyncEngine.getKey(key);
      list.push({ ...record, timestamp: new Date().toISOString() });
      SyncEngine.saveKey(key, list);
      ST.toast('Document enregistré ✓', 'success');
    };
  }

  /* Démarrer le moteur de sync */
  SyncEngine.init();
});

/* ══════════════════════════════════════════════════════════
   STYLES CSS pour l'indicateur de sync
══════════════════════════════════════════════════════════ */
const syncStyle = document.createElement('style');
syncStyle.textContent = `
.sync-indicator {
  display:inline-flex;align-items:center;gap:5px;
  font-size:11px;padding:4px 10px;border-radius:20px;
  font-family:'Segoe UI',sans-serif;font-weight:600;
  transition:all .3s;
}
.sync-ok      { background:rgba(22,163,74,.15); color:#16A34A; border:1px solid rgba(22,163,74,.25); }
.sync-syncing { background:rgba(217,119,6,.15);  color:#D97706; border:1px solid rgba(217,119,6,.25); animation:syncPulse 1s infinite; }
.sync-offline { background:rgba(128,153,176,.15);color:#8099B0; border:1px solid rgba(128,153,176,.25); }
.sync-error   { background:rgba(220,38,38,.15);  color:#DC2626; border:1px solid rgba(220,38,38,.25); }
.sync-warn    { background:rgba(217,119,6,.15);  color:#D97706; border:1px solid rgba(217,119,6,.25); }
.sync-init    { background:rgba(0,136,204,.15);  color:#0088CC; border:1px solid rgba(0,136,204,.25); }
@keyframes syncPulse { 0%,100%{opacity:1} 50%{opacity:.5} }
`;
document.head.appendChild(syncStyle);
