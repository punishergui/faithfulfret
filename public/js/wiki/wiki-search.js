window.WikiSearch = {
  strip(md) {
    return String(md || '')
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/!\[[^\]]*\]\(([^)]+)\)/g, ' ')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
      .replace(/\[\[([^\]]+)\]\]/g, '$1')
      .replace(/[#>*_`~-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  },

  async rebuild() {
    const db = await WikiStorage.db();
    const pages = await WikiStorage.getAllPages();
    const tx = db.transaction('search', 'readwrite');
    await tx.store.clear();

    for (const p of pages) {
      const text = this.strip(p.body || p.text || '');
      await tx.store.put({
        slug: p.slug,
        title: p.title || p.slug,
        text,
        tags: p.tags || [],
        updatedAt: Date.now(),
      });
    }

    await tx.done;
    return pages.length;
  },

  async search(query) {
    const db = await WikiStorage.db();
    const all = await db.getAll('search');
    const q = String(query || '').trim().toLowerCase();
    if (!q) return all.slice(0, 40).map(x => ({ ...x, snippet: x.text.slice(0, 180) }));

    const safe = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const rx = new RegExp(safe, 'ig');

    return all
      .map(item => {
        const hay = `${item.title} ${item.text} ${(item.tags || []).join(' ')}`;
        const hits = hay.match(rx)?.length || 0;
        if (!hits) return null;

        const idx = item.text.toLowerCase().indexOf(q);
        const start = Math.max(0, idx - 60);
        const end = Math.min(item.text.length, idx + q.length + 90);
        const raw = item.text.slice(start, end);
        const snippet = raw.replace(rx, m => `**${m}**`);
        return { ...item, score: hits, snippet };
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score)
      .slice(0, 60);
  },
};
