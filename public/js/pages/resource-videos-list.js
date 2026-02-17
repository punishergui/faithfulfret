window.Pages = window.Pages || {};

Pages.ResourceVideosList = {
  viewMode: 'grid',

  async render() {
    const app = document.getElementById('app');
    app.innerHTML = '<div class="page-wrap" style="padding:60px 24px;text-align:center;"><p style="color:var(--text3);font-family:var(--f-mono);">Loading...</p></div>';

    const hash = window.location.hash || '#/resources/videos';
    const queryString = hash.includes('?') ? hash.split('?')[1] : '';
    const params = new URLSearchParams(queryString);
    const filters = {
      q: params.get('q') || '',
      tags: params.get('tags') || '',
      difficulty: params.get('difficulty') || '',
      playlistId: params.get('playlistId') || '',
    };

    const [videos, playlists] = await Promise.all([
      DB.getAllTrainingVideos(filters),
      DB.getVideoPlaylists(),
    ]);

    const allTags = [...new Set(videos.flatMap((video) => String(video.tags || '').split(',').map((tag) => tag.trim()).filter(Boolean)))].sort((a, b) => a.localeCompare(b));
    const difficulties = [...new Set(videos.map((video) => video.difficulty).filter(Boolean))];

    app.innerHTML = `
      ${Utils.renderPageHero({
        title: 'Training Video Library',
        subtitle: 'Save and organize your guitar practice videos.',
        actions: '<a href="#/resources/videos/new" class="df-btn df-btn--primary">+ New Video</a>',
      })}
      <div class="page-wrap" style="padding:24px 24px 60px;">
        <div class="df-panel df-panel--wide" style="padding:16px;margin-bottom:16px;">
          <div style="display:grid;grid-template-columns:1fr auto;gap:12px;align-items:center;">
            <input id="video-search" class="df-input" placeholder="Search title, author, tags" value="${filters.q}">
            <button id="view-toggle" class="df-btn df-btn--outline">${this.viewMode === 'grid' ? 'Switch to List' : 'Switch to Grid'}</button>
          </div>
          <div style="margin-top:12px;display:flex;flex-wrap:wrap;gap:8px;">
            ${this.renderChip('difficulty', '', filters.difficulty, 'All Difficulty')}
            ${difficulties.map((item) => this.renderChip('difficulty', item, filters.difficulty, item)).join('')}
          </div>
          <div style="margin-top:12px;display:flex;flex-wrap:wrap;gap:8px;">
            ${this.renderChip('playlistId', '', filters.playlistId, 'All Playlists')}
            ${playlists.map((item) => this.renderChip('playlistId', String(item.id), filters.playlistId, item.name || `Playlist ${item.id}`)).join('')}
          </div>
          <div style="margin-top:12px;display:flex;flex-wrap:wrap;gap:8px;">
            ${this.renderChip('tags', '', filters.tags, 'All Tags')}
            ${allTags.map((tag) => this.renderChip('tags', tag, filters.tags, tag)).join('')}
          </div>
        </div>

        ${videos.length ? `<div id="video-results" style="display:${this.viewMode === 'grid' ? 'grid' : 'block'};grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px;">${videos.map((video) => this.renderCard(video, this.viewMode)).join('')}</div>` : '<div class="df-panel df-panel--wide" style="padding:24px;text-align:center;color:var(--text2);">No videos found.</div>'}
      </div>
    `;

    const searchInput = app.querySelector('#video-search');
    searchInput?.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') return;
      this.updateFilters({ ...filters, q: searchInput.value.trim() });
    });

    app.querySelectorAll('[data-filter-key]').forEach((button) => {
      button.addEventListener('click', () => {
        const key = button.dataset.filterKey;
        const value = button.dataset.filterValue;
        this.updateFilters({ ...filters, [key]: value });
      });
    });

    app.querySelector('#view-toggle')?.addEventListener('click', async () => {
      this.viewMode = this.viewMode === 'grid' ? 'list' : 'grid';
      await this.render();
    });
  },

  renderChip(key, value, selected, label) {
    const active = String(selected || '') === String(value || '');
    return `<button type="button" data-filter-key="${key}" data-filter-value="${value}" class="df-btn ${active ? 'df-btn--primary' : 'df-btn--outline'}" style="padding:6px 10px;">${label}</button>`;
  },

  renderCard(video, viewMode) {
    const tags = String(video.tags || '').split(',').map((tag) => tag.trim()).filter(Boolean);
    if (viewMode === 'list') {
      return `<a href="#/resources/videos/${video.id}" class="df-panel" style="display:flex;gap:12px;text-decoration:none;color:inherit;padding:10px;margin-bottom:10px;">
        <img src="${video.thumbUrl || ''}" alt="${video.title || ''}" style="width:180px;height:100px;object-fit:cover;border-radius:10px;background:var(--bg2);">
        <div>
          <div style="font-weight:700;">${video.title || '(Untitled)'}</div>
          <div style="color:var(--text2);font-size:12px;">${video.author || ''}</div>
          <div style="margin-top:6px;color:var(--text2);font-size:12px;">${video.difficulty || ''}</div>
          <div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:6px;">${tags.map((tag) => `<span class="df-btn df-btn--outline" style="padding:2px 8px;font-size:11px;">${tag}</span>`).join('')}</div>
        </div>
      </a>`;
    }
    return `<a href="#/resources/videos/${video.id}" class="df-panel" style="text-decoration:none;color:inherit;padding:10px;display:block;">
      <img src="${video.thumbUrl || ''}" alt="${video.title || ''}" style="width:100%;height:150px;object-fit:cover;border-radius:10px;background:var(--bg2);">
      <div style="margin-top:10px;font-weight:700;">${video.title || '(Untitled)'}</div>
      <div style="color:var(--text2);font-size:12px;">${video.author || ''}</div>
      <div style="margin-top:6px;color:var(--text2);font-size:12px;">${video.difficulty || ''}</div>
      <div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:6px;">${tags.map((tag) => `<span class="df-btn df-btn--outline" style="padding:2px 8px;font-size:11px;">${tag}</span>`).join('')}</div>
    </a>`;
  },

  updateFilters(next) {
    const params = new URLSearchParams();
    Object.entries(next).forEach(([key, value]) => {
      if (value == null || value === '') return;
      params.set(key, value);
    });
    const query = params.toString();
    go(`#/resources/videos${query ? `?${query}` : ''}`);
  },
};
