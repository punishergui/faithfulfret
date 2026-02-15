// Daily Fret — Resources Page + Resource Form

window.Pages = window.Pages || {};

Pages.Resources = {
  async render() {
    const app = document.getElementById('app');
    app.innerHTML = '<div class="page-wrap" style="padding:60px 24px;text-align:center;"><p style="color:var(--text3);font-family:var(--f-mono);">Loading...</p></div>';

    const resources = await DB.getAllResources();

    // Group by category
    const byCategory = {};
    resources.forEach(r => {
      const cat = r.category || 'Other';
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push(r);
    });

    app.innerHTML = `
      <div class="page-hero page-hero--img vert-texture" style="background-image:url('https://images.unsplash.com/photo-1507838153414-b4b713384a76?w=1200&q=80');">
        <div class="page-hero__inner" style="display:flex;align-items:flex-end;justify-content:space-between;gap:20px;flex-wrap:wrap;">
          <div class="page-title">Resources</div>
          <a href="#/resources/add" class="df-btn df-btn--primary" style="margin-bottom:4px;">+ Add Resource</a>
        </div>
        <div class="fret-line"></div>
      </div>

      <div class="page-wrap" style="padding:24px 24px 60px;">
        ${resources.length ? this._renderByCategory(byCategory) : this._renderEmpty()}
      </div>
    `;
  },

  _renderByCategory(byCategory) {
    return Object.entries(byCategory).map(([cat, items]) => `
      <div class="cat-header">${cat} <span style="color:var(--text2);">(${items.length})</span></div>
      <div style="margin-bottom:24px;">
        <div style="display:grid;grid-template-columns:minmax(0,1fr) 110px 90px 130px;gap:14px;padding:8px 0;border-bottom:1px solid var(--line2);">
          <span class="df-label">Resource</span>
          <span class="df-label" style="text-align:center;">Level</span>
          <span class="df-label" style="text-align:center;">Rating</span>
          <span class="df-label" style="text-align:right;">Actions</span>
        </div>
        ${items.map(r => this._renderRow(r)).join('')}
      </div>
    `).join('');
  },

  _renderRow(r) {
    const stars = this._renderStars(r.rating || 0);
    const tags = r.tags ? r.tags.split(',').map(t => t.trim()).filter(Boolean) : [];
    const openUrl = r.url ? Utils.normalizeUrl(r.url) : '';

    return `
      <div class="resource-row">
        <div>
          ${openUrl
            ? `<a class="resource-row__name" href="${openUrl}" target="_blank" rel="noopener">${r.title}</a>`
            : `<div class="resource-row__name" onclick="go('#/resources/edit/${r.id}')" style="cursor:pointer;">${r.title}</div>`}
          ${r.author ? `<div class="resource-row__author">${r.author}</div>` : ''}
          ${r.notes ? `<div class="resource-row__notes">${Utils.truncate(r.notes, 100)}</div>` : ''}
          ${tags.length ? `<div class="resource-row__tags">${tags.map(t => `<span class="resource-row__tag">${t}</span>`).join('')}</div>` : ''}
        </div>
        <div class="resource-row__level">${r.level || ''}</div>
        <div class="resource-row__stars">${stars}</div>
        <div class="resource-row__link">
          ${openUrl ? `<a href="${openUrl}" target="_blank" rel="noopener" title="Open resource" class="resource-row__open-btn">Open</a>` : ''}
          <button type="button" class="resource-row__edit" onclick="go('#/resources/edit/${r.id}')" title="Edit resource">✎</button>
        </div>
      </div>
    `;
  },

  _renderStars(rating) {
    let out = '';
    for (let i = 1; i <= 5; i++) {
      out += i <= rating ? '★' : '☆';
    }
    return out;
  },

  _renderEmpty() {
    return `
      <div class="empty-state" style="padding:60px 0;">
        <div class="empty-state__title">No resources yet</div>
        <div class="empty-state__text">Add lessons, YouTube channels, apps, and books.</div>
        <a href="#/resources/add" class="df-btn df-btn--primary" style="margin:0 auto;">+ Add Resource</a>
        <div style="margin-top:32px;text-align:left;max-width:400px;margin-left:auto;margin-right:auto;">
          <div style="font-family:var(--f-mono);font-size:9px;letter-spacing:0.1em;text-transform:uppercase;color:var(--text3);margin-bottom:10px;">Suggestions</div>
          ${[
            ['JustinGuitar', 'https://justinguitar.com'],
            ['Marty Music', 'https://youtube.com/@MartyMusic'],
            ['Paul Davids', 'https://youtube.com/@PaulDavids'],
            ['TalkingGuitarTV', 'https://youtube.com/@TalkingGuitarTV'],
            ['ChordU', 'https://chordu.com'],
            ['Ultimate Guitar', 'https://ultimate-guitar.com'],
          ].map(([name, url]) => `
            <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--line);">
              <a href="${url}" target="_blank" rel="noopener" style="font-size:14px;color:var(--text2);text-decoration:none;">&rsaquo; ${name}</a>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  },
};

