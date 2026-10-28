/* ============================================================
   SAMASSA TECHNOLOGIE — Service Worker PWA v4.6
   Tous les modules en cache (hors-ligne complet)
============================================================ */
const CACHE_NAME  = 'samassa-pro-v6.8';
const CACHE_PAGES = 'samassa-pages-v6.8';

const STATIC_ASSETS = [
  'index.html','iloveapi.html','scanner.html','analytics.html','login.html',
  'facture.html','facture.js',
  'facture_materiel.html','facture_materiel.js',
  'facture_cyber.html','facture_cyber.js','cyber-docs.html',
  'recu.html','recu.js',
  'recu_cyber.html','recu_cyber.js',
  'recu_vente.html','recu_vente.js',
  'bon_reparation.html','bon_reparation.js',
  'stock.html','stock.js',
  'devis.html','devis.js',
  'intervention.html','intervention.js',
  'clients.html','rapports.html','backup.html','settings.html','utilisateurs.html','journal.html','gestion.html','autoconfig.html','docs_admin.html',
  'redacteur-ia-mali/index.html','redacteur-ia-mali/app.js','redacteur-ia-mali/modeles-ventes.js','redacteur-ia-mali/modeles-succession.js','redacteur-ia-mali/fonctions-plus.js','redacteur-ia-mali/style.css','redacteur-ia-mali/manifest.json','redacteur-ia-mali/icon-192.png','redacteur-ia-mali/icon-512.png','redacteur-ia-mali/logo.png','redacteur-ia-mali/sw.js',
  'style.css','mobile.css','dashboard-plus.js',
  'auth.js?v=firebase1','utils.js','export-pro.js','sync.js','analytics.js','analytics-dashboard.js',
  'firebase-config.js','ai-firebase.js','cloud-integration.js',
  'scanner.js','scanner-intelligent.js','jsqr.js','qrcode.min.js',
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
