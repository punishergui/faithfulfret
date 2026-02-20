// Daily Fret — Theme Overrides (client-side per theme)

(function () {
  const PREFIX = 'ff_theme_overrides:';
  let activeKeys = [];

  function storageKey(themeId) {
    return `${PREFIX}${themeId}`;
  }

  function sanitize(raw) {
    if (!raw || typeof raw !== 'object') return {};
    const next = {};
    Object.entries(raw).forEach(([key, value]) => {
      if (typeof key !== 'string') return;
      if (typeof value !== 'string') return;
      const name = key.trim();
      const val = value.trim();
      if (!name.startsWith('--') || !val) return;
      next[name] = val;
    });
    return next;
  }

  function getOverrides(themeId) {
    if (!themeId) return {};
    try {
      const parsed = JSON.parse(localStorage.getItem(storageKey(themeId)) || '{}');
      return sanitize(parsed);
    } catch {
      return {};
    }
  }

  function writeOverrides(themeId, overrides) {
    if (!themeId) return;
    const safe = sanitize(overrides);
    if (!Object.keys(safe).length) {
      localStorage.removeItem(storageKey(themeId));
      return;
    }
    localStorage.setItem(storageKey(themeId), JSON.stringify(safe));
  }

  function setOverride(themeId, varName, value) {
    if (!themeId || !varName) return {};
    const key = varName.trim();
    const nextValue = String(value ?? '').trim();
    const current = getOverrides(themeId);
    if (!key.startsWith('--') || !nextValue) return current;
    current[key] = nextValue;
    writeOverrides(themeId, current);
    return current;
  }

  function clearOverride(themeId, varName) {
    if (!themeId || !varName) return {};
    const key = varName.trim();
    const current = getOverrides(themeId);
    delete current[key];
    writeOverrides(themeId, current);
    return current;
  }

  function clearAllOverrides(themeId) {
    if (!themeId) return;
    localStorage.removeItem(storageKey(themeId));
  }

  function applyOverrides(themeId) {
    const root = document.documentElement;
    activeKeys.forEach((key) => root.style.removeProperty(key));
    const overrides = getOverrides(themeId);
    Object.entries(overrides).forEach(([key, value]) => root.style.setProperty(key, value));
    activeKeys = Object.keys(overrides);
    return overrides;
  }

  window.ThemeOverrides = {
    getOverrides,
    setOverride,
    clearOverride,
    clearAllOverrides,
    applyOverrides,
  };
})();
