window.Pages = window.Pages || {};

Pages.ManualArticle = {
  async render(slug) {
    const app = document.getElementById('app');
    app.innerHTML = '<div class="manual-page"><div class="manual-loading">Loading article...</div></div>';

    try {
      const [toc, index, md, backlinks, related] = await Promise.all([
        ManualData.loadToc(),
        ManualData.loadIndex(),
        ManualData.loadPage(slug),
        ManualData.backlinksFor(slug),
        ManualData.relatedFor(slug),
      ]);

      const doc = index.docs.find(d => d.slug === slug);
      const html = ManualMarkdown.render(md);
      const breadcrumbs = this._breadcrumbs(toc, slug);

      app.innerHTML = `
        <div class="manual-page">
          <div class="manual-topbar">
            <button class="manual-drawer-btn" id="manual-drawer-btn">☰</button>
            <a href="#/manual" class="manual-title">Manual Wiki</a>
            <a href="#/manual/search?q=${encodeURIComponent(doc?.title || '')}" class="manual-toplink">Search similar</a>
          </div>

          <div class="manual-layout">
            <aside class="manual-sidebar">${Pages.ManualHome._toc(toc)}</aside>
            <section class="manual-main">
              <div class="manual-breadcrumb">${breadcrumbs}</div>
              <h1>${doc?.title || slug}</h1>
              <div class="manual-content">${html}</div>

              <div class="manual-panels">
                <div class="manual-panel">
                  <h3>Troubleshooting links</h3>
                  <a href="#/manual/troubleshooting/no-sound">No Sound Troubleshooting</a>
                </div>
                <div class="manual-panel">
                  <h3>Related pages</h3>
                  ${related.length ? related.map(r => `<a href="#/manual/${r.slug}">${r.title}</a>`).join('') : '<span>None yet.</span>'}
                </div>
              </div>

              <div class="manual-backlinks">
                <h3>Linked from</h3>
                ${backlinks.length ? backlinks.map(b => `<a href="#/manual/${b.slug}">${b.title}</a>`).join('') : '<div class="manual-empty">No backlinks yet.</div>'}
              </div>
            </section>
          </div>
        </div>
      `;

      ManualMarkdown.bindHotspots(app);
      app.querySelector('#manual-drawer-btn')?.addEventListener('click', () => {
        app.querySelector('.manual-sidebar')?.classList.toggle('open');
      });
    } catch (e) {
      app.innerHTML = `<div class="manual-page"><div class="manual-error">Article not found.</div></div>`;
    }
  },

  _breadcrumbs(toc, slug) {
    const trail = [];
    const walk = (nodes, parents = []) => {
      for (const n of nodes) {
        if (n.slug === slug) return parents.concat(n.title);
        if (n.children) {
          const t = walk(n.children, parents.concat(n.title));
          if (t) return t;
        }
      }
      return null;
    };
    const found = walk(toc) || ['Manual', slug];
    return found.join(' / ');
  },
};
