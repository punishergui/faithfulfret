window.Pages = window.Pages || {};

Pages.ManualHome = {
  async render() {
    const app = document.getElementById('app');
    app.innerHTML = this._shell('<div class="manual-loading">Loading wiki...</div>');

    try {
      await WikiSearch.rebuild();
      const toc = await ManualData.loadToc(true);

      app.innerHTML = this._shell(`
        <div class="manual-layout manual-layout--wiki">
          <aside class="manual-sidebar manual-sidebar--wiki">
            <div class="manual-sidebar-actions">
              <input id="wiki-side-search" class="manual-search" placeholder="Search wiki...">
              <div class="manual-action-grid">
                <a class="df-btn" href="#/manual/new">New Page</a>
                <button class="df-btn df-btn--outline" id="wiki-new-section">New Folder/Section</button>
                <a class="df-btn df-btn--outline" href="#/manual/assets">Upload / Insert Image</a>
                <button class="df-btn df-btn--outline" id="wiki-rebuild-search">Rebuild Search</button>
                <button class="df-btn df-btn--outline" id="wiki-settings">Settings</button>
              </div>
            </div>
            <div id="wiki-tree" class="wiki-tree-wrap">${this._toc(toc)}</div>
          </aside>

          <section class="manual-main">
            <div class="manual-breadcrumb">Wiki / Home</div>
            <h1>Local Wiki Workspace</h1>
            <p class="manual-intro">Create pages, drag to reorder navigation, and edit everything offline. Search results appear below.</p>
            <div id="wiki-search-results" class="manual-results"></div>
          </section>
        </div>
      `);

      this._bindDrawer(app);
      this._bindSidebarActions(app);
      this._bindTreeDnD(app);
    } catch (e) {
      app.innerHTML = this._shell(`<div class="manual-error">Wiki failed to load: ${e.message}</div>`);
    }
  },

  _shell(content) {
    return `
      <div class="manual-page">
        <div class="manual-topbar">
          <button class="manual-drawer-btn" id="manual-drawer-btn">☰</button>
          <a href="#/manual" class="manual-title">Wiki</a>
          <form id="manual-search-form" class="manual-search-wrap">
            <input id="manual-search" class="manual-search" placeholder="Search pages...">
          </form>
        </div>
        ${content}
      </div>
    `;
  },

  _toc(nodes) {
    return `<ul>${(nodes || []).map((item, idx) => `
      <li draggable="true" data-node-id="${item.id || item.slug || `n-${idx}`}">
        ${item.slug ? `<a href="#/manual/${item.slug}">${item.title}</a>` : `<span class="manual-toc-heading">${item.title}</span>`}
        ${item.children ? this._toc(item.children) : ''}
      </li>
    `).join('')}</ul>`;
  },

  async _bindSidebarActions(app) {
    const searchEl = app.querySelector('#wiki-side-search');
    const globalSearch = app.querySelector('#manual-search');
    const results = app.querySelector('#wiki-search-results');

    const runSearch = async (query) => {
      const rows = await ManualData.search(query);
      if (!rows.length) {
        results.innerHTML = '<div class="manual-empty">No results yet. Try another keyword.</div>';
        return;
      }
      results.innerHTML = rows.map(r => `
        <a href="#/manual/${r.slug}" class="manual-result">
          <h3>${r.title}</h3>
          <p>${(r.snippet || r.text || '').replace(/\*\*/g, '')}</p>
        </a>
      `).join('');
    };

    searchEl?.addEventListener('input', () => runSearch(searchEl.value));
    globalSearch?.form?.addEventListener('submit', (e) => {
      e.preventDefault();
      runSearch(globalSearch.value);
    });

    app.querySelector('#wiki-new-section')?.addEventListener('click', async () => {
      const name = prompt('New section/folder name');
      if (!name) return;
      const toc = await ManualData.loadToc(true);
      toc.push({ id: `section-${Date.now()}`, title: name, children: [] });
      await ManualData.saveToc(toc);
      this.render();
    });

    app.querySelector('#wiki-rebuild-search')?.addEventListener('click', async () => {
      const n = await WikiSearch.rebuild();
      alert(`Search rebuilt for ${n} pages.`);
    });

    app.querySelector('#wiki-settings')?.addEventListener('click', async () => {
      const mode = await WikiStorage.getMode();
      const next = confirm(`Storage mode is "${mode}". Click OK for server mode, Cancel for IndexedDB-only mode.`) ? 'server' : 'idb';
      await WikiStorage.setMode(next);
      alert(`Saved mode: ${next}`);
    });
  },

  _bindTreeDnD(app) {
    const tree = app.querySelector('#wiki-tree');
    if (!tree) return;

    let dragNode = null;
    tree.querySelectorAll('li[draggable="true"]').forEach(li => {
      li.addEventListener('dragstart', () => {
        dragNode = li;
        li.classList.add('wiki-dragging');
      });
      li.addEventListener('dragend', () => li.classList.remove('wiki-dragging'));
      li.addEventListener('dragover', (e) => e.preventDefault());
      li.addEventListener('drop', async (e) => {
        e.preventDefault();
        if (!dragNode || dragNode === li) return;
        li.parentElement.insertBefore(dragNode, li.nextSibling);
        await this._persistCurrentTree(tree);
      });
    });
  },

  async _persistCurrentTree(tree) {
    const parseList = (ul) => Array.from(ul.children).map(li => {
      const link = li.querySelector(':scope > a');
      const head = li.querySelector(':scope > .manual-toc-heading');
      const child = li.querySelector(':scope > ul');
      return {
        id: li.dataset.nodeId,
        title: link ? link.textContent : head?.textContent || 'Section',
        slug: link ? (link.getAttribute('href') || '').replace('#/manual/', '') : undefined,
        children: child ? parseList(child) : undefined,
      };
    });

    const root = tree.querySelector(':scope > ul');
    if (!root) return;
    const toc = parseList(root);
    await ManualData.saveToc(toc);
  },

  _bindDrawer(app) {
    app.querySelector('#manual-drawer-btn')?.addEventListener('click', () => {
      app.querySelector('.manual-sidebar')?.classList.toggle('open');
    });
  },
};
