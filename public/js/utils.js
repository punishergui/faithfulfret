// Daily Fret — Utils
// Exposes window.Utils

window.Utils = {
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
  const border = type === 'error' ? '#ff3b30' : '#ff6a00';
  el.style.cssText =
    'padding:12px 14px;border-radius:12px;border:1px solid ' + border +
    ';background:rgba(0,0,0,.72);backdrop-filter:blur(10px);color:#fff;font-family:system-ui;box-shadow:0 10px 30px rgba(0,0,0,.35);';
  el.textContent = message;

  root.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(6px)';
    el.style.transition = 'opacity 220ms ease, transform 220ms ease';
    setTimeout(() => el.remove(), 260);
  }, ms);
};
