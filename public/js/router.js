// Daily Fret — Hash Router
// Exposes window.Router and window.go

(function() {
  const routes = [
    { pattern: /^#\/?$/,                         handler: () => navigate('#/dashboard') },
    { pattern: /^#\/dashboard$/,                  handler: () => Pages.Dashboard.render() },
    { pattern: /^#\/sessions$/,                   handler: () => Pages.Sessions.render() },
    { pattern: /^#\/session\/(.+)$/,              handler: (m) => Pages.SessionSingle.render(m[1]) },
    { pattern: /^#\/log$/,                        handler: () => Pages.SessionForm.render(null) },
    { pattern: /^#\/log\/(.+)$/,                  handler: (m) => Pages.SessionForm.render(m[1]) },
    { pattern: /^#\/gear\/add$/,                  handler: () => Pages.GearForm.render(null) },
    { pattern: /^#\/gear\/edit\/(.+)$/,           handler: (m) => Pages.GearForm.render(m[1]) },
    { pattern: /^#\/gear$/,                       handler: () => Pages.Gear.render() },
    { pattern: /^#\/resources\/videos\/new$/,       handler: () => Pages.ResourceVideosEdit.render(null) },
    { pattern: /^#\/training$/,                   handler: () => Pages.TrainingHome.render() },
    { pattern: /^#\/training\/providers$/,         handler: () => Pages.TrainingProviders.render() },
    { pattern: /^#\/training\/provider\/(\d+)$/,   handler: (m) => Pages.TrainingProvider.render(m[1]) },
    { pattern: /^#\/training\/course\/(\d+)$/,     handler: (m) => Pages.TrainingCourse.render(m[1]) },
    { pattern: /^#\/training\/module\/(\d+)$/,     handler: (m) => Pages.TrainingModule.render(m[1]) },
    { pattern: /^#\/training\/lesson\/(\d+)$/,     handler: (m) => Pages.TrainingLesson.render(m[1]) },
    { pattern: /^#\/training\/session-builder$/,     handler: () => Pages.TrainingSessionBuilder.render() },
    { pattern: /^#\/resources\/videos\/(\d+)\/edit$/, handler: (m) => Pages.ResourceVideosEdit.render(m[1]) },
    { pattern: /^#\/resources\/videos\/(\d+)$/,      handler: (m) => Pages.ResourceVideoDetail.render(m[1]) },
    { pattern: /^#\/resources\/videos(?:\?.*)?$/,     handler: () => Pages.ResourceVideosList.render() },
    { pattern: /^#\/resources\/add$/,             handler: () => Pages.ResourceForm.render(null) },
    { pattern: /^#\/resources\/edit\/(.+)$/,      handler: (m) => Pages.ResourceForm.render(m[1]) },
    { pattern: /^#\/resources$/,                  handler: () => Pages.Resources.render() },
    { pattern: /^#\/presets$/,                    handler: () => Pages.Presets.render() },
    { pattern: /^#\/progress(?:\?.*)?$/,          handler: () => Pages.Progress.render() },
    { pattern: /^#\/tools\/metronome/,            handler: () => Pages.Metronome.render() },
    { pattern: /^#\/tools\/chords$/,              handler: () => Pages.Chords.render() },
    { pattern: /^#\/tools\/scales$/,              handler: () => Pages.Scales.render() },
    { pattern: /^#\/tools\/bpm$/,                 handler: () => Pages.Metronome.render() },
    { pattern: /^#\/tools\/tuning$/,              handler: () => Pages.Tuning.render() },
    { pattern: /^#\/tools\/amp-manual$/,          handler: () => window.location.assign('/manual.pdf') },
    { pattern: /^#\/tools$/,                      handler: () => Pages.ToolsHub.render() },
    { pattern: /^#\/settings$/,                   handler: () => Pages.Settings.render() },
  ];

  function getHash() {
    return location.hash || '#/';
  }

  function navigate(hash) {
    const h = hash || getHash();
    const routeName = h.replace(/^#\/?/, '').split('?')[0];
    const routeHash = `#/${routeName}`;

    // Find matching route
    for (const route of routes) {
      const m = routeHash.match(route.pattern);
      if (m) {
        // Page transition
        const app = document.getElementById('app');
        app.classList.add('ff-panel--page');
        app.classList.add('page-out');

        setTimeout(() => {
          app.classList.remove('page-out');
          route.handler(m);
          app.classList.add('page-in');

          // Update nav active state
          updateNav(routeHash);

          // Scroll to top
          window.scrollTo(0, 0);

          setTimeout(() => {
            app.classList.remove('page-in');
          }, 200);
        }, 150);
        return;
      }
    }

    // 404 fallback
    document.getElementById('app').innerHTML = `
      <div class="page-wrap" style="padding:80px 24px;text-align:center;">
        <div class="page-title" style="color:var(--text3);margin-bottom:16px;">404</div>
        <p style="color:var(--text2);">Page not found. <a href="#/dashboard" style="color:var(--accent);">Go home</a></p>
      </div>
    `;
  }

  function updateNav(hash) {
    const links = document.querySelectorAll('.nav__link, .nav__mobile-link');
    links.forEach(link => {
      link.classList.remove('active');
      const href = link.getAttribute('href') || '';
      // Match by route segment
      if (hash.startsWith('#/dashboard') && href.includes('dashboard')) link.classList.add('active');
      else if (hash.startsWith('#/sessions') || hash.startsWith('#/session/')) {
        if (href.includes('sessions')) link.classList.add('active');
      }
      else if (hash.startsWith('#/gear')) {
        if (href.includes('gear')) link.classList.add('active');
      }
      else if (hash.startsWith('#/resources')) {
        if (href.includes('resources')) link.classList.add('active');
      }
      else if (hash.startsWith('#/training')) {
        if (href.includes('training')) link.classList.add('active');
      }
      else if (hash.startsWith('#/presets')) {
        if (href.includes('presets')) link.classList.add('active');
      }
      else if (hash.startsWith('#/progress')) {
        if (href.includes('progress')) link.classList.add('active');
      }
      else if (hash.startsWith('#/tools') || hash.startsWith('#/log')) {
        if (hash.startsWith('#/tools') && href.includes('tools')) link.classList.add('active');
      }
      else if (hash.startsWith('#/settings')) {
        if (href.includes('settings')) link.classList.add('active');
      }
    });
  }

  // ── DB-ready guard ────────────────────────────────────────────────
  // db.js opens IndexedDB asynchronously. We must not render any page
  // that calls DB until window.DB is fully initialised.
  // __FF_DB_READY_FLAG__
  let dbReady = !!window.__DB_READY__;

  let pendingHash = null;

  // If DB became ready before router loaded, catch up now
  if (window.__DB_READY__) {
    dbReady = true;
  }

  window.addEventListener('db-ready', () => {
    dbReady = true;
    if (pendingHash !== null) {
      const h = pendingHash;
      pendingHash = null;
      navigate(h);
    }
  });

  window.addEventListener('hashchange', () => {
    if (dbReady) navigate(location.hash);
    else pendingHash = location.hash;
  });

  window.addEventListener('load', () => {
    const h = getHash();
    if (dbReady) navigate(h);
    else pendingHash = h;
  });

  // Global navigate helper
  window.go = (hash) => { location.hash = hash; };

  window.Router = { navigate, updateNav };
})();


// __FF_ROUTER_BOOTSTRAP__
// Ensure initial route renders even when URL has no hash.
(function () {
  function ensureDefaultHash() {
    if (!location.hash || location.hash === '#') {
      location.hash = '#/dashboard';
    }
  }

  function runRouterOnceReady() {
    try {
      ensureDefaultHash();
      // router function name varies; try common exports:
      if (typeof window.router === 'function') return window.router();
      if (typeof window.route === 'function') return window.route();
      if (typeof window.renderRoute === 'function') return window.renderRoute();
      // If router is defined in module scope, fall back to dispatching events.
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    } catch (e) {
      // If anything goes wrong, at least don't leave a blank screen with no clue
      const app = document.getElementById('app');
      if (app) app.innerHTML = '<div style="padding:16px;border:1px solid var(--accent);border-radius:12px">Router failed to start. Open DevTools → Console.</div>';
      console.error(e);
    }
  }

  // Run after DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runRouterOnceReady, { once: true });
  } else {
    runRouterOnceReady();
  }
})();
