window.Pages = window.Pages || {};

Pages.ManualEditor = {
  _autosaveTimer: null,

  async render(slugParam) {
    const app = document.getElementById('app');
    const isNew = !slugParam || slugParam === 'new';
    const page = isNew
      ? { slug: '', title: '', body: '# New Page\n\nStart writing...', tags: [], sectionId: 'local-root', status: 'draft' }
      : (await WikiStorage.getPage(slugParam)) || { slug: slugParam, title: slugParam, body: '', tags: [], sectionId: 'local-root', status: 'draft' };

    app.innerHTML = `
      <div class="manual-page">
        <div class="manual-topbar">
          <a href="#/manual" class="manual-title">Wiki Editor</a>
          <div class="manual-save-state" id="wiki-save-state">Saved</div>
          <a href="${isNew ? '#/manual' : `#/manual/${page.slug}`}" class="manual-toplink">Back</a>
        </div>

        <div class="manual-layout manual-layout--wiki">
          <aside class="manual-sidebar">
            <div class="manual-editor-form">
              <label class="manual-editor-label">Title</label>
              <input id="wiki-title" class="manual-search" value="${this._esc(page.title)}" placeholder="Page title">

              <label class="manual-editor-label">Slug</label>
              <input id="wiki-slug" class="manual-search" value="${this._esc(page.slug)}" placeholder="page-slug">

              <label class="manual-editor-label">Section</label>
              <input id="wiki-section" class="manual-search" value="${this._esc(page.sectionId || 'local-root')}" placeholder="local-root">

              <label class="manual-editor-label">Tags (comma separated)</label>
              <input id="wiki-tags" class="manual-search" value="${this._esc((page.tags || []).join(', '))}">

              <div class="manual-action-grid">
                <button class="df-btn" id="wiki-save">Save</button>
                <button class="df-btn df-btn--outline" id="wiki-publish">Publish (local)</button>
                <button class="df-btn df-btn--outline" id="wiki-rename">Rename</button>
                <button class="df-btn df-btn--outline" id="wiki-move">Move</button>
                <button class="df-btn df-btn--outline" id="wiki-duplicate">Duplicate</button>
                <button class="df-btn df-btn--outline" id="wiki-revert">Revert</button>
                <button class="df-btn df-btn--outline" id="wiki-delete">Delete</button>
              </div>
            </div>
          </aside>

          <section class="manual-main">
            <div class="manual-toolbar wiki-toolbar" id="wiki-toolbar">
              <button data-cmd="bold"><b>B</b></button>
              <button data-cmd="italic"><i>I</i></button>
              <button data-cmd="h1">H1</button>
              <button data-cmd="h2">H2</button>
              <button data-cmd="h3">H3</button>
              <button data-cmd="ul">• List</button>
              <button data-cmd="link">Link</button>
              <button data-cmd="code">Code</button>
              <button data-cmd="quote">Quote</button>
              <button data-cmd="table">Table</button>
              <button data-cmd="callout">Callout</button>
              <button data-cmd="image">Insert Image</button>
              <button data-cmd="file">Insert File</button>
              <button data-cmd="undo">Undo</button>
              <button data-cmd="redo">Redo</button>
            </div>

            <div class="wiki-tabs">
              <button class="active" data-view="edit">Edit</button>
              <button data-view="preview">Preview</button>
              <button data-view="split">Split</button>
            </div>

            <div class="wiki-edit-grid" id="wiki-edit-grid">
              <textarea id="wiki-body" class="manual-editor-textarea">${this._esc(page.body || '')}</textarea>
              <div id="wiki-preview" class="manual-content wiki-preview-pane" style="display:none;"></div>
            </div>
            <div class="manual-empty" id="wiki-error" style="display:none;"></div>
          </section>
        </div>
      </div>
    `;

    this._bindEditor(app, page, isNew);
  },

  async renderAssets() {
    const app = document.getElementById('app');
    const assets = await WikiStorage.getAllAssets();
    app.innerHTML = `
      <div class="manual-page">
        <div class="manual-topbar">
          <a href="#/manual" class="manual-title">Wiki Assets</a>
          <div></div>
          <a href="#/manual" class="manual-toplink">Back</a>
        </div>
        <div class="manual-layout">
          <section class="manual-main" style="grid-column:1/-1;">
            <h1>Image Manager</h1>
            <p class="manual-intro">Browse, rename, delete, and copy embed codes for local images.</p>
            <div class="manual-card-grid" id="wiki-assets-grid">
              ${assets.map(a => `
                <div class="manual-card" data-id="${a.id}">
                  <h3>${a.filename}</h3>
                  <p>${Math.round((a.size || 0) / 1024)} KB</p>
                  <code>![${a.filename}](wiki-asset://${a.id})</code>
                  <div class="manual-toolbar">
                    <button class="df-btn df-btn--outline" data-action="copy">Copy Embed</button>
                    <button class="df-btn df-btn--outline" data-action="rename">Rename</button>
                    <button class="df-btn df-btn--outline" data-action="delete">Delete</button>
                  </div>
                </div>
              `).join('') || '<div class="manual-empty">No local images yet.</div>'}
            </div>
          </section>
        </div>
      </div>
    `;

    app.querySelectorAll('#wiki-assets-grid .manual-card').forEach(card => {
      const id = card.dataset.id;
      card.querySelector('[data-action="copy"]')?.addEventListener('click', async () => {
        await navigator.clipboard.writeText(`![image](wiki-asset://${id})`);
      });
      card.querySelector('[data-action="rename"]')?.addEventListener('click', async () => {
        const rec = assets.find(x => x.id === id);
        const name = prompt('Rename file', rec?.filename || '');
        if (!name) return;
        await WikiStorage.updateAssetMeta(id, { filename: name });
        this.renderAssets();
      });
      card.querySelector('[data-action="delete"]')?.addEventListener('click', async () => {
        if (!confirm('Delete image asset?')) return;
        await WikiStorage.deleteAsset(id);
        this.renderAssets();
      });
    });
  },

  _bindEditor(app, page, isNew) {
    const titleEl = app.querySelector('#wiki-title');
    const slugEl = app.querySelector('#wiki-slug');
    const sectionEl = app.querySelector('#wiki-section');
    const tagsEl = app.querySelector('#wiki-tags');
    const bodyEl = app.querySelector('#wiki-body');
    const previewEl = app.querySelector('#wiki-preview');
    const saveState = app.querySelector('#wiki-save-state');
    const errorEl = app.querySelector('#wiki-error');

    let dirty = false;
    let snapshot = {
      title: titleEl.value,
      slug: slugEl.value,
      sectionId: sectionEl.value,
      tags: tagsEl.value,
      body: bodyEl.value,
    };

    const setDirty = (v) => {
      dirty = v;
      saveState.textContent = dirty ? 'Unsaved changes' : 'Saved';
      saveState.classList.toggle('is-dirty', dirty);
    };

    const insertAtCursor = (text) => {
      const start = bodyEl.selectionStart || 0;
      const end = bodyEl.selectionEnd || 0;
      bodyEl.value = bodyEl.value.slice(0, start) + text + bodyEl.value.slice(end);
      bodyEl.selectionStart = bodyEl.selectionEnd = start + text.length;
      bodyEl.focus();
      markChanged();
    };

    const showError = (msg = '') => {
      errorEl.style.display = msg ? 'block' : 'none';
      errorEl.textContent = msg;
    };

    const renderPreview = async () => {
      previewEl.innerHTML = ManualMarkdown.render(bodyEl.value);
      await ManualMarkdown.hydrateWikiAssets(previewEl);
    };

    const markChanged = () => {
      setDirty(true);
      clearTimeout(this._autosaveTimer);
      this._autosaveTimer = setTimeout(() => save('draft'), 900);
    };

    const readState = () => ({
      title: titleEl.value.trim(),
      slug: WikiStorage.slugify(slugEl.value.trim() || titleEl.value.trim()),
      sectionId: sectionEl.value.trim() || 'local-root',
      tags: tagsEl.value.split(',').map(x => x.trim()).filter(Boolean),
      body: bodyEl.value,
    });

    const save = async (status = 'draft') => {
      try {
        const next = readState();
        if (!next.slug) throw new Error('Slug is required');
        const saved = await ManualData.saveCustomPage({ ...page, ...next, status });
        snapshot = { ...next, tags: next.tags.join(', ') };
        setDirty(false);
        showError('');
        if (isNew && status === 'published') go(`#/manual/${saved.slug}`);
      } catch (e) {
        showError(e.message || 'Save failed');
      }
    };

    [titleEl, slugEl, sectionEl, tagsEl, bodyEl].forEach(el => el?.addEventListener('input', markChanged));
    titleEl?.addEventListener('input', () => {
      if (!slugEl.dataset.touched) slugEl.value = WikiStorage.slugify(titleEl.value);
    });
    slugEl?.addEventListener('input', () => slugEl.dataset.touched = '1');

    app.querySelector('#wiki-save')?.addEventListener('click', () => save('draft'));
    app.querySelector('#wiki-publish')?.addEventListener('click', () => save('published'));
    app.querySelector('#wiki-revert')?.addEventListener('click', () => {
      titleEl.value = snapshot.title;
      slugEl.value = snapshot.slug;
      sectionEl.value = snapshot.sectionId;
      tagsEl.value = snapshot.tags;
      bodyEl.value = snapshot.body;
      setDirty(false);
      renderPreview();
    });
    app.querySelector('#wiki-duplicate')?.addEventListener('click', async () => {
      const s = readState();
      const saved = await ManualData.saveCustomPage({ ...s, slug: `${s.slug}-copy` });
      go(`#/manual/edit/${saved.slug}`);
    });
    app.querySelector('#wiki-rename')?.addEventListener('click', () => {
      const n = prompt('New title', titleEl.value);
      if (n) titleEl.value = n;
      markChanged();
    });
    app.querySelector('#wiki-move')?.addEventListener('click', () => {
      const n = prompt('Section/folder ID', sectionEl.value);
      if (n) sectionEl.value = n;
      markChanged();
    });
    app.querySelector('#wiki-delete')?.addEventListener('click', async () => {
      const slug = WikiStorage.slugify(slugEl.value);
      if (!slug) return go('#/manual');
      if (!confirm('Delete this page?')) return;
      await ManualData.deleteCustomPage(slug);
      go('#/manual');
    });

    const toolbarMap = {
      bold: () => insertAtCursor('**bold**'),
      italic: () => insertAtCursor('*italic*'),
      h1: () => insertAtCursor('\n# Heading 1\n'),
      h2: () => insertAtCursor('\n## Heading 2\n'),
      h3: () => insertAtCursor('\n### Heading 3\n'),
      ul: () => insertAtCursor('\n- list item\n'),
      link: () => insertAtCursor('[link text](https://)'),
      code: () => insertAtCursor('\n```\ncode\n```\n'),
      quote: () => insertAtCursor('\n> quoted text\n'),
      table: () => insertAtCursor('\n| Col A | Col B |\n|---|---|\n| x | y |\n'),
      callout: () => insertAtCursor('\n:::note\nCallout text\n:::\n'),
      file: () => insertAtCursor('[file name](/manual/assets_local/your-file.ext)'),
      undo: () => document.execCommand('undo'),
      redo: () => document.execCommand('redo'),
    };

    const pickAndInsert = WikiAssets.bindEditor({
      textarea: bodyEl,
      onInsert: (markdown) => insertAtCursor(`\n${markdown}\n`),
      getPageTitle: () => titleEl.value,
      onError: (msg) => showError(msg),
    });

    app.querySelectorAll('#wiki-toolbar [data-cmd]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const cmd = btn.dataset.cmd;
        if (cmd === 'image') return pickAndInsert();
        const fn = toolbarMap[cmd];
        if (fn) fn();
      });
    });

    const setView = async (mode) => {
      const grid = app.querySelector('#wiki-edit-grid');
      app.querySelectorAll('.wiki-tabs button').forEach(b => b.classList.toggle('active', b.dataset.view === mode));
      if (mode === 'edit') {
        bodyEl.style.display = 'block';
        previewEl.style.display = 'none';
      } else if (mode === 'preview') {
        bodyEl.style.display = 'none';
        previewEl.style.display = 'block';
        await renderPreview();
      } else {
        bodyEl.style.display = 'block';
        previewEl.style.display = 'block';
        grid.classList.add('split');
        await renderPreview();
      }
      if (mode !== 'split') grid.classList.remove('split');
    };

    app.querySelectorAll('.wiki-tabs button').forEach(btn => {
      btn.addEventListener('click', () => setView(btn.dataset.view));
    });

    window.onbeforeunload = () => dirty ? 'Unsaved wiki changes' : null;
    setView('split');
    setDirty(false);
  },

  _esc(v) {
    return String(v || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  },
};
