const CACHE_NAME = 'daily-fret-v7';
const PRECACHE = [
  '/',
  '/index.html',
  '/css/global.css',
  '/css/animations.css',
  '/js/db.js',
  '/js/router.js',
  '/js/app.js',
  '/js/utils.js',
  '/js/manual/manual-data.js',
  '/js/manual/markdown.js',
  '/js/wiki/wiki-assets.js',
  '/js/wiki/wiki-search.js',
  '/js/wiki/wiki-storage.js',
  '/js/pages/manual.js',
  '/js/pages/manual-article.js',
  '/js/pages/manual-editor.js',
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
  '/css/manual.css',
  '/manual/toc.json',
  '/manual/search-index.json',
  '/manual/pages/getting-started.md',
  '/manual/pages/features/front-panel-controls.md',
  '/manual/pages/features/usb-audio-recording.md',
  '/manual/pages/troubleshooting/no-sound.md',
  '/manual/pages/troubleshooting/factory-reset.md',
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

  // Runtime-cache manual pages/assets after first visit.
  if (e.request.url.includes('/manual/pages/') || e.request.url.includes('/manual/assets/')) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
          return res;
        })
        .catch(() => caches.match(e.request))
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
