// Daily Fret — Resources Page + Resource Form

window.Pages = window.Pages || {};

Pages.Resources = {
  activeFilter: 'All',
  searchTerm: '',
  pinStorageKey: 'ff-resource-pins-v1',

  async render() {
    const app = document.getElementById('app');
    app.innerHTML = '<div class="page-wrap" style="padding:60px 24px;text-align:center;"><p style="color:var(--text3);font-family:var(--f-mono);">Loading...</p></div>';

    this.resources = await DB.getAllResources();
    this.pinned = this._loadPins();

    app.innerHTML = `
      <section class="resources-hero page-wrap">
        <div>
          <h1 class="resources-hero__title">RESOURCES</h1>
          <p class="resources-hero__subtitle">Curated tools & learning platforms</p>
        </div>
        <a href="#/resources/add" class="df-btn df-btn--primary resources-hero__add" aria-label="Add resource">+ Add Resource</a>
      </section>

      <div class="resources-filter-wrap">
        <div class="page-wrap resources-filter">
          <input type="search" id="resource-search" class="df-input" placeholder="Search resources…" aria-label="Search resources">
          <div class="resources-chip-row" role="tablist" aria-label="Resource category filters">
            ${this._filterList().map(filter => `
              <button type="button" class="df-btn df-btn--outline resources-chip ${filter === this.activeFilter ? 'is-active' : ''}" data-filter="${filter}" role="tab" aria-selected="${filter === this.activeFilter}">${filter}</button>
            `).join('')}
          </div>
        </div>
      </div>

      <div class="page-wrap" style="padding:24px 24px 60px;">
        <div id="resources-grid-wrap">${this._renderGrid()}</div>
      </div>
    `;

    this._bindEvents(app);
  },

  _filterList() {
    return ['All', 'Music Theory', 'Tabs', 'Metronome', 'YouTube', 'Apps', 'Other'];
  },

  _renderGrid() {
    const filtered = this._filteredResources();
    if (!this.resources?.length) return this._renderEmpty();
    if (!filtered.length) return '<div class="df-panel df-panel--wide" style="padding:24px;text-align:center;color:var(--text2);">No resources match this filter.</div>';
    return `<div class="resources-grid">${filtered.map(r => this._renderCard(r)).join('')}</div>`;
  },

  _renderCard(r) {
    const stars = this._renderStars(Number(r.rating) || 0);
    const tags = r.tags ? r.tags.split(',').map(t => t.trim()).filter(Boolean) : [];
    const openUrl = r.url ? Utils.normalizeUrl(r.url) : '';
    const mappedCategory = this._mapCategory(r);
    const isPinned = !!this.pinned[String(r.id)];
    const cardTags = [mappedCategory, ...(isPinned ? ['Pinned'] : [])];

    return `
      <article class="resource-card" tabindex="0" aria-label="Resource ${r.title}">
        <div class="resource-card__head">
          <div class="resource-card__title-wrap">
            <span class="resource-card__icon" aria-hidden="true">${this._categoryIcon(mappedCategory)}</span>
            <div>
              <div class="resource-card__title">${r.title}</div>
              ${r.author ? `<div class="resource-card__author">${r.author}</div>` : ''}
            </div>
          </div>
          <div class="resource-card__stars" aria-label="Rating ${Number(r.rating) || 0} out of 5">${stars}</div>
        </div>
        <p class="resource-card__desc">${Utils.truncate(r.notes || tags.join(' • ') || 'No description added yet.', 95)}</p>
        <div class="resource-card__chips">${cardTags.map(tag => `<span class="resource-card__chip">${tag}</span>`).join('')}</div>
        <div class="resource-card__actions">
          ${openUrl ? `<a href="${openUrl}" target="_blank" rel="noopener" class="df-btn df-btn--outline" aria-label="Open ${r.title}">Open</a>` : '<span></span>'}
          <div class="resource-card__actions-right">
            <button type="button" class="df-btn resource-card__pin ${isPinned ? 'is-active' : ''}" data-pin-id="${r.id}" aria-label="${isPinned ? 'Unpin' : 'Pin'} ${r.title}" title="${isPinned ? 'Unpin' : 'Pin'}">★</button>
            <button type="button" class="df-btn resource-card__edit" onclick="go('#/resources/edit/${r.id}')" aria-label="Edit ${r.title}" title="Edit resource">Edit</button>
          </div>
        </div>
      </article>
    `;
  },

  _filteredResources() {
    const q = this.searchTerm.trim().toLowerCase();
    const filtered = (this.resources || []).filter((r) => {
      const mappedCategory = this._mapCategory(r);
      if (this.activeFilter !== 'All' && mappedCategory !== this.activeFilter) return false;
      if (!q) return true;
      const tags = r.tags ? r.tags.toLowerCase() : '';
      const haystack = [r.title, r.notes, r.author, r.category, tags].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(q);
    });

    return filtered.sort((a, b) => {
      if (this.activeFilter === 'All') {
        const pinDelta = Number(!!this.pinned[String(b.id)]) - Number(!!this.pinned[String(a.id)]);
        if (pinDelta) return pinDelta;
      }
      return String(a.title || '').localeCompare(String(b.title || ''));
    });
  },

  _mapCategory(r) {
    const raw = String(r.category || '').toLowerCase();
    if (raw.includes('theory') || raw.includes('lesson') || raw.includes('book') || raw.includes('podcast')) return 'Music Theory';
    if (raw.includes('tab')) return 'Tabs';
    if (raw.includes('metro') || raw.includes('bpm') || raw.includes('tempo')) return 'Metronome';
    if (raw.includes('youtube') || raw.includes('video')) return 'YouTube';
    if (raw.includes('app') || raw.includes('software') || raw.includes('tool')) return 'Apps';
    return 'Other';
  },

  _categoryIcon(cat) {
    const icons = {
      'Music Theory': '♫',
      Tabs: '𝄞',
      Metronome: '⏱',
      YouTube: '▶',
      Apps: '⌘',
      Other: '◆',
    };
    return icons[cat] || icons.Other;
  },

  _bindEvents(app) {
    const search = app.querySelector('#resource-search');
    const chips = app.querySelectorAll('[data-filter]');

    if (search) {
      search.value = this.searchTerm;
      search.addEventListener('input', (e) => {
        this.searchTerm = e.target.value || '';
        this._updateGrid(app);
      });
    }

    chips.forEach((chip) => {
      chip.addEventListener('click', () => {
        this.activeFilter = chip.dataset.filter || 'All';
        this._updateGrid(app);
        chips.forEach((btn) => {
          const isActive = btn.dataset.filter === this.activeFilter;
          btn.classList.toggle('is-active', isActive);
          btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
        });
      });
    });

    app.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-pin-id]');
      if (!btn) return;
      const id = btn.getAttribute('data-pin-id');
      if (!id) return;
      this.pinned[id] = !this.pinned[id];
      if (!this.pinned[id]) delete this.pinned[id];
      localStorage.setItem(this.pinStorageKey, JSON.stringify(this.pinned));
      this._updateGrid(app);
    });
  },

  _updateGrid(app) {
    const wrap = app.querySelector('#resources-grid-wrap');
    if (wrap) wrap.innerHTML = this._renderGrid();
  },

  _loadPins() {
    try {
      return JSON.parse(localStorage.getItem(this.pinStorageKey) || '{}') || {};
    } catch {
      return {};
    }
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
      ${Utils.renderPageHero({
        title: isEdit ? 'Edit Resource' : 'Add Resource',
        image: 'https://images.unsplash.com/photo-1507838153414-b4b713384a76?w=1200&q=80',
      })}

      <div class="page-wrap" style="padding:32px 24px 60px;">
        <form id="resource-form" class="df-panel df-panel--wide" novalidate>
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
