window.Pages = window.Pages || {};

Pages.ManualHome = {
  async render() {
    const app = document.getElementById('app');
    app.innerHTML = this._shell('<div class="manual-loading">Loading manual...</div>');

    try {
      const [toc, index, customPages] = await Promise.all([
        ManualData.loadToc(),
        ManualData.loadMergedIndex(),
        ManualData.getCustomPages(),
      ]);
      const q = this._query();
      const results = q ? await ManualData.search(q) : [];

      app.innerHTML = this._shell(`
        <div class="manual-layout">
          <aside class="manual-sidebar">${this._toc(this._withCustomToc(toc, customPages))}</aside>
          <section class="manual-main">
            <div class="manual-breadcrumb">Manual Wiki / ${q ? 'Search' : 'Home'}</div>
            <h1>${q ? `Search: "${q}"` : 'Peavey Vypyr X2 Manual Wiki'}</h1>
            <p class="manual-intro">Search local docs, browse sections, and edit your own pages offline.</p>
            <div class="manual-toolbar">
              <a class="df-btn" href="#/manual/edit/new">+ New Wiki Page</a>
            </div>
            ${q ? this._results(results) : this._homeCards(index.docs)}
          </section>
        </div>
      `);

      this._bindSearch(app);
      this._bindDrawer(app);
    } catch (e) {
      app.innerHTML = this._shell(`<div class="manual-error">Manual failed to load: ${e.message}</div>`);
    }
  },

  _shell(content) {
    return `
      <div class="manual-page">
        <div class="manual-topbar">
          <button class="manual-drawer-btn" id="manual-drawer-btn">☰</button>
          <a href="#/manual" class="manual-title">Manual Wiki</a>
          <form id="manual-search-form" class="manual-search-wrap">
            <input id="manual-search" class="manual-search" placeholder="Search manual..." value="${this._query()}">
          </form>
        </div>
        ${content}
      </div>
    `;
  },

  _withCustomToc(toc, customPages) {
    const mine = (customPages || [])
      .slice()
      .sort((a, b) => (a.title || '').localeCompare(b.title || ''))
      .map(p => ({ title: p.title || p.slug, slug: p.slug }));

    if (!mine.length) return toc;
    return toc.concat([{ title: 'My Wiki Pages', children: mine }]);
  },

  _query() {
    const hash = location.hash || '';
    const queryStr = hash.includes('?') ? hash.split('?')[1] : '';
    return (new URLSearchParams(queryStr).get('q') || '').trim();
  },

  _toc(toc) {
    return `<ul>${toc.map(item => `
      <li>
        ${item.slug ? `<a href="#/manual/${item.slug}">${item.title}</a>` : `<span class="manual-toc-heading">${item.title}</span>`}
        ${item.children ? this._toc(item.children) : ''}
      </li>
    `).join('')}</ul>`;
  },

  _homeCards(docs) {
    return `<div class="manual-card-grid">${docs.map(d => `
      <a class="manual-card" href="#/manual/${d.slug}">
        <h3>${d.title}${d.isCustom ? ' <span class="manual-pill">Custom</span>' : ''}</h3>
        <p>${(d.text || '').slice(0, 120)}...</p>
      </a>
    `).join('')}</div>`;
  },

  _results(results) {
    if (!results.length) return '<div class="manual-empty">No search results.</div>';
    return `<div class="manual-results">${results.map(d => `
      <a href="#/manual/${d.slug}" class="manual-result">
        <h3>${d.title}${d.isCustom ? ' <span class="manual-pill">Custom</span>' : ''}</h3>
        <p>${(d.text || '').slice(0, 180)}...</p>
      </a>
    `).join('')}</div>`;
  },

  _bindSearch(app) {
    app.querySelector('#manual-search-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const q = app.querySelector('#manual-search')?.value.trim() || '';
      go(q ? `#/manual/search?q=${encodeURIComponent(q)}` : '#/manual');
    });
  },

  _bindDrawer(app) {
    app.querySelector('#manual-drawer-btn')?.addEventListener('click', () => {
      app.querySelector('.manual-sidebar')?.classList.toggle('open');
    });
  },
};
