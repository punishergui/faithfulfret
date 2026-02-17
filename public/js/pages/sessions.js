// Daily Fret — Sessions Archive Page

window.Pages = window.Pages || {};

Pages.Sessions = {
  async render() {
    const app = document.getElementById('app');
    app.innerHTML = '<div class="page-wrap" style="padding:60px 24px;text-align:center;"><p style="color:var(--text3);font-family:var(--f-mono);">Loading...</p></div>';

    const [sessions, stats] = await Promise.all([
      DB.getAllSess(),
      DB.getStats(),
    ]);

    app.innerHTML = `
      ${this._renderHero(stats)}
      ${this._renderStatBar(stats)}
      <div style="padding:0;">
        ${sessions.length ? this._renderGrid(sessions) : this._renderEmpty()}
      </div>
    `;

    setTimeout(() => Utils.staggerReveal(app, '.session-card', 0), 50);
  },

  _renderHero(stats) {
    return `
      <div class="page-hero page-hero--img vert-texture" style="background-image:url('https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=1200&q=80');">
        <div class="page-hero__inner">
          <div class="page-title">Sessions</div>
          <a href="#/log" class="df-btn df-btn--primary" style="margin-bottom:4px;">+ Log Session</a>
        </div>
        <div class="fret-line"></div>
      </div>
    `;
  },

  _renderStatBar(stats) {
    const items = [
      { key: 'Sessions', val: stats.count },
      { key: 'Total Hours', val: stats.totalHours },
      { key: 'Peak BPM', val: stats.maxBPM || '—' },
      { key: 'Avg BPM', val: stats.avgBPM || '—' },
      { key: 'Streak', val: stats.currentStreak ? `${stats.currentStreak}d` : '0d' },
      { key: 'Best', val: stats.longestStreak ? `${stats.longestStreak}d` : '0d' },
    ];
    return `
      <div class="df-statbar">
        ${items.map(item => `
          <div class="df-statbar__item">
            <div class="df-statbar__key">${item.key}</div>
            <div class="df-statbar__val">${item.val}</div>
          </div>
        `).join('')}
      </div>
    `;
  },

  _renderGrid(sessions) {
    return `
      <div class="sessions-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:1px;background:var(--line);border:1px solid var(--line);">
        ${sessions.map(s => this._renderCard(s)).join('')}
      </div>
    `;
  },

  _renderCard(s) {
    const hasBg = !!s.videoId;
    const bgStyle = hasBg
      ? `background-image:url('${Utils.ytThumb(s.videoId)}');background-size:cover;background-position:center;filter:brightness(0.3) saturate(0.5);`
      : '';
    const bgClass = hasBg ? '' : 'session-card__bg--fret';

    const dow = Utils.formatDate(s.date, 'day');
    const dateShort = Utils.formatDate(s.date, 'short');

    return `
      <div class="session-card card-reveal" onclick="go('#/session/${s.id}')">
        <div class="session-card__bg ${bgClass}" style="${bgStyle}"></div>
        <div class="session-card__content">
          <div class="session-card__top">
            ${s.dayNumber ? `<span class="df-badge df-badge--muted">Day ${s.dayNumber}</span>` : ''}
            <span style="font-family:var(--f-mono);font-size:9px;color:var(--text3);letter-spacing:0.06em;text-transform:uppercase;">${dow}</span>
            <span style="font-family:var(--f-mono);font-size:9px;color:var(--text3);">${dateShort}</span>
          </div>
          ${s.focus ? `<div class="session-card__focus">${s.focus}</div>` : ''}
          ${s.win ? `<div class="session-card__win">${Utils.truncate(s.win, 80)}</div>` : ''}
          <div class="session-card__chips">
            ${s.minutes ? `<span class="df-badge df-badge--muted">${s.minutes}m</span>` : ''}
            ${s.bpm ? `<span class="df-badge df-badge--accent">${s.bpm}bpm</span>` : ''}
            ${s.videoId ? `<span class="df-badge df-badge--red">&#9654; REC</span>` : ''}
            ${(s.gear || []).slice(0, 2).map((item) => `<span class="df-badge df-badge--muted">${item.name}</span>`).join('')}
            ${(s.gear || []).length > 2 ? `<span class="df-badge df-badge--muted">+${(s.gear || []).length - 2}</span>` : ''}
          </div>
        </div>
        <div class="session-card__hover">
          <div class="session-card__hover-stats">
            ${s.minutes ? `<div class="session-card__hover-stat"><span class="session-card__hover-stat-val">${s.minutes}m</span><span class="session-card__hover-stat-key">Duration</span></div>` : ''}
            ${s.bpm ? `<div class="session-card__hover-stat"><span class="session-card__hover-stat-val">${s.bpm}</span><span class="session-card__hover-stat-key">BPM</span></div>` : ''}
            ${s.dayNumber ? `<div class="session-card__hover-stat"><span class="session-card__hover-stat-val">${s.dayNumber}</span><span class="session-card__hover-stat-key">Day</span></div>` : ''}
          </div>
          ${s.mood ? `<div class="session-card__hover-mood">${s.mood}</div>` : ''}
          ${s.win ? `<div class="session-card__hover-win">${Utils.truncate(s.win, 120)}</div>` : ''}
          <span class="df-btn df-btn--outline" style="font-size:10px;padding:8px 16px;">View Session &rarr;</span>
        </div>
      </div>
    `;
  },

  _renderEmpty() {
    return `
      <div class="empty-state" style="padding:80px 24px;">
        <div class="empty-state__title">No sessions logged yet</div>
        <div class="empty-state__text">Start tracking your guitar practice journey.</div>
        <a href="#/log" class="df-btn df-btn--primary">+ Log Your First Session</a>
      </div>
    `;
  },
};