Pages.ResourceForm = {
  async render(id) {
    const app = document.getElementById('app');
    const isEdit = !!id;
    let resource = {};

    if (isEdit) {
      resource = await DB.getResource(id) || {};
    }

    const categories = ['Lessons', 'YouTube Channel', 'App', 'Tabs', 'Book', 'Podcast', 'Other'];
    const levels = ['Beginner', 'Intermediate', 'Advanced', 'All Levels'];

    app.innerHTML = `
      <div class="page-hero page-hero--img vert-texture" style="background-image:url('https://images.unsplash.com/photo-1507838153414-b4b713384a76?w=1200&q=80');">
        <div class="page-hero__inner">
          <div class="page-title">${isEdit ? 'Edit Resource' : 'Add Resource'}</div>
        </div>
        <div class="fret-line"></div>
      </div>

      <div class="page-wrap" style="padding:32px 24px 60px;">
        <form id="resource-form" novalidate>
          <div class="form-grid">
            <div class="df-field full-width">
              <label class="df-label" for="r-title">Title *</label>
              <input type="text" id="r-title" name="title" class="df-input" value="${resource.title || ''}" placeholder="e.g. JustinGuitar" required>
            </div>
            <div class="df-field">
              <label class="df-label" for="r-category">Category</label>
              <select id="r-category" name="category" class="df-input">
                <option value="">— Select —</option>
                ${categories.map(c => `<option value="${c}" ${resource.category === c ? 'selected' : ''}>${c}</option>`).join('')}
              </select>
            </div>
            <div class="df-field">
              <label class="df-label" for="r-level">Level</label>
              <select id="r-level" name="level" class="df-input">
                <option value="">— Select —</option>
                ${levels.map(l => `<option value="${l}" ${resource.level === l ? 'selected' : ''}>${l}</option>`).join('')}
              </select>
            </div>
            <div class="df-field full-width">
              <label class="df-label" for="r-url">URL</label>
              <input type="url" id="r-url" name="url" class="df-input" value="${resource.url || ''}" placeholder="https://...">
            </div>
            <div class="df-field">
              <label class="df-label" for="r-author">Author / Creator</label>
              <input type="text" id="r-author" name="author" class="df-input" value="${resource.author || ''}" placeholder="e.g. Justin Sandercoe">
            </div>
            <div class="df-field">
              <label class="df-label" for="r-rating">Rating (1–5)</label>
              <select id="r-rating" name="rating" class="df-input">
                <option value="">— Select —</option>
                ${[5,4,3,2,1].map(n => `<option value="${n}" ${resource.rating == n ? 'selected' : ''}>${'★'.repeat(n)}${'☆'.repeat(5-n)} (${n}/5)</option>`).join('')}
              </select>
            </div>
            <div class="df-field full-width">
              <label class="df-label" for="r-tags">Tags</label>
              <input type="text" id="r-tags" name="tags" class="df-input" value="${resource.tags || ''}" placeholder="comma-separated: beginner,free,structured">
            </div>
            <div class="df-field full-width">
              <label class="df-label" for="r-notes">Notes</label>
              <textarea id="r-notes" name="notes" class="df-input" rows="4" placeholder="What's great about this resource?">${resource.notes || ''}</textarea>
            </div>
          </div>

          <div style="margin-top:24px;display:flex;gap:12px;">
            <button type="submit" class="df-btn df-btn--primary df-btn--full">${isEdit ? 'Save Changes' : 'Add Resource'}</button>
            <a href="#/resources" class="df-btn df-btn--outline">Cancel</a>
          </div>

          ${isEdit ? `
            <div style="margin-top:16px;border-top:1px solid var(--line);padding-top:16px;">
              <button type="button" id="delete-resource-btn" class="df-btn df-btn--danger df-btn--full">Delete Resource</button>
            </div>
          ` : ''}
        </form>
      </div>
    `;

    const form = app.querySelector('#resource-form');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const data = Object.fromEntries(fd.entries());
      if (data.rating) data.rating = parseInt(data.rating);
      if (data.url) data.url = Utils.normalizeUrl(data.url);
      Object.keys(data).forEach(k => { if (data[k] === '') delete data[k]; });
      if (!data.title) { alert('Title is required.'); return; }
      if (isEdit) { data.id = resource.id; data.createdAt = resource.createdAt; }
      await DB.saveResource(data);
      go('#/resources');
    });

    const deleteBtn = app.querySelector('#delete-resource-btn');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', async () => {
        if (confirm('Delete this resource?')) {
          await DB.deleteResource(resource.id);
          go('#/resources');
        }
      });
    }
  },
};
