window.ManualData = {
  toc: null,
  index: null,
  pageCache: new Map(),

  normalizeSlug(slug) {
    const incoming = String(slug || '').replace(/^\/+/, '').replace(/\.\./g, '');
    return incoming;
  },

  slugifyTitle(title) {
    return WikiStorage.slugify(title);
  },

  async loadToc(force = false) {
    if (this.toc && !force) return this.toc;
    this.toc = await WikiStorage.getToc();
    return this.toc;
  },

  async saveToc(toc) {
    await WikiStorage.saveToc(toc);
    this.toc = toc;
  },

  async loadBuiltInIndex() {
    if (this.index) return this.index;
    const res = await fetch('/manual/search-index.json');
    if (!res.ok) throw new Error('Failed to load manual search index');
    this.index = await res.json();
    return this.index;
  },

  async loadMergedIndex() {
    const [built, customPages] = await Promise.all([
      this.loadBuiltInIndex(),
      WikiStorage.getAllPages(),
    ]);

    const map = new Map((built.docs || []).map(d => [d.slug, { ...d, builtIn: true }]));
    for (const page of customPages) {
      map.set(page.slug, {
        slug: page.slug,
        title: page.title || page.slug,
        text: WikiSearch.strip(page.body || ''),
        tags: page.tags || [],
        sections: [page.sectionId || 'my-wiki'],
        links: [],
        isCustom: true,
      });
    }
    return { docs: Array.from(map.values()), backlinks: built.backlinks || {} };
  },

  async loadPage(slug) {
    const safe = this.normalizeSlug(slug);
    if (this.pageCache.has(safe)) return this.pageCache.get(safe);

    const custom = await WikiStorage.getPage(safe);
    if (custom && !custom.builtIn) {
      this.pageCache.set(safe, custom.body || '');
      return custom.body || '';
    }

    const res = await fetch(`/manual/pages/${safe}.md`);
    if (!res.ok) throw new Error('Page not found');
    const md = await res.text();
    this.pageCache.set(safe, md);
    return md;
  },

  async getCustomPage(slug) {
    const p = await WikiStorage.getPage(slug);
    return p?.builtIn ? null : p;
  },

  async getCustomPages() {
    return WikiStorage.getAllPages();
  },

  async saveCustomPage(data) {
    const saved = await WikiStorage.savePage(data);
    this.pageCache.set(saved.slug, saved.body || '');
    await WikiSearch.rebuild();
    return saved;
  },

  async deleteCustomPage(slug) {
    await WikiStorage.deletePage(slug);
    this.pageCache.delete(slug);
    await WikiSearch.rebuild();
  },

  async search(query) {
    const q = String(query || '').trim();
    if (!q) {
      const idx = await this.loadMergedIndex();
      return idx.docs;
    }
    const results = await WikiSearch.search(q);
    if (results.length) return results;

    const idx = await this.loadMergedIndex();
    const low = q.toLowerCase();
    return idx.docs.filter(d => `${d.title} ${d.text}`.toLowerCase().includes(low));
  },

  async backlinksFor(slug) {
    const idx = await this.loadBuiltInIndex();
    return idx.backlinks?.[slug] || [];
  },

  async relatedFor(slug, limit = 4) {
    const idx = await this.loadMergedIndex();
    const doc = idx.docs.find(d => d.slug === slug);
    if (!doc) return [];

    const tags = new Set(doc.tags || []);
    return idx.docs
      .filter(d => d.slug !== slug)
      .map(d => ({ d, n: (d.tags || []).filter(t => tags.has(t)).length }))
      .filter(x => x.n > 0)
      .sort((a, b) => b.n - a.n)
      .slice(0, limit)
      .map(x => x.d);
  },
};
