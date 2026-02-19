const CACHE_NAME = 'daily-fret-v12';
const PRECACHE = [
  '/',
  '/index.html',
  '/css/global.css',
  '/css/animations.css',
  '/js/db.js',
  '/js/router.js',
  '/js/app.js',
  '/js/utils.js',
  '/js/pages/dashboard.js',
  '/js/pages/sessions.js',
  '/js/pages/session-single.js',
  '/js/pages/session-form.js',
  '/js/pages/gear.js',
  '/js/pages/resources.js',
  '/js/pages/progress.js',
  '/js/pages/tools-hub.js',
  '/js/pages/tools/metronome.js',
  '/js/pages/tools/chords.js',
  '/js/pages/tools/scales.js',
  '/js/pages/tools/bpm-guide.js',
  '/js/pages/tools/tuning.js',
  '/manifest.json',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(c => c.addAll(PRECACHE))
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
  // Network-first for API calls
  if (e.request.url.includes('/api/')) {
    e.respondWith(
      fetch(e.request).catch(() => new Response(JSON.stringify({ error: 'offline' }), {
        headers: { 'Content-Type': 'application/json' }
      }))
    );
    return;
  }

  // Cache-first for everything else
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request).then(res => {
      // Cache successful GET responses
      if (res.ok && e.request.method === 'GET') {
        const clone = res.clone();
        caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
      }
      return res;
    }))
  );
});
1772000000
1771537604
