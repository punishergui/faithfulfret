window.WikiStorage = {
  DB_NAME: 'daily-fret-wiki',
  DB_VERSION: 1,
  _dbPromise: null,
  _blobUrls: new Map(),

  async db() {
    if (this._dbPromise) return this._dbPromise;
    const idb = window.idb;
    if (!idb) throw new Error('IndexedDB library unavailable');

    this._dbPromise = idb.openDB(this.DB_NAME, this.DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('pages')) {
          const s = db.createObjectStore('pages', { keyPath: 'slug' });
          s.createIndex('updatedAt', 'updatedAt');
          s.createIndex('sectionId', 'sectionId');
        }
        if (!db.objectStoreNames.contains('assets')) {
          const s = db.createObjectStore('assets', { keyPath: 'id' });
          s.createIndex('updatedAt', 'updatedAt');
        }
        if (!db.objectStoreNames.contains('meta')) {
          db.createObjectStore('meta', { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains('search')) {
          db.createObjectStore('search', { keyPath: 'slug' });
        }
      },
    });
    return this._dbPromise;
  },

  slugify(text) {
    return String(text || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  },

  async getMode() {
    const db = await this.db();
    const rec = await db.get('meta', 'storageMode');
    return rec?.value || 'idb';
  },

  async setMode(mode) {
    const db = await this.db();
    const safe = mode === 'server' ? 'server' : 'idb';
    await db.put('meta', { key: 'storageMode', value: safe, updatedAt: Date.now() });
    return safe;
  },

  async getSettings() {
    const db = await this.db();
    const rec = await db.get('meta', 'settings');
    return rec?.value || { autosaveMs: 900, splitPreview: true };
  },

  async setSettings(settings) {
    const db = await this.db();
    await db.put('meta', { key: 'settings', value: settings, updatedAt: Date.now() });
  },

  async loadBuiltInToc() {
    const res = await fetch('/manual/toc.json');
    if (!res.ok) throw new Error('Failed to load TOC');
    return res.json();
  },

  async getToc() {
    const db = await this.db();
    const rec = await db.get('meta', 'wikiToc');
    if (rec?.value?.length) return rec.value;

    const base = await this.loadBuiltInToc();
    const localRoot = { id: 'local-root', title: 'My Wiki', children: [] };
    const merged = base.concat(localRoot);
    await this.saveToc(merged);
    return merged;
  },

  async saveToc(toc) {
    const db = await this.db();
    await db.put('meta', { key: 'wikiToc', value: toc, updatedAt: Date.now() });
  },

  flattenToc(nodes, out = []) {
    for (const n of nodes || []) {
      out.push(n);
      if (Array.isArray(n.children)) this.flattenToc(n.children, out);
    }
    return out;
  },

  async getAllPages() {
    const db = await this.db();
    const idbPages = await db.getAll('pages');

    let serverPages = [];
    if (await this.getMode() === 'server') {
      try {
        const res = await fetch('/api/wiki/pages');
        if (res.ok) serverPages = await res.json();
      } catch (e) {
        console.warn('Server pages unavailable, using IndexedDB only', e);
      }
    }

    const map = new Map();
    for (const p of idbPages) map.set(p.slug, { ...p, source: 'idb' });
    for (const p of serverPages) map.set(p.slug, { ...p, source: 'server' });

    return Array.from(map.values()).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  },

  async getPage(slug) {
    const safeSlug = this.slugify(slug);
    const db = await this.db();

    if (await this.getMode() === 'server') {
      try {
        const res = await fetch(`/api/wiki/pages/${encodeURIComponent(safeSlug)}`);
        if (res.ok) return res.json();
      } catch (e) {
        console.warn('Server page unavailable', e);
      }
    }

    const local = await db.get('pages', safeSlug);
    if (local) return local;

    try {
      const res = await fetch(`/manual/pages/${safeSlug}.md`);
      if (!res.ok) return null;
      const body = await res.text();
      return { slug: safeSlug, title: safeSlug, body, tags: [], sectionId: null, builtIn: true };
    } catch {
      return null;
    }
  },

  async savePage(page) {
    const db = await this.db();
    const now = Date.now();
    const slug = this.slugify(page.slug || page.title);
    if (!slug) throw new Error('Slug required');

    const rec = {
      slug,
      title: String(page.title || slug),
      body: String(page.body || ''),
      tags: Array.isArray(page.tags) ? page.tags : [],
      sectionId: page.sectionId || 'local-root',
      status: page.status || 'published',
      updatedAt: now,
      createdAt: page.createdAt || now,
    };

    await db.put('pages', rec);

    if (await this.getMode() === 'server') {
      try {
        await fetch(`/api/wiki/pages/${encodeURIComponent(slug)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(rec),
        });
      } catch (e) {
        console.warn('Server page save failed, kept local copy', e);
      }
    }

    return rec;
  },

  async deletePage(slug) {
    const safeSlug = this.slugify(slug);
    const db = await this.db();
    await db.delete('pages', safeSlug);

    if (await this.getMode() === 'server') {
      try {
        await fetch(`/api/wiki/pages/${encodeURIComponent(safeSlug)}`, { method: 'DELETE' });
      } catch (e) {
        console.warn('Server page delete failed', e);
      }
    }
  },

  async duplicatePage(slug) {
    const current = await this.getPage(slug);
    if (!current) throw new Error('Page not found');
    const nextSlug = this.slugify(`${current.slug}-copy-${Date.now().toString().slice(-4)}`);
    return this.savePage({ ...current, slug: nextSlug, title: `${current.title} (copy)` });
  },

  async saveAssetFromFile(file, pageTitle = 'image') {
    if (!file) throw new Error('No file selected');
    if (!file.type.startsWith('image/')) throw new Error('Only image files are allowed');
    if (file.size > 10 * 1024 * 1024) throw new Error('Image too large (max 10MB)');

    const ext = (file.name.split('.').pop() || 'png').toLowerCase();
    const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 16);
    const filename = `${this.slugify(pageTitle || 'image')}-${stamp}.${ext}`;
    const id = `asset_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    const rec = {
      id,
      filename,
      mimeType: file.type,
      size: file.size,
      caption: '',
      widthPct: 100,
      updatedAt: Date.now(),
      createdAt: Date.now(),
      blob: file,
    };

    const db = await this.db();
    await db.put('assets', rec);

    if (await this.getMode() === 'server') {
      try {
        const b64 = await this.fileToBase64(file);
        const res = await fetch('/api/wiki/assets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename, mimeType: file.type, base64: b64 }),
        });
        if (res.ok) {
          const data = await res.json();
          return { ...rec, serverPath: data.path, embed: `![${filename}](${data.path})` };
        }
      } catch (e) {
        console.warn('Server asset upload failed, using IndexedDB asset', e);
      }
    }

    return { ...rec, embed: `![${filename}](wiki-asset://${id})` };
  },

  async fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  },

  async getAllAssets() {
    const db = await this.db();
    const all = await db.getAll('assets');
    return all.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  },

  async updateAssetMeta(id, patch) {
    const db = await this.db();
    const rec = await db.get('assets', id);
    if (!rec) throw new Error('Asset not found');
    const next = { ...rec, ...patch, updatedAt: Date.now() };
    await db.put('assets', next);
    return next;
  },

  async deleteAsset(id) {
    const db = await this.db();
    await db.delete('assets', id);
    const old = this._blobUrls.get(id);
    if (old) URL.revokeObjectURL(old);
    this._blobUrls.delete(id);
  },

  async resolveAssetUrl(ref) {
    if (!ref || !String(ref).startsWith('wiki-asset://')) return ref;
    const id = String(ref).replace('wiki-asset://', '');
    if (this._blobUrls.has(id)) return this._blobUrls.get(id);
    const db = await this.db();
    const rec = await db.get('assets', id);
    if (!rec?.blob) return '';
    const url = URL.createObjectURL(rec.blob);
    this._blobUrls.set(id, url);
    return url;
  },
};
