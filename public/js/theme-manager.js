(function () {
  const STORAGE_KEY = 'crate.theme';
  const THEMES = [
    { id: 'neon-djent', name: 'Neon Djent', swatches: ['#070910', '#111728', '#9d5cff', '#14f1ff'] },
    { id: 'classic-dark', name: 'Classic Dark', swatches: ['#111316', '#1b1f23', '#6f8fff', '#a9bedf'] },
  ];

  function applyTheme(themeId) {
    const valid = THEMES.some((t) => t.id === themeId) ? themeId : 'neon-djent';
    document.documentElement.dataset.theme = valid;
    localStorage.setItem(STORAGE_KEY, valid);
    return valid;
  }

  function getTheme() {
    return localStorage.getItem(STORAGE_KEY) || 'neon-djent';
  }

  window.ThemeManager = { THEMES, STORAGE_KEY, applyTheme, getTheme };
  applyTheme(getTheme());
})();
