window.Pages = window.Pages || {};

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

  _upsertRecentVideo(video, patch = {}) {
    const id = Number(video.id);
    const nowIso = new Date().toISOString();
    const existing = this._readJson('df_recent_videos', []);
    const list = Array.isArray(existing) ? existing : [];
    const nextItem = {
      id,
      title: video.title || `Video ${id}`,
      watchedAt: patch.watchedAt || nowIso,
      lastPracticedAt: patch.lastPracticedAt || null,
    };
    const merged = list.filter((item) => Number(item?.id) !== id);
    if (merged.length) {
      const prev = list.find((item) => Number(item?.id) === id) || {};
      nextItem.lastPracticedAt = patch.lastPracticedAt || prev.lastPracticedAt || null;
      nextItem.watchedAt = patch.watchedAt || nowIso;
    }
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
    const video = await DB.getTrainingVideo(id);
    const attachments = await DB.getVideoAttachments(id);
    if (!video) {
      app.innerHTML = '<div class="page-wrap" style="padding:24px;color:var(--text2);">Video not found.</div>';
      return;
    }
    const tags = String(video.tags || '').split(',').map((tag) => tag.trim()).filter(Boolean);
    const embedBase = `https://www.youtube-nocookie.com/embed/${video.videoId || video.video_id || ''}`;
    const focus = encodeURIComponent(tags[0] || video.difficulty || 'Technique');

    try { localStorage.setItem('df_last_video_id', String(video.id)); } catch (e) {}
    this._upsertRecentVideo(video, { watchedAt: new Date().toISOString() });

    app.innerHTML = `
      ${Utils.renderPageHero({ title: video.title || 'Video Detail', subtitle: video.author || '' })}
      <div class="page-wrap" style="padding:24px 24px 60px;display:grid;grid-template-columns:minmax(0,2fr) minmax(280px,1fr);gap:16px;">
        <div class="df-panel" style="padding:12px;">
          <iframe title="${video.title || ''}" src="${embedBase}" style="width:100%;height:420px;border:0;border-radius:12px;background:var(--bg2);" allowfullscreen loading="lazy"></iframe>
          <div style="margin-top:10px;color:var(--text2);">${video.author || ''}</div>
          <div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:6px;">${tags.map((tag) => `<span class="df-btn df-btn--outline" style="padding:3px 8px;font-size:11px;">${tag}</span>`).join('')}</div>
          <div style="margin-top:8px;color:var(--text2);">Difficulty: ${video.difficulty || '—'}</div>
          <div style="margin-top:12px;white-space:pre-wrap;color:var(--text2);">${video.notes || ''}</div>
          <div class="df-panel" style="padding:10px;margin-top:12px;">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;">
              <div style="font-family:var(--f-mono);font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--text3);">Practice Timer</div>
              <div id="video-timer-display" style="font-family:var(--f-mono);font-size:16px;">00:00</div>
            </div>
            <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap;">
              <button id="video-timer-start" type="button" class="df-btn df-btn--primary">Start</button>
              <button id="video-timer-pause" type="button" class="df-btn df-btn--outline">Pause</button>
              <button id="video-timer-reset" type="button" class="df-btn df-btn--outline">Reset</button>
            </div>
          </div>
          <div style="margin-top:14px;display:flex;gap:10px;flex-wrap:wrap;">
            <button id="add-timestamp-toggle" class="df-btn df-btn--outline">Add Timestamp</button>
            <a class="df-btn df-btn--outline" href="#/training/videos/${video.id}/edit">Edit Video</a>
            <a class="df-btn df-btn--primary" href="#/log?videoId=${encodeURIComponent(video.videoId || video.video_id || '')}&title=${encodeURIComponent(video.title || '')}&focus=${focus}">Start Session</a>
          </div>
        </div>

        <div class="df-panel" style="padding:12px;">
          <div style="font-weight:700;margin-bottom:10px;">Timestamps</div>
          <form id="timestamp-form" style="display:none;margin-bottom:12px;">
            <input class="df-input" name="label" placeholder="Label" required style="margin-bottom:8px;">
            <input class="df-input" name="seconds" placeholder="mm:ss or seconds" required style="margin-bottom:8px;">
            <textarea class="df-input" name="notes" rows="2" placeholder="Notes"></textarea>
            <button class="df-btn df-btn--primary" type="submit" style="margin-top:8px;">Save Timestamp</button>
          </form>
          <div id="timestamp-list">${(video.timestamps || []).map((stamp) => this.renderTimestamp(stamp, embedBase)).join('') || '<div style="color:var(--text3);">No timestamps yet.</div>'}</div>
        </div>
      </div>
      
        <div class="df-panel" style="padding:12px;">
          <div style="font-weight:700;margin-bottom:10px;">Attachments</div>
          ${(attachments || []).map((item) => `<div style="border-top:1px solid var(--line);padding:8px 0;"><a href="${item.url}" target="_blank" rel="noopener">${item.title || item.filename || item.url}</a></div>`).join('') || '<div style="color:var(--text3);">No attachments.</div>'}
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

    app.querySelectorAll('[data-delete-stamp]').forEach((button) => {
      button.addEventListener('click', async () => {
        await DB.deleteVideoTimestamp(button.dataset.deleteStamp);
        await this.render(video.id);
      });
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
      this._upsertRecentVideo(video, { lastPracticedAt: new Date().toISOString() });
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
