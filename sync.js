/* ============================================================
   SAMASSA TECHNOLOGIE — sync.js v3.0
   Synchronisation Firebase — STRATÉGIE SANS PERTE

   RÈGLE ABSOLUE :
   Les données locales ne sont JAMAIS écrasées.
   On ne fait que AJOUTER les nouveaux enregistrements
   distants qui n'existent pas encore en local.

   Identification unique par : number | id | recuNumber
============================================================ */
'use strict';

const SYNC_KEYS = [
  'samassa_recus',
  'samassa_factures',
  'samassa_devis',
  'samassa_interventions',
  'samassa_mouvements',
  'samassa_recus_cyber',
  'samassa_factures_cyber',
  'samassa_retraits'
];

const SyncEngine = {
  db:      null,
  ready:   false,
  online:  navigator.onLine,
  _block:  false,  /* bloque l'intercepteur pendant les écritures internes */
  _queue:  [],     /* file d'attente hors-ligne */

  /* ══════════════════════════════════════════
     1. INITIALISATION
  ══════════════════════════════════════════ */
  async init() {
    this._status('init');

    if (typeof FIREBASE_ENABLED === 'undefined' || !FIREBASE_ENABLED) {
      this._status('offline'); return;
    }
    if (typeof FIREBASE_CONFIG === 'undefined' ||
        FIREBASE_CONFIG.apiKey === 'VOTRE_API_KEY') {
      this._status('not-configured');
      this._banner(); return;
    }

    try {
      await this._loadSDK();
      this._status('syncing');

      /* Merge initial : récupérer les données distantes SANS écraser le local */
      await this._mergeAll();

      /* Envoyer toutes les données locales vers Firebase */
      await this._pushAll();

      this._status('synced');
      this.ready = true;

      /* Écoute temps réel */
      this._listen();

    } catch (e) {
      console.error('[Sync v3.0] init:', e.message);
      this._status('error');
      setTimeout(() => this.init(), 30000);
    }

    window.addEventListener('online', () => {
      this.online = true;
      this._flush().then(() => this._status('synced'));
    });
    window.addEventListener('offline', () => {
      this.online = false;
      this._status('offline');
    });

    /* Retour sur l'onglet → merge uniquement (jamais écraser) */
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && this.ready) {
        this._mergeAll();
        this._flush();
      }
    });
  },

  /* ══════════════════════════════════════════
     2. CHARGEMENT SDK FIREBASE
  ══════════════════════════════════════════ */
  _loadSDK() {
    return new Promise((resolve, reject) => {
      if (window.firebase?.database) { this._initDB(); resolve(); return; }
      const load = (src, cb) => {
        const s = document.createElement('script');
        s.src = src; s.onload = cb;
        s.onerror = () => reject(new Error('SDK Firebase non chargé : ' + src));
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

  /* ══════════════════════════════════════════
     3. PUSH — Envoyer local → Firebase
     (ne touche pas au contenu local)
  ══════════════════════════════════════════ */
  async _push(key) {
    if (!this.db || !this.online) {
      if (!this._queue.includes(key)) this._queue.push(key);
      return;
    }
    const data = localStorage.getItem(key) || '[]';
    try {
      await this.db.ref(`${SAMASSA_STORE_ID}/${key}`).set({
        data,
        device:    this._deviceId(),
        updatedAt: Date.now(),
        count:     this._parse(data).length
      });
    } catch (e) {
      console.warn('[Sync] push échoué:', key, e.message);
      if (!this._queue.includes(key)) this._queue.push(key);
    }
  },

  async _pushAll() {
    if (!this.online) return;
    await Promise.allSettled(SYNC_KEYS.map(k => this._push(k)));
  },

  /* ══════════════════════════════════════════
     4. FLUSH — Vider la file d'attente
  ══════════════════════════════════════════ */
  async _flush() {
    if (!this.online || !this._queue.length) return;
    this._status('syncing');
    const todo = [...this._queue];
    this._queue = [];
    await Promise.allSettled(todo.map(k => this._push(k)));
    this._status('synced');
  },

  /* ══════════════════════════════════════════
     5. MERGE — LE CŒUR DU CORRECTIF
     
     Stratégie :
     ✅ Lire les données Firebase (distantes)
     ✅ Lire les données locales
     ✅ Identifier chaque item par son ID unique
     ✅ Ajouter en local SEULEMENT ce qui est absent
     ❌ Ne JAMAIS écraser, supprimer ou remplacer
        des données locales existantes
  ══════════════════════════════════════════ */
  async _mergeKey(key) {
    if (!this.db) return false;
    try {
      const snap = await this.db.ref(`${SAMASSA_STORE_ID}/${key}`).get();
      if (!snap.exists()) return false;

      const remoteList = this._parse(snap.val().data);
      if (!remoteList.length) return false;

      const localRaw  = localStorage.getItem(key) || '[]';
      const localList = this._parse(localRaw);

      /* Index des IDs locaux existants */
      const localIds = new Set(
        localList.map(item => this._id(item))
      );

      /* Trouver les items distants absents en local */
      const newItems = remoteList.filter(
        item => !localIds.has(this._id(item))
      );

      if (!newItems.length) return false;

      /* Ajouter les nouveaux items SANS toucher aux existants */
      const merged = [...localList, ...newItems];

      this._block = true;
      localStorage.setItem(key, JSON.stringify(merged));
      this._block = false;

      console.log(`[Sync] Merge ${key}: +${newItems.length} nouveaux items`);
      return true;

    } catch (e) {
      console.warn('[Sync] merge échoué:', key, e.message);
      return false;
    }
  },

  async _mergeAll() {
    if (!this.db) return;
    const results = await Promise.allSettled(
      SYNC_KEYS.map(k => this._mergeKey(k))
    );
    const anyNew = results.some(r => r.value === true);
    if (anyNew) {
      document.dispatchEvent(
        new CustomEvent('samassa:sync', { detail: { merged: true } })
      );
    }
  },

  /* ══════════════════════════════════════════
     6. ÉCOUTE TEMPS RÉEL — Autres appareils
     Utilise aussi la stratégie MERGE
  ══════════════════════════════════════════ */
  _listen() {
    if (!this.db) return;
    SYNC_KEYS.forEach(key => {
      this.db.ref(`${SAMASSA_STORE_ID}/${key}`).on('value', snap => {
        if (!snap.exists()) return;
        const remote = snap.val();

        /* Ignorer nos propres écritures */
        if (remote.device === this._deviceId()) return;

        /* Merge avec les données distantes */
        const remoteList = this._parse(remote.data);
        const localList  = this._parse(localStorage.getItem(key) || '[]');
        const localIds   = new Set(localList.map(i => this._id(i)));
        const newItems   = remoteList.filter(i => !localIds.has(this._id(i)));

        if (!newItems.length) return;

        /* Ajouter uniquement les nouveaux */
        const merged = [...localList, ...newItems];
        this._block = true;
        localStorage.setItem(key, JSON.stringify(merged));
        this._block = false;

        console.log(`[Sync] Réception ${key}: +${newItems.length} items`);
        this._status('synced');
        document.dispatchEvent(
          new CustomEvent('samassa:sync', { detail: { key } })
        );

        /* Notification discrète */
        const msg = `🔄 ${newItems.length} nouvelle(s) donnée(s) reçue(s)`;
        const showToast = typeof toast === 'function' ? toast
          : typeof ST !== 'undefined' ? ST.toast.bind(ST)
          : null;
        if (showToast) showToast(msg, 'info');
      });
    });
  },

  /* ══════════════════════════════════════════
     7. INTERCEPTION localStorage.setItem
     → Déclenche un push à chaque sauvegarde
     → Respecte le flag _block pour éviter
       les boucles infinies
  ══════════════════════════════════════════ */
  _intercept() {
    const engine = this;
    const _orig  = localStorage.setItem.bind(localStorage);

    localStorage.setItem = function(key, value) {
      /* Écriture locale TOUJOURS en premier */
      _orig(key, value);

      /* Push Firebase si clé surveillée et pas en merge */
      if (!engine._block && SYNC_KEYS.includes(key)) {
        if (engine.ready && engine.online) {
          engine._status('syncing');
          engine._push(key)
            .then(() => engine._status('synced'))
            .catch(() => engine._status('error'));
        } else {
          /* Mémoriser pour push ultérieur */
          if (!engine._queue.includes(key)) engine._queue.push(key);
        }
      }
    };
  },

  /* ══════════════════════════════════════════
     HELPERS
  ══════════════════════════════════════════ */

  /* Identifier un item de façon unique */
  _id(item) {
    return item.number
        || item.id
        || item.recuNumber
        || (item.date + '_' + (item.desc || '') + '_' + (item.amount || ''))
        || JSON.stringify(item);
  },

  /* Parser JSON de façon sûre */
  _parse(raw) {
    try {
      const p = typeof raw === 'string' ? JSON.parse(raw) : raw;
      return Array.isArray(p) ? p : [];
    } catch { return []; }
  },

  /* ID unique de l'appareil courant */
  _deviceId() {
    let id = localStorage.getItem('_samassa_device_id');
    if (!id) {
      id = 'dev-' + Math.random().toString(36).substr(2, 9);
      const orig = localStorage._orig || localStorage.setItem;
      try { orig.call(localStorage, '_samassa_device_id', id); } catch { /* silent */ }
    }
    return id;
  },

  /* ══════════════════════════════════════════
     UI — Badge de synchronisation
  ══════════════════════════════════════════ */
  _status(state) {
    const MAP = {
      'init'          : ['☁',  'Connexion...',  '#D97706'],
      'syncing'       : ['🔄', 'Sync...',        '#D97706'],
      'synced'        : ['☁',  'Synchronisé',   '#16A34A'],
      'offline'       : ['📵', 'Hors-ligne',     '#8099B0'],
      'error'         : ['⚠',  'Erreur sync',   '#DC2626'],
      'not-configured': ['⚙',  'Non configuré', '#D97706']
    };
    const [icon, label, dot] = MAP[state] || MAP['offline'];
    const txt = icon + ' ' + label;

    document.querySelectorAll('.sync-pill, #cloud-status').forEach(el => {
      el.textContent = txt;
      el.className   = el.className
        .replace(/sync-(ok|ing|off|err|warn)/g, '').trim()
        + ' sync-pill '
        + (state==='synced'  ? 'sync-ok'
          : state==='syncing'? 'sync-ing'
          : state==='error'  ? 'sync-err'
          : 'sync-off');
    });

    const d = document.getElementById('sync-dot');
    if (d) d.style.background = dot;
  },

  /* Bannière si non configuré */
  _banner() {
    if (document.getElementById('fb-banner')) return;
    const b = document.createElement('div');
    b.id = 'fb-banner';
    b.style.cssText = [
      'position:fixed;bottom:0;left:0;right:0;z-index:9999',
      'background:#1E1B4B;color:white;padding:11px 18px',
      'display:flex;align-items:center;gap:12px;flex-wrap:wrap',
      'font-family:Segoe UI,sans-serif;font-size:13px',
      'box-shadow:0 -4px 20px rgba(0,0,0,.3)'
    ].join(';');
    b.innerHTML = `
      <span>⚙️</span>
      <div style="flex:1">
        <strong>Sync non configurée</strong> —
        <span style="opacity:.8">Éditez firebase-config.js</span>
      </div>
      <a href="setup-firebase.html"
         style="background:#4338CA;color:white;padding:7px 14px;
                border-radius:8px;text-decoration:none;font-weight:700;font-size:12px">
        📋 Guide
      </a>
      <button onclick="this.parentElement.remove()"
              style="background:rgba(255,255,255,.15);border:none;color:white;
                     width:26px;height:26px;border-radius:50%;cursor:pointer">✕</button>`;
    document.body.appendChild(b);
  }
};

/* ══════════════════════════════════════════
   STYLES DU BADGE
══════════════════════════════════════════ */
(function injectCSS() {
  const s = document.createElement('style');
  s.id = 'sync-styles';
  if (document.getElementById('sync-styles')) return;
  s.textContent = `
    .sync-pill{display:inline-flex;align-items:center;gap:4px;font-size:10px;
      padding:4px 9px;border-radius:14px;font-weight:600;transition:all .3s;white-space:nowrap}
    .sync-ok {background:rgba(22,163,74,.2);color:#86EFAC;border:1px solid rgba(22,163,74,.3)}
    .sync-ing{background:rgba(217,119,6,.2);color:#FCD34D;border:1px solid rgba(217,119,6,.3);
      animation:sp 1s infinite}
    .sync-off{background:rgba(128,153,176,.15);color:#94A3B8;border:1px solid rgba(128,153,176,.2)}
    .sync-err{background:rgba(220,38,38,.2);color:#FCA5A5;border:1px solid rgba(220,38,38,.3)}
    @keyframes sp{0%,100%{opacity:1}50%{opacity:.4}}
  `;
  document.head.appendChild(s);
})();

/* ══════════════════════════════════════════
   DÉMARRAGE
   L'intercepteur est mis en place AVANT
   l'initialisation pour ne rien manquer
══════════════════════════════════════════ */
SyncEngine._block = false;
SyncEngine._intercept();

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => SyncEngine.init());
} else {
  SyncEngine.init();
}
