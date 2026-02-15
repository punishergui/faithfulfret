// Daily Fret — Utils
// Exposes window.Utils

window.Utils = {
  uuid: () => crypto.randomUUID(),

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

  ytThumb: (videoId, quality = 'mqdefault') =>
    videoId ? `https://img.youtube.com/vi/${videoId}/${quality}.jpg` : null,

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
