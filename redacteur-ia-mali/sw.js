/* ===== Service worker : fonctionnement 100 % hors ligne =====
   - À l'installation : met en cache l'application + les 2 bibliothèques (docx.js, FileSaver).
   - Ensuite : tout est servi depuis le cache, sans internet.
   Changez VERSION à chaque modification des fichiers pour forcer la mise à jour. */
const VERSION = 'redacteur-mali-v6';
const LOCAL = ['./', 'index.html', 'style.css', 'app.js', 'manifest.json', 'logo.png', 'icon-192.png', 'icon-512.png'];
const CDN = [];   // plus aucune dépendance externe

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(VERSION);
    await c.addAll(LOCAL);
    for (const u of CDN) { try { const r = await fetch(u, {mode: 'cors'}); if (r.ok) await c.put(u, r); } catch (_) {} }
    self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== VERSION) await caches.delete(k); // supprime les anciennes versions
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const hit = await cache.match(e.request, {ignoreSearch: true});
    if (hit) return hit;                                   // 1) cache d'abord
    try {
      const r = await fetch(e.request);                    // 2) sinon réseau, puis on mémorise
      if (r.ok && (r.type === 'basic' || r.type === 'cors')) cache.put(e.request, r.clone());
      return r;
    } catch (_) {
      if (e.request.mode === 'navigate') return cache.match('index.html'); // 3) hors ligne : page d'accueil
      return new Response('', {status: 504});
    }
  })());
});
