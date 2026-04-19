/* ============================================================
   SAMASSA TECHNOLOGIE — Service Worker PWA v2.0
   Cache offline pour utilisation sans connexion
============================================================ */
const CACHE_NAME = 'samassa-pro-v2';
const ASSETS = [
  '/', '/index.html', '/facture.html', '/recu.html',
  '/devis.html', '/intervention.html',
  '/style.css', '/utils.js',
  '/facture.js', '/recu.js', '/devis.js', '/intervention.js',
  '/logo.png', '/icon-512x512.png',
  '/signature.png', '/cachet.png', '/watermark.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
