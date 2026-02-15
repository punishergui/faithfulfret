window.Pages = window.Pages || {};

Pages.ManualEditor = {
  async render(slugParam) {
    const app = document.getElementById('app');
    const isNew = !slugParam || slugParam === 'new';
    const safeSlug = isNew ? '' : ManualData.normalizeSlug(slugParam);
    const existing = isNew ? null : await ManualData.getCustomPage(safeSlug);

    app.innerHTML = `
      <div class="manual-page">
        <div class="manual-topbar">
          <a href="#/manual" class="manual-title">Manual Wiki</a>
          <div></div>
          <a href="${isNew ? '#/manual' : `#/manual/${safeSlug}` }" class="manual-toplink">Cancel</a>
        </div>

        <div class="manual-layout">
          <section class="manual-main" style="grid-column:1 / -1;">
            <div class="manual-breadcrumb">Manual Wiki / ${isNew ? 'New page' : 'Edit page'}</div>
            <h1>${isNew ? 'Create Wiki Page' : `Edit: ${existing?.title || safeSlug}`}</h1>
            <p class="manual-intro">Supports markdown: headings, lists, links, images, and [[Wiki Links]]. All changes are saved locally in the app database.</p>

            <form id="manual-edit-form" class="manual-editor-form">
              <label class="manual-editor-label">Title</label>
              <input class="manual-search" id="wiki-title" required value="${this._esc(existing?.title || '')}" placeholder="My Amp Presets">

              <label class="manual-editor-label">Slug</label>
              <input class="manual-search" id="wiki-slug" required value="${this._esc(safeSlug)}" placeholder="my-amp-presets">

              <label class="manual-editor-label">Tags (comma separated)</label>
              <input class="manual-search" id="wiki-tags" value="${this._esc((existing?.tags || []).join(', '))}" placeholder="preset, clean, lead">

              <label class="manual-editor-label">Content (Markdown)</label>
              <textarea id="wiki-body" class="manual-editor-textarea" placeholder="# My Page\n\n- bullet\n- bullet\n\n![alt](https://...)\n\n[link](https://...)\n\n[[Another Page]]">${this._esc(existing?.body || '')}</textarea>

              <div class="manual-toolbar">
                <button type="submit" class="df-btn">Save page</button>
                <a href="#/manual" class="df-btn df-btn--outline">Back</a>
              </div>
            </form>
          </section>
        </div>
      </div>
    `;

    const form = app.querySelector('#manual-edit-form');
    const titleEl = app.querySelector('#wiki-title');
    const slugEl = app.querySelector('#wiki-slug');
    const tagsEl = app.querySelector('#wiki-tags');
    const bodyEl = app.querySelector('#wiki-body');

    titleEl?.addEventListener('input', () => {
      if (!slugEl.dataset.touched) {
        slugEl.value = ManualData.slugifyTitle(titleEl.value);
      }
    });

    slugEl?.addEventListener('input', () => {
      slugEl.dataset.touched = '1';
    });

    form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const title = titleEl.value.trim();
      const slug = ManualData.slugifyTitle(slugEl.value.trim());
      const body = bodyEl.value;
      const tags = tagsEl.value.split(',').map(x => x.trim()).filter(Boolean);

      const saved = await ManualData.saveCustomPage({ slug, title, body, tags });
      go(`#/manual/${saved.slug}`);
    });
  },

  _esc(v) {
    return String(v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  },
};
