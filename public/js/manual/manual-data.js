window.ManualData = {
  toc: null,
  index: null,
  pageCache: new Map(),

  normalizeSlug(slug) {
    const aliases = {
      'no-sound-troubleshooting': 'troubleshooting/no-sound',
      'front-panel-controls': 'features/front-panel-controls',
      'factory-reset-recovery': 'troubleshooting/factory-reset',
    };
    const incoming = String(slug || '').replace(/^\/+/, '').replace(/\.\./g, '');
    return aliases[incoming] || incoming;
  },

  async loadToc() {
    if (this.toc) return this.toc;
    const res = await fetch('/manual/toc.json');
    if (!res.ok) throw new Error('Failed to load table of contents');
    this.toc = await res.json();
    return this.toc;
  },

  async loadIndex() {
    if (this.index) return this.index;
    const res = await fetch('/manual/search-index.json');
    if (!res.ok) throw new Error('Failed to load manual search index');
    this.index = await res.json();
    return this.index;
  },

  async loadPage(slug) {
    const safe = this.normalizeSlug(slug);
    if (this.pageCache.has(safe)) return this.pageCache.get(safe);
    const res = await fetch(`/manual/pages/${safe}.md`);
    if (!res.ok) throw new Error('Page not found');
    const md = await res.text();
    this.pageCache.set(safe, md);
    return md;
  },

  async search(query) {
    const idx = await this.loadIndex();
    const q = query.trim().toLowerCase();
    if (!q) return idx.docs;
    return idx.docs
      .map(d => {
        const hay = `${d.title} ${d.text} ${d.tags.join(' ')} ${d.sections.join(' ')}`.toLowerCase();
        const score = (hay.match(new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
        return { doc: d, score };
      })
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(x => x.doc);
  },

  async backlinksFor(slug) {
    const idx = await this.loadIndex();
    return idx.backlinks[slug] || [];
  },

  async relatedFor(slug, limit = 4) {
    const idx = await this.loadIndex();
    const doc = idx.docs.find(d => d.slug === slug);
    if (!doc) return [];

    const byLinks = idx.docs.filter(d => d.slug !== slug && (doc.links.includes(d.slug) || d.links.includes(slug)));
    if (byLinks.length >= limit) return byLinks.slice(0, limit);

    const tags = new Set(doc.tags || []);
    const similar = idx.docs
      .filter(d => d.slug !== slug && !byLinks.some(x => x.slug === d.slug))
      .map(d => ({ d, n: d.tags.filter(t => tags.has(t)).length }))
      .filter(x => x.n > 0)
      .sort((a, b) => b.n - a.n)
      .map(x => x.d);

    return byLinks.concat(similar).slice(0, limit);
  },
};
