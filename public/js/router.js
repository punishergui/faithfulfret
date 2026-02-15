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
    { pattern: /^#\/resources\/add$/,             handler: () => Pages.ResourceForm.render(null) },
    { pattern: /^#\/resources\/edit\/(.+)$/,      handler: (m) => Pages.ResourceForm.render(m[1]) },
    { pattern: /^#\/resources$/,                  handler: () => Pages.Resources.render() },
    { pattern: /^#\/presets$/,                    handler: () => Pages.Presets.render() },
    { pattern: /^#\/progress$/,                   handler: () => Pages.Progress.render() },
    { pattern: /^#\/tools\/metronome/,            handler: () => Pages.Metronome.render() },
    { pattern: /^#\/tools\/chords$/,              handler: () => Pages.Chords.render() },
    { pattern: /^#\/tools\/scales$/,              handler: () => Pages.Scales.render() },
    { pattern: /^#\/tools\/bpm$/,                 handler: () => Pages.Metronome.render() },
    { pattern: /^#\/tools\/tuning$/,              handler: () => Pages.Tuning.render() },
    { pattern: /^#\/tools\/amp-manual$/,          handler: () => window.location.assign('/manual.pdf') },
    { pattern: /^#\/tools$/,                      handler: () => Pages.ToolsHub.render() },
  ];

  function getHash() {
    return location.hash || '#/';
  }

  function navigate(hash) {
    const h = hash || getHash();

    // Find matching route
    for (const route of routes) {
      const m = h.match(route.pattern);
      if (m) {
        // Page transition
        const app = document.getElementById('app');
        app.classList.add('page-out');

        setTimeout(() => {
          app.classList.remove('page-out');
          route.handler(m);
          app.classList.add('page-in');

          // Update nav active state
          updateNav(h);

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
      else if (hash.startsWith('#/presets')) {
        if (href.includes('presets')) link.classList.add('active');
      }
      else if (hash.startsWith('#/progress')) {
        if (href.includes('progress')) link.classList.add('active');
      }
      else if (hash.startsWith('#/tools') || hash.startsWith('#/log')) {
        if (hash.startsWith('#/tools') && href.includes('tools')) link.classList.add('active');
      }
    });
  }

  // ── DB-ready guard ────────────────────────────────────────────────
  // db.js opens IndexedDB asynchronously. We must not render any page
  // that calls DB until window.DB is fully initialised.
  let dbReady = false;
  let pendingHash = null;

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
