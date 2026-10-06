/* ============================================================
   SAMASSA TECHNOLOGIE — Service Worker PWA v3.2
   Tous les modules en cache (hors-ligne complet)
============================================================ */
const CACHE_NAME  = 'samassa-pro-v3.2';
const CACHE_PAGES = 'samassa-pages-v3.2';

const STATIC_ASSETS = [
  'index.html','login.html',
  'facture.html','facture.js',
  'facture_materiel.html','facture_materiel.js',
  'facture_cyber.html','facture_cyber.js',
  'recu.html','recu.js',
  'recu_cyber.html','recu_cyber.js',
  'recu_vente.html','recu_vente.js',
  'bon_reparation.html','bon_reparation.js',
  'stock.html','stock.js',
  'devis.html','devis.js',
  'intervention.html','intervention.js',
  'clients.html','autoconfig.html','docs_admin.html',
  'style.css','mobile.css',
  'auth.js','utils.js','sync.js',
  'firebase-config.js','cloud-integration.js',
  'scanner.js','jsqr.js','qrcode.min.js',
  'capacitor-plugins.js',
  'manifest.json',
  'logo.png','icon-192x192.png','icon-512x512.png',
  'logo-wave.png','logo-orange-money.jpg','logo-moov-money.png',
  'signature.png','cachet.png','cachet-signature-blue.png','watermark.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME && k !== CACHE_PAGES).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || !url.origin.includes(self.location.origin)) return;
  const isAsset = /\.(css|js|png|jpg|jpeg|gif|ico|svg|woff2?)$/i.test(url.pathname);
  if (isAsset) {
    event.respondWith(
      caches.match(request).then(cached => cached || fetch(request).then(response => {
        caches.open(CACHE_NAME).then(cache => cache.put(request, response.clone()));
        return response;
      }))
    );
    return;
  }
  event.respondWith(
    fetch(request)
      .then(response => {
        caches.open(CACHE_PAGES).then(cache => cache.put(request, response.clone()));
        return response;
      })
      .catch(() => caches.match(request).then(cached => cached || caches.match('index.html')))
  );
});
