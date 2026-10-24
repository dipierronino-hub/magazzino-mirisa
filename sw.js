/* Service worker di Magazzino Mirisa: ha scope solo su /magazzino-mirisa/,
   quindi non interferisce con le altre app pubblicate sullo stesso dominio.
   Strategia "prima la rete": si vede sempre l'ultima versione, e senza rete
   si apre comunque l'ultima copia salvata. */
const CACHE = 'magazzino-mirisa-v1';
const FILES = ['./', 'index.html', 'style.css', 'app.js', 'manifest.json', 'Logo-Mirisa-Ceramiche-Vettoriale-2.svg', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  // Rimuove solo le vecchie cache di questa app
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith('magazzino-mirisa-') && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Le chiamate all'IA non vanno mai in cache
  if (url.hostname === 'generativelanguage.googleapis.com') return;
  const cacheable = url.origin === location.origin || ['cdn.tailwindcss.com', 'fonts.googleapis.com', 'fonts.gstatic.com'].includes(url.hostname);
  if (!cacheable) return;
  e.respondWith(
    fetch(req).then(res => {
      if (res.ok || res.type === 'opaque') { const copia = res.clone(); caches.open(CACHE).then(c => c.put(req, copia)); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: url.origin === location.origin }))
  );
});
