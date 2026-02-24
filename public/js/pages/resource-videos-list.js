window.Pages = window.Pages || {};

function escHtml(v) { return String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }

function formatVideoDuration(seconds) {
  const total = Number(seconds);
  if (!Number.isFinite(total) || total <= 0) return '';
  const n = Math.floor(total);
  const h = Math.floor(n / 3600);
  const m = Math.floor((n % 3600) / 60);
  const s = n % 60;
  if (h > 0) return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

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

    const [videos, playlists, songs] = await Promise.all([
      DB.getAllTrainingVideos({
        q: filters.q,
        category: filters.category,
        playlistId: filters.playlistId,
        difficulty_track: difficultyTrack,
        difficulty_level: difficultyLevel || '',
      }),
      DB.getVideoPlaylists(),
      DB.getRepertoireSongs({}).catch(() => []),
    ]);

    const normalized = this.applyProgressFilterAndSort(videos, filters.progress, filters.sort);
    this.videoState = normalized.map((video) => ({ ...video }));

    const difficultyOptions = ['Beginner', 'Intermediate', 'Advanced']
      .flatMap((track) => [1, 2, 3].map((level) => ({ value: `${track}-${level}`, label: `${track} ${level}` })));

    app.innerHTML = `
      ${Utils.renderPageHero({
        title: 'Training Video Library',
        subtitle: 'Videos + playlists + difficulty + attachments',
        leftExtra: Utils.renderBreadcrumbs([{ label: 'Training', href: '#/training' }, { label: 'Videos' }]),
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

        ${this.videoState.length ? `<div id="video-results" style="display:${this.viewMode === 'grid' ? 'grid' : 'block'};grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px;">${this.videoState.map((video) => this.renderCard(video, this.viewMode)).join('')}</div>` : '<div class="df-panel df-panel--wide" style="padding:24px;text-align:center;color:var(--text2);">No videos found.</div>'}
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

    const results = app.querySelector('#video-results');
    window.TooltipHelper?.bind(results || app);
    results?.addEventListener('click', (event) => {
      const card = event.target.closest('[data-video-link]');
      if (!card) return;
      if (event.target.closest('button,a,input,select,textarea,[data-card-action]')) return;
      go(`#/training/videos/${card.dataset.videoLink}`);
    });
    results?.addEventListener('click', async (event) => {
      const linkBtn = event.target.closest('[data-action="link-song"]');
      if (!linkBtn) return;
      event.preventDefault();
      event.stopPropagation();
      const videoId = Number(linkBtn.getAttribute('data-video-id') || 0);
      if (!videoId) return;
      const video = (this.videoState || []).find((entry) => Number(entry.id) === videoId);
      if (!video) return;
      if (!songs.length) {
        Utils.toast?.('Create a song first.');
        return;
      }
      const linkedSong = Number(video.linked_song_id) ? {
        song_id: Number(video.linked_song_id),
        title: String(video.linked_song_title || ''),
        artist: String(video.linked_song_artist || ''),
      } : null;
      const openModal = window.openSongLinkModal;
      if (typeof openModal !== 'function') {
        Utils.toast?.('Song link modal unavailable.');
        return;
      }
      openModal({
        entityLabel: video.title || `Video ${videoId}`,
        songs,
        linkedSong,
        onSave: async (songId) => {
          await DB.linkSongVideo(videoId, songId);
          const song = songs.find((entry) => Number(entry.id) === Number(songId));
          this.updateVideoSongState(videoId, song || { id: songId, title: `Song ${songId}`, artist: '' });
          this.rerenderVideoCard(videoId);
          sessionStorage.setItem('trainingVideoStatus', 'Video linked to song.');
          Utils.toast?.('Video linked to song.');
        },
        onUnlink: async () => {
          await DB.unlinkSongVideo(videoId);
          this.updateVideoSongState(videoId, null);
          this.rerenderVideoCard(videoId);
          sessionStorage.setItem('trainingVideoStatus', 'Video unlinked from song.');
          Utils.toast?.('Video unlinked from song.');
        },
      });
    });
    results?.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') return;
      const card = event.target.closest('[data-video-link]');
      if (!card) return;
      event.preventDefault();
      go(`#/training/videos/${card.dataset.videoLink}`);
    });
  },


  updateVideoSongState(videoId, song) {
    const id = Number(videoId || 0);
    if (!id) return;
    this.videoState = (this.videoState || []).map((entry) => {
      if (Number(entry.id) !== id) return entry;
      if (!song) return { ...entry, linked_song_id: null, linked_song_title: '', linked_song_artist: '' };
      return {
        ...entry,
        linked_song_id: Number(song.id) || null,
        linked_song_title: String(song.title || ''),
        linked_song_artist: String(song.artist || ''),
      };
    });
  },

  rerenderVideoCard(videoId) {
    const id = Number(videoId || 0);
    if (!id) return;
    const container = document.querySelector('#video-results');
    const current = container?.querySelector(`[data-video-link="${id}"]`);
    if (!container || !current || !Array.isArray(this.videoState)) return;
    const video = this.videoState.find((entry) => Number(entry.id) === id);
    if (!video) return;
    current.outerHTML = this.renderCard(video, this.viewMode);
    window.TooltipHelper?.bind(container);
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
    const thumb = video.thumbnail_url || video.thumb_url || video.thumbUrl || ((video.videoId || video.video_id) ? Utils.ytThumb(video.videoId || video.video_id) : '');
    const hasNotes = Boolean(String(video.notes_preview || '').trim());
    const attachmentCount = Number(video.attachment_count) || 0;
    const pdfCount = Number(video.pdf_attachment_count) || 0;
    const statusTags = [
      video.watched_at ? '<span class="training-status-badge">WATCHED</span>' : '',
      video.mastered_at ? '<span class="training-status-badge is-mastered">MASTERED</span>' : '',
      hasNotes ? '<span class="training-status-badge">📝 NOTES</span>' : '',
      pdfCount > 0 ? '<span class="training-status-badge">PDF</span>' : '',
      !pdfCount && attachmentCount > 0 ? '<span class="training-status-badge">ATTACHMENTS</span>' : '',
    ].filter(Boolean).join('');
    const allTags = `<span class="video-card__pill">${video.category || 'general'}</span>${tags.map((tag) => `<span class="video-card__pill">${tag}</span>`).join('')}${statusTags}`;
    const thumbHtml = thumb ? `<img src="${thumb}" alt="${video.title || ''}" class="training-video-library-thumb">` : '<div class="training-thumb-fallback training-video-library-thumb-fallback">🎬</div>';
    const duration = formatVideoDuration(video.duration_seconds);
    const linkedSongId = Number(video.linked_song_id || 0);
    const linkedSongTitle = String(video.linked_song_title || '').trim();
    const linkedSongArtist = String(video.linked_song_artist || '').trim();
    const songTooltip = linkedSongId ? escHtml(`Linked to: ${linkedSongTitle || `Song ${linkedSongId}`}${linkedSongArtist ? ` — ${linkedSongArtist}` : ''}`) : '';
    const songBadge = linkedSongId
      ? `<button type="button" class="video-card__linked-indicator" data-tooltip-content="${songTooltip}" data-tooltip-toggle="true" data-card-action="1" aria-label="Linked song details">● Linked</button>`
      : '';
    const songActionLabel = linkedSongId ? 'EDIT LINK' : 'LINK SONG';
    const songActionClass = linkedSongId ? 'df-btn--primary' : 'df-btn--outline';
    const songAction = `<button type="button" class="df-btn ${songActionClass} training-compact-btn tv-card__link-song" data-action="link-song" data-video-id="${video.id}" data-card-action="1" ${linkedSongId ? `data-tooltip-content="${songTooltip}" data-tooltip-toggle="true" aria-label="Edit linked song"` : 'aria-label="Link song"'}>${songActionLabel}</button>`;

    if (viewMode === 'list') {
      return `<div class="df-panel training-video-library-card is-list" role="link" tabindex="0" data-video-link="${video.id}">${thumbHtml}
        <div style="min-width:0;">
          <div class="training-row-title">${video.title || '(Untitled)'}</div>
          <div style="color:var(--text2);font-size:12px;">${video.author || ''}</div>
          <div style="margin-top:6px;color:var(--text2);font-size:12px;">${difficulty}${duration ? ` • ${duration}` : ''}</div>
          <div class="video-card__metaRow u-mt-8">
            <div class="video-card__pills">${allTags}${songBadge}</div>
            <div class="video-card__actions">${songAction}</div>
          </div>
        </div>
      </div>`;
    }

    return `<div class="df-panel training-video-library-card" role="link" tabindex="0" data-video-link="${video.id}">${thumbHtml}
      <div style="margin-top:10px;" class="training-row-title">${video.title || '(Untitled)'}</div>
      <div style="color:var(--text2);font-size:12px;">${video.author || ''}</div>
      <div style="margin-top:6px;color:var(--text2);font-size:12px;">${difficulty}${duration ? ` • ${duration}` : ''}</div>
      <div class="video-card__metaRow u-mt-8">
        <div class="video-card__pills">${allTags}${songBadge}</div>
        <div class="video-card__actions">${songAction}</div>
      </div>
    </div>`;
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
