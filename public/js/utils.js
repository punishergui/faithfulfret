// Daily Fret — Utils
// Exposes window.Utils

window.Utils = {

  HERO_IMG_OPACITY_KEY: 'ff.heroImgOpacity',
  HERO_OVERLAY_ALPHA_KEY: 'ff.heroOverlayAlpha',
  HERO_IMG_OPACITY_DEFAULT: 0.55,
  HERO_OVERLAY_ALPHA_DEFAULT: 0.52,

  clampNumber: (value, min, max, fallback) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, n));
  },

  getHeroSettings: () => {
    const img = window.Utils.clampNumber(
      localStorage.getItem(window.Utils.HERO_IMG_OPACITY_KEY),
      0.15,
      0.85,
      window.Utils.HERO_IMG_OPACITY_DEFAULT
    );
    const overlay = window.Utils.clampNumber(
      localStorage.getItem(window.Utils.HERO_OVERLAY_ALPHA_KEY),
      0.10,
      0.85,
      window.Utils.HERO_OVERLAY_ALPHA_DEFAULT
    );
    return { img, overlay };
  },

  applyHeroSettings: () => {
    const { img, overlay } = window.Utils.getHeroSettings();
    document.documentElement.style.setProperty('--hero-img-opacity', String(img));
    document.documentElement.style.setProperty('--hero-overlay-alpha', String(overlay));
    return { img, overlay };
  },

  setHeroSettings: ({ img, overlay }) => {
    const nextImg = window.Utils.clampNumber(img, 0.15, 0.85, window.Utils.HERO_IMG_OPACITY_DEFAULT);
    const nextOverlay = window.Utils.clampNumber(overlay, 0.10, 0.85, window.Utils.HERO_OVERLAY_ALPHA_DEFAULT);
    localStorage.setItem(window.Utils.HERO_IMG_OPACITY_KEY, String(nextImg));
    localStorage.setItem(window.Utils.HERO_OVERLAY_ALPHA_KEY, String(nextOverlay));
    document.documentElement.style.setProperty('--hero-img-opacity', String(nextImg));
    document.documentElement.style.setProperty('--hero-overlay-alpha', String(nextOverlay));
    return { img: nextImg, overlay: nextOverlay };
  },

  resetHeroSettings: () => {
    localStorage.removeItem(window.Utils.HERO_IMG_OPACITY_KEY);
    localStorage.removeItem(window.Utils.HERO_OVERLAY_ALPHA_KEY);
    document.documentElement.style.setProperty('--hero-img-opacity', String(window.Utils.HERO_IMG_OPACITY_DEFAULT));
    document.documentElement.style.setProperty('--hero-overlay-alpha', String(window.Utils.HERO_OVERLAY_ALPHA_DEFAULT));
    return { img: window.Utils.HERO_IMG_OPACITY_DEFAULT, overlay: window.Utils.HERO_OVERLAY_ALPHA_DEFAULT };
  },
  getThemes: () => Array.isArray(window.FF_THEMES) ? window.FF_THEMES : [],
  getThemeMap: () => Object.fromEntries((window.Utils.getThemes()).map((theme) => [theme.id, theme])),
  uuid: () => (window.crypto && window.crypto.randomUUID ? window.crypto.randomUUID() : `id_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`),

  // Always use T12:00:00 to avoid timezone day-shift bugs
  formatDate: (ymd, fmt = 'long') => {
    if (!ymd) return '';
    const d = new Date(ymd + 'T12:00:00');
    if (fmt === 'long')  return d.toLocaleDateString('en-US', { weekday: 'long',  month: 'long',  day: 'numeric', year: 'numeric' });
    if (fmt === 'short') return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    if (fmt === 'day')   return d.toLocaleDateString('en-US', { weekday: 'short' });
    if (fmt === 'month') return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    if (fmt === 'dow')   return d.toLocaleDateString('en-US', { weekday: 'long' });
    if (fmt === 'date-only') return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    return ymd;
  },

  today: () => new Date().toISOString().split('T')[0],

  truncate: (str, n) => str && str.length > n ? str.slice(0, n) + '...' : str,

  extractYouTubeId: (value) => {
    if (!value) return '';
    const raw = String(value).trim();
    if (!raw) return '';

    // Looks like an ID already
    if (/^[a-zA-Z0-9_-]{11}$/.test(raw)) return raw;

    try {
      const url = new URL(raw.includes('://') ? raw : `https://${raw}`);
      const host = url.hostname.replace('www.', '');

      if (host === 'youtu.be') {
        const id = url.pathname.slice(1).split('/')[0];
        return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : '';
      }

      if (host.includes('youtube.com')) {
        const v = url.searchParams.get('v');
        if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) return v;
        const parts = url.pathname.split('/').filter(Boolean);
        const maybe = parts[1] || parts[0] || '';
        return /^[a-zA-Z0-9_-]{11}$/.test(maybe) ? maybe : '';
      }
    } catch {
      // ignore parse failures
    }

    return '';
  },

  ytThumb: (videoValue, quality = 'mqdefault') => {
    const id = window.Utils.extractYouTubeId(videoValue);
    return id ? `https://img.youtube.com/vi/${id}/${quality}.jpg` : null;
  },

  normalizeUrl: (value) => {
    if (!value) return '';
    const raw = String(value).trim();
    if (!raw) return '';
    if (/^https?:\/\//i.test(raw)) return raw;
    return `https://${raw}`;
  },

  gearImage: (category) => ({
    'Guitar':    'https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=600&q=80',
    'Amp':       'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&q=80',
    'Pedal':     'https://images.unsplash.com/photo-1568218234742-f0df6cd67c9a?w=600&q=80',
    'Strings':   'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=600&q=80',
    'Interface': 'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=600&q=80',
    'Picks':     'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=600&q=80',
    'Tuner':     'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=600&q=80',
  }[category] || 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=600&q=80'),

  parseLinks: (raw) => {
    if (!raw) return [];
    return raw.split('\n').filter(Boolean).map(line => {
      const parts = line.split('|').map(s => s.trim());
      const label = parts[0] || '';
      const url = parts[1] || parts[0] || '';
      return { label: label || url, url: url || label };
    }).filter(l => l.url && l.url.startsWith('http'));
  },

  parseChecklist: (raw) =>
    raw ? raw.split('\n').map(s => s.trim()).filter(Boolean) : [],

  animateCount: (el, target, duration = 800) => {
    if (!el || typeof target !== 'number') return;
    const start = performance.now();
    const isFloat = !Number.isInteger(target);
    const tick = (now) => {
      const p = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      const val = isFloat ? (ease * target).toFixed(1) : Math.round(ease * target);
      el.textContent = val;
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  },

  domainOf: (url) => {
    try {
      return new URL(url).hostname.replace('www.', '');
    } catch {
      return url;
    }
  },


  normalizeGearStatus: (status) => {
    const normalized = typeof status === 'string' ? status.trim() : status;
    const map = {
      'Own it': 'Owned',
      owned: 'Owned',
      'Wish List': 'Wishlist',
      wishlist: 'Wishlist',
      Watching: 'Wishlist',
      watching: 'Wishlist',
      'On Loan': 'Wishlist',
      sold: 'Sold',
    };
    return map[normalized] || normalized || 'Owned';
  },

  computeGearStats: (gear = []) => {
    const money = (value) => {
      const n = Number(value);
      return Number.isFinite(n) ? n : 0;
    };
    const parseDay = (value) => {
      if (!value) return null;
      const d = new Date(`${value}T12:00:00`);
      return Number.isFinite(d.getTime()) ? d : null;
    };

    const normalizedGear = (gear || []).map((g) => ({ ...g, status: window.Utils.normalizeGearStatus(g.status) }));
    const owned = normalizedGear.filter((g) => g.status === 'Owned');
    const sold = normalizedGear.filter((g) => g.status === 'Sold');
    const wishlist = normalizedGear.filter((g) => g.status === 'Wishlist');

    const ownedInvested = owned.reduce((sum, g) => sum + money(g.boughtPrice) + money(g.tax) + money(g.shipping), 0);
    const soldRecoveredNet = sold.reduce((sum, g) => sum + money(g.soldPrice) - money(g.soldFees) - money(g.soldShipping), 0);
    const soldCostBasis = sold.reduce((sum, g) => sum + money(g.boughtPrice) + money(g.tax) + money(g.shipping), 0);
    const soldNetPL = soldRecoveredNet - soldCostBasis;

    const soldWithProfit = sold.map((g) => {
      const recovered = money(g.soldPrice) - money(g.soldFees) - money(g.soldShipping);
      const basis = money(g.boughtPrice) + money(g.tax) + money(g.shipping);
      return { item: g, profit: recovered - basis };
    });

    const soldHoldDays = sold
      .map((g) => {
        const start = parseDay(g.boughtDate);
        const end = parseDay(g.soldDate);
        if (!start || !end) return null;
        return Math.max(0, Math.round((end - start) / 86400000));
      })
      .filter((v) => v != null);

    const topN = (rows = [], key) => Object.entries(rows.reduce((acc, row) => {
      const raw = String(row[key] || '').trim();
      const label = raw || 'Other';
      acc[label] = (acc[label] || 0) + 1;
      return acc;
    }, {})).map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)).slice(0, 5);

    return {
      ownedCount: owned.length,
      wishlistCount: wishlist.length,
      soldCount: sold.length,
      ownedInvested,
      totalInvested: ownedInvested,
      soldRecoveredNet,
      totalRecoveredNet: soldRecoveredNet,
      soldCostBasis,
      soldNetPL,
      bestFlip: soldWithProfit.length ? soldWithProfit.reduce((best, row) => (row.profit > best.profit ? row : best), soldWithProfit[0]) : null,
      worstFlip: soldWithProfit.length ? soldWithProfit.reduce((worst, row) => (row.profit < worst.profit ? row : worst), soldWithProfit[0]) : null,
      avgHoldDays: soldHoldDays.length ? Math.round((soldHoldDays.reduce((a, b) => a + b, 0) / soldHoldDays.length) * 10) / 10 : null,
      wishlistTargetTotal: wishlist.reduce((sum, g) => sum + money(g.targetPrice), 0),
      topCategories: topN(normalizedGear, 'category'),
      topBrands: topN(normalizedGear, 'brand'),
    };
  },

  formatPrice: (price) => {
    if (price == null || price === '' || isNaN(price)) return '';
    return '$' + Number(price).toLocaleString();
  },

  greeting: () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good Morning';
    if (h < 18) return 'Good Afternoon';
    return 'Good Evening';
  },

  staggerReveal: (container, selector = '.card-reveal', baseDelay = 0) => {
    const items = container.querySelectorAll(selector);
    items.forEach((item, i) => {
      setTimeout(() => {
        item.classList.add('visible');
      }, baseDelay + i * 60);
    });
  },

  getTheme: () => {
    const fallback = window.FF_THEME_DEFAULT || 'backroom-amp';
    const theme = localStorage.getItem('theme') || fallback;
    return window.Utils.getThemeMap()[theme] ? theme : fallback;
  },

  applyThemeColorMeta: (themeId) => {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) return;
    const theme = window.Utils.getThemeMap()[themeId || window.Utils.getTheme()];
    const fallback = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
    const color = fallback || theme?.metaColor || theme?.vars?.['--accent'];
    if (color) meta.setAttribute('content', color);
  },

  setTheme: (themeId) => {
    const fallback = window.FF_THEME_DEFAULT || 'backroom-amp';
    const value = window.Utils.getThemeMap()[themeId] ? themeId : fallback;
    localStorage.setItem('theme', value);
    document.documentElement.dataset.theme = value;
    if (document.body) document.body.dataset.theme = value;
    window.ThemeOverrides?.applyOverrides?.(value);
    window.Utils.applyThemeColorMeta(value);
    window.Utils.applyHeroSettings();
    return value;
  },

  isLeftHanded: () => (localStorage.getItem('handedness') || 'right') === 'left',

  getBpmStep: () => {
    const raw = parseInt(localStorage.getItem('bpmStep') || '2', 10);
    return Number.isFinite(raw) && raw > 0 ? raw : 2;
  },

  getDefaultSessionMinutes: () => {
    const raw = parseInt(localStorage.getItem('defaultSessionMinutes') || '20', 10);
    return Number.isFinite(raw) && raw > 0 ? raw : 20;
  },

  getDisplayName: () => (localStorage.getItem('displayName') || '').trim(),

  readLocalJson: (key, fallback = null) => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  },

  writeLocalJson: (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  },

  getLastPractice: () => {
    const raw = window.Utils.readLocalJson('df_last_practice', null);
    if (!raw || typeof raw !== 'object') return null;
    return raw;
  },

  setLastPractice: (patch = {}) => {
    const now = Date.now();
    const current = window.Utils.getLastPractice() || {};
    const next = {
      tool: null,
      key_root: null,
      key_mode: null,
      progression_id: null,
      scale_id: null,
      chord_id: null,
      bpm: null,
      beats_per_chord: null,
      countin_enabled: null,
      countin_bars: null,
      playlist_id: null,
      video_id: null,
      started_at: current.started_at || now,
      updated_at: now,
      ...current,
      ...patch,
      updated_at: now,
    };
    if (!next.started_at) next.started_at = now;
    window.Utils.writeLocalJson('df_last_practice', next);
    return next;
  },

  renderPageHero: ({ title = '', subtitle = '', leftExtra = '', actions = '', image = '', texture = true, extraClasses = '' } = {}) => {
    const heroClasses = `page-hero page-hero--img ${texture ? 'vert-texture' : ''} ${extraClasses}`.trim();
    return `
      <div class="${heroClasses}">
        <div class="page-hero__inner">
          <div class="ff-hero__layout">
            <div class="ff-hero__left">
              <div class="page-title">${title}</div>
              ${subtitle ? `<p style="font-family:var(--f-mono);font-size:12px;color:var(--text2);max-width:760px;">${subtitle}</p>` : ''}
              ${leftExtra || ''}
            </div>
            <div class="ff-hero__right">${actions || ''}</div>
          </div>
        </div>
        <div class="fret-line"></div>
      </div>
    `;
  },

  renderBreadcrumbs: (items = []) => {
    const crumbs = Array.isArray(items) ? items : [];
    const safe = (value) => String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
    if (!crumbs.length) return '';
    const body = crumbs.map((item, index) => {
      const label = safe(item?.label || '');
      const isLast = index === crumbs.length - 1;
      const href = item?.href;
      if (!isLast && href) {
        return `<a class="training-breadcrumb__link" href="${safe(href)}">${label}</a>`;
      }
      return `<span class="training-breadcrumb__current" aria-current="${isLast ? 'page' : 'false'}">${label}</span>`;
    }).join('<span class="training-breadcrumb__sep" aria-hidden="true">›</span>');
    return `<nav class="training-breadcrumbs" aria-label="Breadcrumb">${body}</nav>`;
  },
};

// __FF_TOAST__
// Simple toast notifications: Utils.toast("Saved", "success"|"error")
window.Utils = window.Utils || {};
Utils.toast = Utils.toast || function(message, type = 'success', ms = 2400) {
  const id = 'df-toast-root';
  let root = document.getElementById(id);
  if (!root) {
    root = document.createElement('div');
    root.id = id;
    root.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:9999;display:flex;flex-direction:column;gap:10px;max-width:420px;';
    document.body.appendChild(root);
  }

  const el = document.createElement('div');
  const border = type === 'error' ? 'var(--red)' : 'var(--accent)';
  el.style.cssText =
    'padding:12px 14px;border-radius:12px;border:1px solid ' + border +
    ';background:var(--panel);backdrop-filter:blur(10px);color:var(--text);font-family:system-ui;box-shadow:0 10px 30px rgba(0,0,0,.35);';
  el.textContent = message;

  root.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(6px)';
    el.style.transition = 'opacity 220ms ease, transform 220ms ease';
    setTimeout(() => el.remove(), 260);
  }, ms);
};
