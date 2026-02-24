const CACHE_NAME = 'daily-fret-v16';
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
  '/js/pages/training.js',
  '/js/pages/settings.js',
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
  if (e.request.method !== 'GET') {
    return;
  }

  // Network-first for API calls
  if (e.request.url.includes('/api/')) {
    e.respondWith(
      fetch(e.request).catch(() => new Response(JSON.stringify({ error: 'offline' }), {
        headers: { 'Content-Type': 'application/json' }
      }))
    );
    return;
  }

  // Network-first for navigations with offline fallback
  if (e.request.mode === 'navigate' || e.request.destination === 'document') {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then(c => c.put('/index.html', clone));
          }
          return res;
        })
        .catch(async () => {
          const cached = await caches.match('/index.html');
          return cached || Response.error();
        })
    );
    return;
  }

  // Stale-while-revalidate for JS/CSS
  if (e.request.destination === 'script' || e.request.destination === 'style') {
    e.respondWith(
      caches.match(e.request).then(cached => {
        const networkFetch = fetch(e.request)
          .then(res => {
            if (res.ok) {
              const clone = res.clone();
              caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
            }
            return res;
          })
          .catch(() => cached);

        return cached || networkFetch;
      })
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
// cache-bust: 2026-02-19T12:00:00Z
