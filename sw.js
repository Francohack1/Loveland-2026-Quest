/* Loveland field map — offline shell.
   index.html carries the plan and the cached satellite image inside it,
   so caching the document plus the three CDN libraries is enough to boot
   with no signal at all. */
const CACHE = 'llf-v2';
const SHELL = [
  './',
  './index.html',
  './manifest.json',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/mqtt/5.15.2/mqtt.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/2.0.4/qrcode.min.js'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE)
    .then(c => Promise.all(SHELL.map(u => c.add(new Request(u, {mode:'cors'})).catch(()=>{}))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // never cache the live-sharing traffic
  if (url.protocol === 'wss:' || url.pathname.endsWith('.json') && url.hostname.includes('firebase')) return;

  // map tiles: network first, fall back to whatever we have
  if (url.hostname.includes('arcgisonline') || url.hostname.includes('basemaps.cartocdn')) {
    e.respondWith(
      fetch(req).then(r => {
        const copy = r.clone();
        caches.open(CACHE).then(c => c.put(req, copy)).catch(()=>{});
        return r;
      }).catch(() => caches.match(req))
    );
    return;
  }

  // the document itself: network first, so a new build always wins
  const isDoc = req.mode === 'navigate'
    || url.pathname.endsWith('/') || url.pathname.endsWith('index.html');
  if (isDoc) {
    e.respondWith(
      fetch(req).then(r => {
        const copy = r.clone();
        caches.open(CACHE).then(c => c.put(req, copy)).catch(()=>{});
        return r;
      }).catch(() => caches.match(req).then(m => m || caches.match('./index.html')))
    );
    return;
  }

  // libraries and icons: cache first, they are versioned in the URL
  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(r => {
      const copy = r.clone();
      caches.open(CACHE).then(c => c.put(req, copy)).catch(()=>{});
      return r;
    }))
  );
});
