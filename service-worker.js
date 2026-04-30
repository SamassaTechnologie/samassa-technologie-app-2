/* ============================================================
   SAMASSA TECHNOLOGIE — Service Worker PWA v2.1
   Installable sur PC (Windows/Mac/Linux) ET téléphone
   Stratégie : Cache-First pour les assets, Network-First pour les pages
============================================================ */
const CACHE_NAME   = 'samassa-pro-v3.1';
const CACHE_PAGES  = 'samassa-pages-v3.1';

/* Fichiers mis en cache immédiatement à l'installation */
const STATIC_ASSETS = [
  'index.html',
  'login.html',
  'facture.html',
  'recu.html',
  'devis.html',
  'intervention.html',
  'recu_cyber.html',
  'facture_cyber.html',
  'style.css',
  'auth.js',
  'utils.js',
  'facture.js',
  'recu.js',
  'devis.js',
  'intervention.js',
  'recu_cyber.js',
  'facture_cyber.js',
  'sync.js',
  'firebase-config.js',
  'mobile.css',
  'docs_admin.html',
  'manifest.json',
  'logo.png',
  'icon-512x512.png',
  'logo-wave.png',
  'logo-orange-money.jpg',
  'logo-moov-money.png',
  'signature.png',
  'cachet.png',
  'watermark.png'
];

/* ---- INSTALL : mise en cache de tous les assets ---- */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

/* ---- ACTIVATE : nettoyage des anciens caches ---- */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME && key !== CACHE_PAGES)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

/* ---- FETCH : stratégie Cache-First pour assets, Network-First pour pages ---- */
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  /* Ignorer les requêtes non-GET et hors origine */
  if (request.method !== 'GET' || !url.origin.includes(self.location.origin)) return;

  /* Assets statiques (CSS, JS, images) → Cache-First */
  const isAsset = /\.(css|js|png|jpg|jpeg|gif|ico|svg|woff2?)$/i.test(url.pathname);
  if (isAsset) {
    event.respondWith(
      caches.match(request).then(cached => cached || fetch(request).then(response => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
        return response;
      }))
    );
    return;
  }

  /* Pages HTML → Network-First (online = frais, offline = cache) */
  event.respondWith(
    fetch(request)
      .then(response => {
        const clone = response.clone();
        caches.open(CACHE_PAGES).then(cache => cache.put(request, clone));
        return response;
      })
      .catch(() => caches.match(request).then(cached => cached || caches.match('index.html')))
  );
});
