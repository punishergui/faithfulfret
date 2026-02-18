window.Pages = window.Pages || {};

Pages.ResourceVideosList = {
  viewMode: 'grid',

  async render() {
    const app = document.getElementById('app');
    app.innerHTML = '<div class="page-wrap" style="padding:60px 24px;text-align:center;"><p style="color:var(--text3);font-family:var(--f-mono);">Loading...</p></div>';

    const hash = window.location.hash || '#/training/videos';
    const queryString = hash.includes('?') ? hash.split('?')[1] : '';
    const params = new URLSearchParams(queryString);
    const filters = {
      q: params.get('q') || '',
      category: params.get('category') || '',
      difficulty: params.get('difficulty') || '',
      playlistId: params.get('playlistId') || '',
      progress: params.get('progress') || 'all',
      sort: params.get('sort') || 'recentlyAdded',
    };

    const difficultyTrack = filters.difficulty ? filters.difficulty.split('-')[0] : '';
    const difficultyLevel = filters.difficulty ? Number(filters.difficulty.split('-')[1]) : '';

    const [videos, playlists] = await Promise.all([
      DB.getAllTrainingVideos({
        q: filters.q,
        category: filters.category,
        playlistId: filters.playlistId,
        difficulty_track: difficultyTrack,
        difficulty_level: difficultyLevel || '',
      }),
      DB.getVideoPlaylists(),
    ]);

    const normalized = this.applyProgressFilterAndSort(videos, filters.progress, filters.sort);

    const difficultyOptions = ['Beginner', 'Intermediate', 'Advanced']
      .flatMap((track) => [1, 2, 3].map((level) => ({ value: `${track}-${level}`, label: `${track} ${level}` })));

    app.innerHTML = `
      ${Utils.renderPageHero({
        title: 'Training Video Library',
        subtitle: 'Videos + playlists + difficulty + attachments',
        actions: '<a href="#/training/playlists" class="df-btn df-btn--outline" style="margin-right:8px;">Playlists</a><a href="#/training/videos/new" class="df-btn df-btn--primary">+ New Video</a>',
      })}
      <div class="page-wrap" style="padding:24px 24px 60px;">
        <div class="df-panel df-panel--wide" style="padding:16px;margin-bottom:16px;display:grid;gap:10px;">
          <div style="display:grid;grid-template-columns:1fr auto;gap:12px;align-items:center;">
            <input id="video-search" class="df-input" placeholder="Search title, author, tags" value="${filters.q}">
            <button id="view-toggle" class="df-btn df-btn--outline">${this.viewMode === 'grid' ? 'Switch to List' : 'Switch to Grid'}</button>
          </div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;">
            <select id="video-category" class="df-input">
              <option value="">All Categories</option>
              <option value="general" ${filters.category === 'general' ? 'selected' : ''}>General</option>
              <option value="skill" ${filters.category === 'skill' ? 'selected' : ''}>Skill</option>
              <option value="song" ${filters.category === 'song' ? 'selected' : ''}>Song</option>
            </select>
            <select id="video-difficulty" class="df-input">
              <option value="">All Difficulty</option>
              ${difficultyOptions.map((item) => `<option value="${item.value}" ${filters.difficulty === item.value ? 'selected' : ''}>${item.label}</option>`).join('')}
            </select>
            <select id="video-playlist" class="df-input">
              <option value="">All Playlists</option>
              ${playlists.map((item) => `<option value="${item.id}" ${String(filters.playlistId) === String(item.id) ? 'selected' : ''}>${item.name || `Playlist ${item.id}`}</option>`).join('')}
            </select>
          </div>
          <div class="training-filter-chips">
            ${['all', 'unwatched', 'watched', 'mastered'].map((key) => `<button type="button" class="training-chip ${filters.progress === key ? 'is-active' : ''}" data-progress-chip="${key}">${key[0].toUpperCase()}${key.slice(1)}</button>`).join('')}
            <select id="video-sort" class="df-input" style="max-width:220px;margin-left:auto;">
              <option value="recentlyAdded" ${filters.sort === 'recentlyAdded' ? 'selected' : ''}>Recently Added</option>
              <option value="recentlyWatched" ${filters.sort === 'recentlyWatched' ? 'selected' : ''}>Recently Watched</option>
              <option value="unwatchedFirst" ${filters.sort === 'unwatchedFirst' ? 'selected' : ''}>Unwatched First</option>
            </select>
          </div>
        </div>

        ${normalized.length ? `<div id="video-results" style="display:${this.viewMode === 'grid' ? 'grid' : 'block'};grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px;">${normalized.map((video) => this.renderCard(video, this.viewMode)).join('')}</div>` : '<div class="df-panel df-panel--wide" style="padding:24px;text-align:center;color:var(--text2);">No videos found.</div>'}
      </div>
    `;

    app.querySelector('#video-search')?.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') return;
      this.updateFilters({ ...filters, q: event.target.value.trim() });
    });
    app.querySelector('#video-category')?.addEventListener('change', (event) => this.updateFilters({ ...filters, category: event.target.value }));
    app.querySelector('#video-difficulty')?.addEventListener('change', (event) => this.updateFilters({ ...filters, difficulty: event.target.value }));
    app.querySelector('#video-playlist')?.addEventListener('change', (event) => this.updateFilters({ ...filters, playlistId: event.target.value }));
    app.querySelector('#video-sort')?.addEventListener('change', (event) => this.updateFilters({ ...filters, sort: event.target.value }));
    app.querySelectorAll('[data-progress-chip]').forEach((button) => {
      button.addEventListener('click', () => this.updateFilters({ ...filters, progress: button.dataset.progressChip }));
    });

    app.querySelector('#view-toggle')?.addEventListener('click', async () => {
      this.viewMode = this.viewMode === 'grid' ? 'list' : 'grid';
      await this.render();
    });

    app.querySelectorAll('[data-toggle-watched]').forEach((button) => {
      button.addEventListener('click', async (event) => {
        event.preventDefault();
        event.stopPropagation();
        await DB.saveTrainingVideoProgress(button.dataset.toggleWatched, { watched: button.dataset.next === '1' });
        await this.render();
      });
    });

    app.querySelectorAll('[data-toggle-mastered]').forEach((button) => {
      button.addEventListener('click', async (event) => {
        event.preventDefault();
        event.stopPropagation();
        await DB.saveTrainingVideoProgress(button.dataset.toggleMastered, { mastered: button.dataset.next === '1' });
        await this.render();
      });
    });
  },

  applyProgressFilterAndSort(videos = [], progressFilter = 'all', sort = 'recentlyAdded') {
    let list = (videos || []).filter((video) => {
      if (progressFilter === 'unwatched') return !video.watched_at;
      if (progressFilter === 'watched') return Boolean(video.watched_at) && !video.mastered_at;
      if (progressFilter === 'mastered') return Boolean(video.mastered_at);
      return true;
    });

    if (sort === 'recentlyWatched') {
      list = list.sort((a, b) => (Number(b.watched_at) || 0) - (Number(a.watched_at) || 0));
    } else if (sort === 'unwatchedFirst') {
      list = list.sort((a, b) => {
        const aWatched = a.watched_at ? 1 : 0;
        const bWatched = b.watched_at ? 1 : 0;
        if (aWatched !== bWatched) return aWatched - bWatched;
        return (Number(b.updatedAt) || 0) - (Number(a.updatedAt) || 0);
      });
    } else {
      list = list.sort((a, b) => (Number(b.updatedAt) || 0) - (Number(a.updatedAt) || 0));
    }
    return list;
  },

  renderCard(video, viewMode) {
    const tags = String(video.tags || '').split(',').map((tag) => tag.trim()).filter(Boolean);
    const difficulty = video.difficulty_track && video.difficulty_level ? `${video.difficulty_track} ${video.difficulty_level}` : (video.difficulty || '');
    const thumb = video.thumbUrl || video.thumb_url || '';
    const statusBadges = `${video.watched_at ? '<span class="training-status-badge">Watched</span>' : ''}${video.mastered_at ? '<span class="training-status-badge is-mastered">Mastered</span>' : ''}`;
    const actionBar = `<div class="training-card-actions"><button class="df-btn df-btn--outline" data-toggle-watched="${video.id}" data-next="${video.watched_at ? '0' : '1'}">${video.watched_at ? 'Unwatch' : 'Watched'}</button><button class="df-btn df-btn--outline" data-toggle-mastered="${video.id}" data-next="${video.mastered_at ? '0' : '1'}">${video.mastered_at ? 'Unmaster' : 'Mastered'}</button><a href="#/training/videos/${video.id}" class="df-btn df-btn--ghost">Notes</a></div>`;
    const thumbHtml = thumb ? `<img src="${thumb}" alt="${video.title || ''}" style="width:100%;height:${viewMode === 'list' ? '100px' : '150px'};object-fit:cover;border-radius:10px;background:var(--bg2);">` : '<div class="training-thumb-fallback">🎬</div>';

    if (viewMode === 'list') {
      return `<a href="#/training/videos/${video.id}" class="df-panel" style="display:grid;grid-template-columns:180px minmax(0,1fr);gap:12px;text-decoration:none;color:inherit;padding:10px;margin-bottom:10px;">${thumbHtml}
        <div style="min-width:0;">
          <div class="training-row-title">${video.title || '(Untitled)'}</div>
          <div style="color:var(--text2);font-size:12px;">${video.author || ''}</div>
          <div style="margin-top:6px;color:var(--text2);font-size:12px;">${difficulty}</div>
          <div class="training-status-row">${statusBadges || '<span style="color:var(--text3);font-size:12px;">Unwatched</span>'}</div>
          <div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:6px;"><span class="df-btn df-btn--outline" style="padding:2px 8px;font-size:11px;">${video.category || 'general'}</span>${tags.map((tag) => `<span class="df-btn df-btn--outline" style="padding:2px 8px;font-size:11px;">${tag}</span>`).join('')}</div>
          ${video.notes_preview ? `<div style="margin-top:8px;color:var(--text2);font-size:12px;">${video.notes_preview}</div>` : ''}
          ${actionBar}
        </div>
      </a>`;
    }

    return `<a href="#/training/videos/${video.id}" class="df-panel" style="text-decoration:none;color:inherit;padding:10px;display:block;">${thumbHtml}
      <div style="margin-top:10px;" class="training-row-title">${video.title || '(Untitled)'}</div>
      <div style="color:var(--text2);font-size:12px;">${video.author || ''}</div>
      <div style="margin-top:6px;color:var(--text2);font-size:12px;">${difficulty}</div>
      <div class="training-status-row">${statusBadges || '<span style="color:var(--text3);font-size:12px;">Unwatched</span>'}</div>
      ${video.notes_preview ? `<div style="margin-top:8px;color:var(--text2);font-size:12px;">${video.notes_preview}</div>` : ''}
      <div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:6px;"><span class="df-btn df-btn--outline" style="padding:2px 8px;font-size:11px;">${video.category || 'general'}</span>${tags.map((tag) => `<span class="df-btn df-btn--outline" style="padding:2px 8px;font-size:11px;">${tag}</span>`).join('')}</div>
      ${actionBar}
    </a>`;
  },

  updateFilters(next) {
    const params = new URLSearchParams();
    Object.entries(next).forEach(([key, value]) => {
      if (value == null || value === '' || (key === 'progress' && value === 'all') || (key === 'sort' && value === 'recentlyAdded')) return;
      params.set(key, value);
    });
    const query = params.toString();
    go(`#/training/videos${query ? `?${query}` : ''}`);
  },
};
