window.Pages = window.Pages || {};

Pages.Repertoire = {
  async render() {
    const app = document.getElementById('app');
    const filters = this._readFilters();
    const songs = await DB.getRepertoireSongs(filters).catch(() => []);

    app.innerHTML = `
      ${Utils.renderPageHero({
        title: 'Songs',
        subtitle: 'Track songs you are learning, polishing, and performance-ready.',
        actions: '<button class="df-btn df-btn--primary" id="rep-add-song">Add Song</button>',
      })}
      <div class="page-wrap" style="padding:28px 24px 40px;display:grid;gap:14px;">
        <section class="df-panel df-panel--wide" style="padding:14px;display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;">
          <div class="df-field" style="min-width:180px;">
            <label class="df-label">Status</label>
            <select id="rep-status" class="df-input">
              <option value="">All</option>
              <option value="learning" ${filters.status === 'learning' ? 'selected' : ''}>Learning</option>
              <option value="can_play_slowly" ${filters.status === 'can_play_slowly' ? 'selected' : ''}>Can play slowly</option>
              <option value="performance_ready" ${filters.status === 'performance_ready' ? 'selected' : ''}>Performance ready</option>
            </select>
          </div>
          <div class="df-field" style="min-width:180px;">
            <label class="df-label">Sort</label>
            <select id="rep-sort" class="df-input">
              <option value="last_practiced" ${filters.sort === 'last_practiced' ? 'selected' : ''}>Last practiced</option>
              <option value="status" ${filters.sort === 'status' ? 'selected' : ''}>Status</option>
              <option value="created" ${filters.sort === 'created' ? 'selected' : ''}>Created</option>
            </select>
          </div>
        </section>

        <section class="repertoire-grid" style="display:grid;gap:12px;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));">
          ${songs.length ? songs.map((song) => this._card(song)).join('') : '<div class="df-panel" style="padding:14px;color:var(--text2);">No songs yet. Add your first song.</div>'}
        </section>
      </div>

      <dialog id="rep-dialog" style="max-width:520px;width:calc(100% - 32px);border:1px solid var(--line2);background:var(--panel);color:var(--text);border-radius:10px;padding:0;">
        <form id="rep-form" method="dialog" style="display:grid;gap:10px;padding:14px;">
          <input type="hidden" id="rep-id">
          <div class="df-field"><label class="df-label">Title *</label><input id="rep-title" class="df-input" required></div>
          <div class="df-field"><label class="df-label">Artist</label><input id="rep-artist" class="df-input"></div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
            <div class="df-field"><label class="df-label">Status</label><select id="rep-song-status" class="df-input"><option value="learning">Learning</option><option value="can_play_slowly">Can play slowly</option><option value="performance_ready">Performance ready</option></select></div>
            <div class="df-field"><label class="df-label">Difficulty</label><select id="rep-difficulty" class="df-input"><option value="">—</option><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select></div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
            <div class="df-field"><label class="df-label">Current BPM</label><input id="rep-current-bpm" class="df-input" type="number"></div>
            <div class="df-field"><label class="df-label">Target BPM</label><input id="rep-target-bpm" class="df-input" type="number"></div>
          </div>
          <div class="df-field"><label class="df-label">Notes</label><textarea id="rep-notes" class="df-input" rows="3"></textarea></div>
          <div style="display:flex;justify-content:flex-end;gap:8px;"><button type="button" class="df-btn df-btn--outline" id="rep-cancel">Cancel</button><button class="df-btn df-btn--primary">Save Song</button></div>
        </form>
      </dialog>
    `;

    this._bind(app, songs);
  },

  _readFilters() {
    const q = new URLSearchParams(location.hash.split('?')[1] || '');
    return { status: q.get('status') || '', sort: q.get('sort') || 'last_practiced' };
  },

  _setFilters(next = {}) {
    const q = new URLSearchParams();
    if (next.status) q.set('status', next.status);
    if (next.sort) q.set('sort', next.sort);
    location.hash = `#/songs${q.toString() ? `?${q.toString()}` : ''}`;
  },

  _statusPill(status) {
    const map = {
      learning: ['Learning', 'var(--text2)'],
      can_play_slowly: ['Can play slowly', 'var(--warn)'],
      performance_ready: ['Performance ready', 'var(--bad)'],
    };
    const [label, color] = map[status] || ['Learning', 'var(--text2)'];
    return `<span style="font-size:11px;padding:4px 8px;border:1px solid var(--line2);border-radius:999px;color:${color};">${label}</span>`;
  },

  _card(song) {
    const bpmLine = song.target_bpm ? `${Number(song.current_bpm) || 0}/${Number(song.target_bpm)} bpm` : (song.current_bpm ? `${song.current_bpm} bpm` : '—');
    const last = song.last_practiced_at ? new Date(Number(song.last_practiced_at)).toLocaleDateString() : 'Never';
    return `
      <article class="df-panel" style="padding:14px;display:grid;gap:10px;">
        <div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start;">
          <div>
            <div style="font-weight:700;">${song.title}</div>
            <div style="font-size:12px;color:var(--text2);">${song.artist || '—'}</div>
          </div>
          ${this._statusPill(song.status)}
        </div>
        <div style="font-size:12px;color:var(--text2);">Last practiced: ${last}</div>
        <div style="font-size:12px;color:var(--text2);">BPM progress: ${bpmLine}</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button class="df-btn df-btn--outline" data-advance-song="${song.id}">Advance status</button>
          <button class="df-btn df-btn--outline" data-log-song="${song.id}">Log practice</button>
          <button class="df-btn" data-edit-song="${song.id}">Edit</button>
          <button class="df-btn df-btn--danger" data-delete-song="${song.id}">Delete</button>
        </div>
      </article>
    `;
  },

  _bind(app, songs) {
    const status = app.querySelector('#rep-status');
    const sort = app.querySelector('#rep-sort');
    status?.addEventListener('change', () => this._setFilters({ status: status.value, sort: sort?.value || 'last_practiced' }));
    sort?.addEventListener('change', () => this._setFilters({ status: status?.value || '', sort: sort.value }));

    const dialog = app.querySelector('#rep-dialog');
    const openDialog = (song = null) => {
      app.querySelector('#rep-id').value = song?.id || '';
      app.querySelector('#rep-title').value = song?.title || '';
      app.querySelector('#rep-artist').value = song?.artist || '';
      app.querySelector('#rep-song-status').value = song?.status || 'learning';
      app.querySelector('#rep-difficulty').value = song?.difficulty || '';
      app.querySelector('#rep-current-bpm').value = song?.current_bpm || '';
      app.querySelector('#rep-target-bpm').value = song?.target_bpm || '';
      app.querySelector('#rep-notes').value = song?.notes || '';
      dialog?.showModal();
    };

    app.querySelector('#rep-add-song')?.addEventListener('click', () => openDialog());
    app.querySelector('#rep-cancel')?.addEventListener('click', () => dialog?.close());

    app.querySelector('#rep-form')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const payload = {
        id: Number(app.querySelector('#rep-id').value) || undefined,
        title: app.querySelector('#rep-title').value.trim(),
        artist: app.querySelector('#rep-artist').value.trim(),
        status: app.querySelector('#rep-song-status').value,
        difficulty: app.querySelector('#rep-difficulty').value || null,
        current_bpm: Number(app.querySelector('#rep-current-bpm').value) || null,
        target_bpm: Number(app.querySelector('#rep-target-bpm').value) || null,
        notes: app.querySelector('#rep-notes').value || '',
      };
      await DB.saveRepertoireSong(payload);
      dialog?.close();
      this.render();
    });

    app.querySelectorAll('[data-edit-song]').forEach((btn) => btn.addEventListener('click', () => {
      const id = Number(btn.getAttribute('data-edit-song'));
      openDialog((songs || []).find((s) => Number(s.id) === id) || null);
    }));

    app.querySelectorAll('[data-advance-song]').forEach((btn) => btn.addEventListener('click', async () => {
      const id = Number(btn.getAttribute('data-advance-song'));
      const song = (songs || []).find((s) => Number(s.id) === id);
      if (!song) return;
      const order = ['learning', 'can_play_slowly', 'performance_ready'];
      const idx = order.indexOf(song.status);
      const next = order[Math.min(order.length - 1, idx + 1)];
      if (next === song.status) return;
      await DB.saveRepertoireSong({ ...song, id, status: next });
      this.render();
    }));

    app.querySelectorAll('[data-log-song]').forEach((btn) => btn.addEventListener('click', async () => {
      const id = Number(btn.getAttribute('data-log-song'));
      const song = (songs || []).find((s) => Number(s.id) === id);
      if (!song) return;
      await DB.saveRepertoireSong({ ...song, id, last_practiced_at: Date.now() });
      location.hash = `#/log?song=${id}`;
    }));

    app.querySelectorAll('[data-delete-song]').forEach((btn) => btn.addEventListener('click', async () => {
      const id = Number(btn.getAttribute('data-delete-song'));
      const song = (songs || []).find((s) => Number(s.id) === id);
      if (!song) return;
      if (!window.confirm(`Delete song "${song.title}"?`)) return;
      await DB.deleteSong(id);
      Utils.toast?.('Song deleted.');
      this.render();
    }));
  },
};
