window.Pages = window.Pages || {};

(function () {
  const routes = {
    'dashboard': () => Pages.Dashboard.render(),
    'library': () => Pages.Library.render(),
    'scan-report': () => Pages.ScanReport.render(),
    'settings': () => Pages.Settings.render(),
  };

  function currentRoute() {
    const raw = (location.hash || '#/dashboard').replace(/^#\/?/, '');
    return raw.split('?')[0] || 'dashboard';
  }

  function updateNav(route) {
    document.querySelectorAll('[data-nav]').forEach((el) => {
      const isActive = el.dataset.nav === route;
      el.classList.toggle('active', isActive);
    });
  }

  function render() {
    const route = currentRoute();
    const handler = routes[route] || routes.dashboard;
    updateNav(route);
    handler();
  }

  window.addEventListener('hashchange', render);
  window.addEventListener('DOMContentLoaded', () => {
    if (!location.hash) location.hash = '#/dashboard';
    render();
  });
})();
