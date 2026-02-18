window.Pages = window.Pages || {};


function escHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function toLegacyDescriptionHtml(video) {
  const sanitize = window.TrainingDescription?.sanitizeHtml;
  if (String(video.description_html || '').trim()) {
    return typeof sanitize === 'function' ? sanitize(String(video.description_html)) : String(video.description_html);
  }
  const fallback = String(video.description_text || video.notes || '').trim();
  if (!fallback) return '';
  return `<p>${escHtml(fallback).replace(/\n/g, '<br>')}</p>`;
}

Pages.ResourceVideoDetail = {
  _readJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  },

  _writeJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {}
  },

  _upsertRecentVideo(video) {
    const id = Number(video.id);
    const existing = this._readJson('df_recent_videos', []);
    const list = Array.isArray(existing) ? existing : [];
    const thumbId = video.videoId || video.video_id || '';
    const nextItem = {
      id,
      title: video.title || `Video ${id}`,
      thumb_url: video.thumbnail_url || video.thumb_url || video.thumbUrl || (thumbId ? Utils.ytThumb(thumbId) : ''),
      at: Date.now(),
    };
    const merged = list.filter((item) => Number(item?.id) !== id);
    this._writeJson('df_recent_videos', [nextItem, ...merged].slice(0, 5));
  },

  mmssToSeconds(value) {
    const raw = String(value || '').trim();
    if (!raw) return 0;
    if (/^\d+$/.test(raw)) return Number(raw);
    const parts = raw.split(':').map((part) => Number(part));
    if (parts.some((part) => Number.isNaN(part))) return NaN;
    if (parts.length === 2) return (parts[0] * 60) + parts[1];
    if (parts.length === 3) return (parts[0] * 3600) + (parts[1] * 60) + parts[2];
    return NaN;
  },

  formatSeconds(total) {
    const n = Number(total) || 0;
    const minutes = Math.floor(n / 60);
    const seconds = n % 60;
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  },

  async render(id) {
    const app = document.getElementById('app');
    app.innerHTML = '<div class="page-wrap" style="padding:60px 24px;text-align:center;"><p style="color:var(--text3);font-family:var(--f-mono);">Loading...</p></div>';
    const fromPlaylist = Number(new URLSearchParams((window.location.hash.split('?')[1] || '')).get('fromPlaylist') || 0);
    const [video, attachments, progress, fromPlaylistData] = await Promise.all([
      DB.getTrainingVideo(id),
      DB.getVideoAttachments(id),
      DB.getTrainingVideoProgress(id),
      fromPlaylist ? DB.getVideoPlaylist(fromPlaylist).catch(() => null) : Promise.resolve(null),
    ]);
    if (!video) {
      app.innerHTML = '<div class="page-wrap" style="padding:24px;color:var(--text2);">Video not found.</div>';
      return;
    }
    const tags = String(video.tags || '').split(',').map((tag) => tag.trim()).filter(Boolean);
    const descriptionHtml = toLegacyDescriptionHtml(video);
    const breadcrumbItems = fromPlaylistData
      ? [{ label: 'Training', href: '#/training' }, { label: 'Playlists', href: '#/training/playlists' }, { label: fromPlaylistData.name || 'Playlist', href: `#/training/playlists/${fromPlaylistData.id}` }, { label: video.title || 'Video' }]
      : [{ label: 'Training', href: '#/training' }, { label: 'Videos', href: '#/training/videos' }, { label: video.title || 'Video' }];
    const embedBase = `https://www.youtube-nocookie.com/embed/${video.videoId || video.video_id || ''}`;
    const isUpload = video.source_type === 'upload';
    const uploadThumb = video.thumbnail_url || video.thumb_url || video.thumbUrl || ((video.videoId || video.video_id) ? Utils.ytThumb(video.videoId || video.video_id) : '');
    const watchUrl = video.watch_url || (isUpload ? (video.upload_url || '') : (video.youtube_url || video.url || ''));
    const focus = encodeURIComponent(tags[0] || video.difficulty || 'Technique');

    try { localStorage.setItem('df_last_video_id', String(video.id)); } catch (e) {}
    const playlistProgress = this._readJson('df_playlist_progress', null);
    Utils.setLastPractice({
      tool: 'training',
      key_root: null,
      key_mode: null,
      progression_id: null,
      scale_id: null,
      chord_id: null,
      bpm: null,
      beats_per_chord: null,
      countin_enabled: null,
      countin_bars: null,
      playlist_id: Number(playlistProgress?.playlistId) || null,
      video_id: Number(video.id) || null,
    });
    this._upsertRecentVideo(video);

    const hasNotes = Boolean(String(progress.notes || '').trim());
    const badgeRow = [
      progress.watched_at ? '<span class="training-status-badge">WATCHED</span>' : '',
      progress.mastered_at ? '<span class="training-status-badge is-mastered">MASTERED</span>' : '',
      hasNotes ? '<span class="training-status-badge">📝 NOTES</span>' : '',
      (attachments || []).some((item) => item.kind === 'pdf') ? '<span class="training-status-badge">PDF</span>' : '',
      !(attachments || []).some((item) => item.kind === 'pdf') && (attachments || []).length ? '<span class="training-status-badge">ATTACHMENTS</span>' : '',
    ].filter(Boolean).join('');

    app.innerHTML = `
      ${Utils.renderPageHero({ title: video.title || 'Video Detail', subtitle: video.author || '', leftExtra: Utils.renderBreadcrumbs(breadcrumbItems) })}
      <div class="page-wrap training-video-detail-layout" style="padding:24px 24px 60px;display:grid;grid-template-columns:minmax(0,2fr) minmax(280px,1fr);gap:16px;">
        <div class="df-panel" style="padding:12px;">
          ${isUpload ? `<video controls src="${escHtml(watchUrl)}" style="width:100%;max-height:420px;border:0;border-radius:12px;background:var(--bg2);"></video>` : `<iframe title="${video.title || ''}" src="${embedBase}" style="width:100%;height:420px;border:0;border-radius:12px;background:var(--bg2);" allowfullscreen loading="lazy"></iframe>`}
          ${isUpload ? `<div style="margin-top:8px;">${uploadThumb ? `<img src="${escHtml(uploadThumb)}" alt="Thumbnail" style="max-width:240px;border-radius:10px;border:1px solid var(--line);">` : '<div class="training-thumb-fallback" style="max-width:240px;">Thumbnail pending / ffmpeg not installed</div>'}</div>` : ''}
          <div class="training-row-title" style="margin-top:10px;">${video.title || '(Untitled)'}</div>
          <div style="margin-top:6px;color:var(--text2);">${video.author || ''}</div>
          <div style="margin-top:6px;color:var(--text2);font-size:13px;">Difficulty: ${video.difficulty || '—'}</div>
          <div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:6px;">${badgeRow || '<span style="color:var(--text3);font-size:12px;">No progress yet.</span>'}</div>
          <div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:6px;">${tags.map((tag) => `<span class="df-btn df-btn--outline" style="padding:3px 8px;font-size:11px;">${tag}</span>`).join('')}</div>
          <div style="margin-top:12px;">
            <div style="font-size:12px;color:var(--text2);margin-bottom:6px;">Description</div>
            ${descriptionHtml ? `<div class="training-description-content rt-display">${descriptionHtml}</div>` : '<div style="color:var(--text3);font-size:13px;">No description yet.</div>'}
          </div>
        </div>

        <div style="display:grid;gap:12px;align-content:start;">
          <div class="df-panel" style="padding:12px;">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px;flex-wrap:wrap;">
              <div style="font-weight:700;">Timestamps</div>
              <button id="add-timestamp-toggle" class="df-btn df-btn--outline" type="button">Add Timestamp</button>
            </div>
            <form id="timestamp-form" style="display:none;margin-bottom:12px;">
              <input class="df-input" name="label" placeholder="Label" required style="margin-bottom:8px;">
              <input class="df-input" name="seconds" placeholder="mm:ss or seconds" required style="margin-bottom:8px;">
              <textarea class="df-input" name="notes" rows="2" placeholder="Notes"></textarea>
              <button class="df-btn df-btn--primary" type="submit" style="margin-top:8px;">Save Timestamp</button>
            </form>
            <div id="timestamp-list">${(video.timestamps || []).map((stamp) => this.renderTimestamp(stamp, embedBase)).join('') || '<div style="color:var(--text3);">No timestamps yet.</div>'}</div>
          </div>

          <div class="df-panel" style="padding:12px;display:grid;gap:8px;">
            <div style="font-weight:700;">Attachments</div>
            <div id="video-attachment-list">${(attachments || []).map((item) => `<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;border-top:1px solid var(--line);padding:8px 0;"><a href="${item.url}" target="_blank" rel="noopener">${item.title || item.filename || item.url}</a><button type="button" class="df-btn df-btn--ghost training-compact-btn" data-delete-attachment="${item.id}">Delete</button></div>`).join('') || '<div style="color:var(--text3);">No attachments.</div>'}</div>
            <form id="video-attachment-link-form" style="display:grid;gap:8px;">
              <input class="df-input" name="title" placeholder="Link title (optional)">
              <input class="df-input" name="url" type="url" placeholder="https://..." required>
              <button class="df-btn df-btn--outline" type="submit" style="justify-self:start;">Add Link</button>
            </form>
            <form id="video-attachment-file-form" style="display:grid;gap:8px;">
              <input class="df-input" name="title" placeholder="File title (optional)">
              <input class="df-input" name="file" type="file" accept="application/pdf,image/*" required>
              <button class="df-btn df-btn--outline" type="submit" style="justify-self:start;">Upload File</button>
            </form>
          </div>

          <div class="df-panel" style="padding:12px;display:grid;gap:10px;">
            <div style="font-weight:700;">Practice & Notes</div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
              <button id="video-progress-watched" type="button" class="df-btn df-btn--outline training-compact-btn">${progress.watched_at ? 'Watched' : 'Mark Watched'}</button>
              <button id="video-progress-mastered" type="button" class="df-btn df-btn--outline training-compact-btn">${progress.mastered_at ? 'Mastered' : 'Mark Mastered'}</button>
            </div>
            <div style="display:grid;gap:6px;">
              <textarea id="video-progress-notes" class="df-input" rows="4" placeholder="Personal notes">${progress.notes || ''}</textarea>
              <button id="video-progress-save" class="df-btn df-btn--outline" type="button" style="display:none;justify-self:flex-start;">Save Notes</button>
              <div style="color:var(--text3);font-size:12px;">${progress.watched_at ? `Watched ${new Date(progress.watched_at).toLocaleDateString()}` : 'Not watched yet'}${progress.mastered_at ? ` • Mastered ${new Date(progress.mastered_at).toLocaleDateString()}` : ''}</div>
            </div>
            <div class="df-panel" style="padding:10px;">
              <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;">
                <div style="font-family:var(--f-mono);font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--text3);">Practice Timer</div>
                <div id="video-timer-display" style="font-family:var(--f-mono);font-size:16px;">00:00</div>
              </div>
              <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap;">
                <button id="video-timer-start" type="button" class="df-btn df-btn--outline training-compact-btn">Start</button>
                <button id="video-timer-pause" type="button" class="df-btn df-btn--outline training-compact-btn">Pause</button>
                <button id="video-timer-reset" type="button" class="df-btn df-btn--outline training-compact-btn">Reset</button>
              </div>
            </div>
            <a class="df-btn df-btn--primary" href="#/log?videoId=${encodeURIComponent(video.videoId || video.video_id || '')}&title=${encodeURIComponent(video.title || '')}&focus=${focus}">Start Practice</a>
            <a class="df-btn df-btn--outline" href="#/training/videos/${video.id}/edit">Edit Video</a>
          </div>
        </div>
      </div>
    `;
    app.querySelector('#add-timestamp-toggle')?.addEventListener('click', () => {
      const form = app.querySelector('#timestamp-form');
      if (!form) return;
      form.style.display = form.style.display === 'none' ? 'block' : 'none';
    });

    app.querySelector('#timestamp-form')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(event.target).entries());
      const seconds = this.mmssToSeconds(data.seconds);
      if (Number.isNaN(seconds)) {
        alert('Enter seconds as number or mm:ss.');
        return;
      }
      await DB.addVideoTimestamp(video.id, { label: data.label, seconds, notes: data.notes || '' });
      await this.render(video.id);
    });


    app.querySelector('#video-attachment-link-form')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(event.target).entries());
      if (!String(data.url || '').trim()) return;
      await DB.addVideoAttachmentLink(video.id, { title: data.title || '', url: data.url || '' });
      await this.render(video.id);
    });

    app.querySelector('#video-attachment-file-form')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const data = new FormData(event.target);
      if (!data.get('file')) return;
      await DB.uploadVideoAttachment(video.id, data);
      await this.render(video.id);
    });

    app.querySelectorAll('[data-delete-attachment]').forEach((button) => {
      button.addEventListener('click', async () => {
        await DB.deleteVideoAttachment(button.dataset.deleteAttachment);
        await this.render(video.id);
      });
    });

    app.querySelectorAll('[data-delete-stamp]').forEach((button) => {
      button.addEventListener('click', async () => {
        await DB.deleteVideoTimestamp(button.dataset.deleteStamp);
        await this.render(video.id);
      });
    });

    app.querySelector('#video-progress-watched')?.addEventListener('click', async () => {
      await DB.saveTrainingVideoProgress(video.id, { watched: !progress.watched_at });
      await this.render(video.id);
    });

    app.querySelector('#video-progress-mastered')?.addEventListener('click', async () => {
      await DB.saveTrainingVideoProgress(video.id, { mastered: !progress.mastered_at });
      await this.render(video.id);
    });

    const notesEl = app.querySelector('#video-progress-notes');
    const saveNotesBtn = app.querySelector('#video-progress-save');
    const initialNotes = progress.notes || '';
    const syncDirtyState = () => {
      if (!notesEl || !saveNotesBtn) return;
      const dirty = notesEl.value !== initialNotes;
      saveNotesBtn.style.display = dirty ? 'inline-flex' : 'none';
      saveNotesBtn.disabled = !dirty;
    };
    notesEl?.addEventListener('input', syncDirtyState);
    syncDirtyState();

    saveNotesBtn?.addEventListener('click', async () => {
      if (!notesEl) return;
      await DB.saveTrainingVideoProgress(video.id, { notes: notesEl.value || '' });
      await this.render(video.id);
    });

    const timerDisplay = app.querySelector('#video-timer-display');
    const startBtn = app.querySelector('#video-timer-start');
    const pauseBtn = app.querySelector('#video-timer-pause');
    const resetBtn = app.querySelector('#video-timer-reset');
    let seconds = 0;
    let intervalId = null;
    const paint = () => {
      if (!timerDisplay) return;
      const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
      const ss = String(seconds % 60).padStart(2, '0');
      timerDisplay.textContent = `${mm}:${ss}`;
    };
    const markPracticeStop = () => {
      this._upsertRecentVideo(video);
    };
    startBtn?.addEventListener('click', () => {
      if (intervalId) return;
      intervalId = setInterval(() => {
        seconds += 1;
        paint();
      }, 1000);
    });
    pauseBtn?.addEventListener('click', () => {
      if (!intervalId) return;
      clearInterval(intervalId);
      intervalId = null;
      markPracticeStop();
    });
    resetBtn?.addEventListener('click', () => {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
        markPracticeStop();
      }
      seconds = 0;
      paint();
    });
    paint();
  },

  renderTimestamp(stamp, embedBase) {
    const startUrl = `${embedBase}?start=${Number(stamp.seconds) || 0}`;
    return `<div style="border-top:1px solid var(--line);padding:10px 0;">
      <div style="font-weight:600;">${stamp.label || 'Timestamp'} (${this.formatSeconds(stamp.seconds)})</div>
      <div style="font-size:12px;color:var(--text2);white-space:pre-wrap;">${stamp.notes || ''}</div>
      <div style="margin-top:6px;display:flex;gap:8px;">
        <a class="df-btn df-btn--outline" style="padding:4px 8px;font-size:11px;" target="_blank" rel="noopener" href="${startUrl}">Jump to</a>
        <button type="button" class="df-btn df-btn--danger" style="padding:4px 8px;font-size:11px;" data-delete-stamp="${stamp.id}">Delete</button>
      </div>
    </div>`;
  },
};
