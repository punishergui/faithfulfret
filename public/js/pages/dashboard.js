// Daily Fret — Dashboard Page

window.Pages = window.Pages || {};

Pages.Dashboard = {
  async render() {
    const app = document.getElementById('app');
    app.innerHTML = '<div class="page-wrap" style="padding:60px 24px;text-align:center;"><p style="color:var(--text3);font-family:var(--f-mono);">Loading...</p></div>';

    let stats;
    let sessions;
    let resources;
    let heatmapDays;

    try {
      [stats, sessions, resources, heatmapDays] = await Promise.all([
        DB.getStats(),
        DB.getAllSess(),
        DB.getAllResources(),
        DB.getSessionHeatmap(),
      ]);
    } catch (error) {
      app.innerHTML = `
        <div class="page-wrap" style="padding:32px 24px;">
          <div class="card" style="border:1px solid #b91c1c;background:rgba(185,28,28,0.12);padding:16px;">
            <div style="font-family:var(--f-mono);font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#fecaca;margin-bottom:8px;">Dashboard failed to load</div>
            <div style="color:#fee2e2;font-family:var(--f-mono);font-size:12px;line-height:1.5;">${String(error?.message || error).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]))}</div>
            <div style="margin-top:12px;"><button class="df-btn" onclick="Pages.Dashboard.render()">Retry</button></div>
          </div>
        </div>
      `;
      return;
    }

    const recent = sessions.slice(0, 6);
    const today = Utils.today();
    const topResources = resources.slice(0, 5);

    app.innerHTML = `
      ${this._renderHero(stats)}
      ${this._renderStatBar(stats)}
      <div class="page-wrap" style="padding:32px 24px;">
        <div class="two-col" style="align-items:start;">
          <div>
            <div class="section-header">
              <span class="section-header__label">Recent Sessions</span>
              <a href="#/sessions" class="section-header__link">View All &rarr;</a>
            </div>
            ${this._renderRecentSessions(recent, today)}

            <div style="margin-top:20px;display:flex;gap:10px;flex-wrap:wrap;">
              <a href="#/log" class="df-btn df-btn--primary">+ Log Session</a>
              <a href="#/sessions" class="df-btn df-btn--outline">Browse Sessions</a>
            </div>
          </div>
          <div>
            
            ${this._renderQuickLog(today)}
            ${this._renderCompactHeatmap(heatmapDays, today)}
            ${this._renderCalendar(stats.allDates)}
            ${topResources.length ? this._renderTopResources(topResources) : ''}
          </div>
        </div>
      </div>
    `;

    this._initStatCounters(app, stats);
    this._initCalendarNav(app, stats.allDates);
    this._initQuickLog(app, today);
    this._initDashboardHeatmap(app);

    // Stagger reveal
    setTimeout(() => Utils.staggerReveal(app, '.session-row', 0), 50);
  },

  _renderHero(stats) {
    const greeting = Utils.greeting();
    const awayText = stats.daysSinceLastSession == null
      ? 'No sessions logged yet.'
      : stats.daysSinceLastSession === 0
        ? 'Practiced today.'
        : `${stats.daysSinceLastSession} day${stats.daysSinceLastSession === 1 ? '' : 's'} since last session.`;

    return `
      <div class="page-hero page-hero--img vert-texture" style="background-image:url('https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=1200&q=80');overflow:hidden;">
        <div class="page-hero__inner">
          <div style="font-family:var(--f-mono);font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:var(--text3);margin-bottom:10px;">${Utils.today()}</div>
          <div class="page-title" style="text-shadow:2px 2px 0 rgba(255,106,0,.15);margin-bottom:12px;">${greeting}</div>
          <div style="font-family:var(--f-mono);font-size:13px;color:var(--text2);margin-bottom:${stats.streak > 0 ? '12px' : '0'};">
            <span class="count-target" data-target="${stats.count}" data-type="int">${stats.count}</span> sessions &middot; <span class="count-target" data-target="${stats.totalHours}" data-type="float">${stats.totalHours}</span> hours in &middot; keep going.
          </div>
          <div style="font-family:var(--f-mono);font-size:11px;color:var(--text3);margin-bottom:12px;">${awayText}</div>
          ${stats.count === 0 ? `<div style="font-family:var(--f-mono);font-size:10px;color:var(--yellow);letter-spacing:.06em;">If you recently updated and data looks empty, go to Progress and import your backup JSON.</div>` : ''}
          ${stats.streak > 0 ? `
          <div style="font-family:var(--f-mono);font-size:14px;color:var(--text2);">
            <span class="streak-num count-target" data-target="${stats.streak}" data-type="int" style="font-family:var(--f-hero);font-size:48px;color:var(--accent);text-shadow:0 0 20px var(--glow);vertical-align:middle;">${stats.streak}</span>
            <span style="vertical-align:middle;"> day streak 🔥</span>
          </div>
          ` : ''}
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
      { key: 'Best Streak', val: stats.longestStreak ? `${stats.longestStreak}d` : '0d' },
      { key: 'Sessions/Week', val: stats.sessionsPerWeek || 0 },
      { key: 'Last Session', val: stats.daysSinceLastSession == null ? '—' : `${stats.daysSinceLastSession}d ago` },
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

  _renderRecentSessions(sessions, today) {
    if (!sessions.length) {
      return `
        <div class="empty-state">
          <div class="empty-state__title">No sessions yet</div>
          <div class="empty-state__text">Log your first practice session to get started.</div>
        </div>
      `;
    }

    return `<div>
      ${sessions.map(s => {
        const thumb = s.videoId ? Utils.ytThumb(s.videoId) : null;
        const dow = Utils.formatDate(s.date, 'day');
        const dateShort = Utils.formatDate(s.date, 'short');
        return `
          <div class="session-row card-reveal" onclick="go('#/session/${s.id}')">
            <div class="session-row__date">
              <div class="session-row__dow">${dow}</div>
              <div class="session-row__date-val">${dateShort}</div>
            </div>
            <div class="session-row__middle">
              ${thumb ? `<img class="session-row__thumb" src="${thumb}" alt="" loading="lazy">` : ''}
              <div style="min-width:0;">
                ${s.focus ? `<div class="session-row__focus">${s.focus}</div>` : ''}
                ${s.win ? `<div class="session-row__win">${Utils.truncate(s.win, 60)}</div>` : ''}
              </div>
            </div>
            <div class="session-row__chips">
              ${s.minutes ? `<span class="df-badge df-badge--muted">${s.minutes}m</span>` : ''}
              ${s.bpm ? `<span class="df-badge df-badge--orange">${s.bpm}bpm</span>` : ''}
              ${s.videoId ? `<span class="df-badge df-badge--red">&#9654;</span>` : ''}
            </div>
          </div>
        `;
      }).join('')}
    </div>`;
  },
  _renderQuickLog(today) {
    let lastFocus = '';
    let lastMinutes = 20;
    try { lastFocus = (localStorage.getItem('df:lastFocus') || '').trim(); } catch (e) {}
    try { lastMinutes = parseInt(localStorage.getItem('df:lastMinutes') || '20', 10) || 20; } catch (e) {}
    if (![10, 20, 30, 45, 60].includes(lastMinutes)) lastMinutes = 20;

    const focuses = ['Chords','Scales','Strumming','Picking','Worship Set','Metronome','Song Practice','Technique','Ear Training'];

    return `
      <div class="card" style="border:1px solid var(--line);background:rgba(0,0,0,.25);padding:14px;margin-bottom:16px;">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px;">
          <div style="font-family:var(--f-mono);font-size:11px;letter-spacing:.10em;text-transform:uppercase;color:var(--text3);">Quick Log</div>
          <div style="font-family:var(--f-mono);font-size:10px;color:var(--text3);">defaults to ${lastMinutes}m</div>
        </div>

        <div class="df-field" style="margin-bottom:12px;">
          <label class="df-label">Minutes</label>
          <input type="hidden" id="ql-minutes" value="${lastMinutes}">
          <div class="df-pillrow" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px;" aria-label="Quick minutes">
            ${[10,20,30,45,'60+'].map(m => {
              const val = m === '60+' ? 60 : m;
              return `
                <button type="button" class="ql-pill ${val === lastMinutes ? 'is-active' : ''}" data-ql-min="${m}">
                  ${m}
                </button>
              `;
            }).join('')}
          </div>
        </div>

        <div class="df-field" style="margin-bottom:12px;">
          <label class="df-label">Focus</label>
          <select id="ql-focus" class="df-input">
            <option value="">— Optional —</option>
            ${focuses.map(f => `<option value="${f}" ${f===lastFocus?'selected':''}>${f}</option>`).join('')}
          </select>
        </div>

        <div class="df-field" style="margin-bottom:12px;">
          <label class="df-label">YouTube URL (optional)</label>
          <input id="ql-yt" class="df-input" placeholder="Paste YouTube URL or ID">
          <div style="margin-top:8px;color:var(--text3);font-size:12px;">Saves a minimal session now — you can edit details later.</div>
        </div>

        <div style="display:flex;gap:10px;flex-wrap:wrap;">
          <button type="button" id="ql-save" class="df-btn df-btn--primary" style="flex:1;">Save Quick Session</button>
          <a href="#/log" class="df-btn df-btn--outline">Full Form</a>
        </div>

        <div id="ql-msg" style="display:none;margin-top:10px;color:var(--text3);font-size:12px;font-family:var(--f-mono);"></div>
      </div>
    `;
  },

  _initQuickLog(container, today) {
    const root = container;
    const msg = root.querySelector('#ql-msg');
    const minutesEl = root.querySelector('#ql-minutes');
    const focusEl = root.querySelector('#ql-focus');
    const ytEl = root.querySelector('#ql-yt');

    const updatePillState = (value) => {
      root.querySelectorAll('[data-ql-min]').forEach((btn) => {
        let pillValue = btn.getAttribute('data-ql-min');
        if (pillValue === '60+') pillValue = '60';
        btn.classList.toggle('is-active', String(value) === String(pillValue));
      });
    };

    if (minutesEl?.value) updatePillState(minutesEl.value);

    root.querySelectorAll('[data-ql-min]').forEach(btn => {
      btn.addEventListener('click', () => {
        let m = btn.getAttribute('data-ql-min');
        if (m === '60+') m = '60';
        if (minutesEl) minutesEl.value = m;
        updatePillState(m);
        try { localStorage.setItem('df:lastMinutes', String(m)); } catch(e) {}
      });
    });

    root.querySelector('#ql-save')?.addEventListener('click', async () => {
      const minutes = parseInt((minutesEl?.value || '0'), 10) || 0;
      if (!minutes) return Utils.toast?.('Pick minutes first', 'error');

      const data = { date: today, minutes };

      const focus = (focusEl?.value || '').trim();
      if (focus) data.focus = focus;

      const yt = (ytEl?.value || '').trim();
      if (yt) {
        const extracted = Utils.extractYouTubeId?.(yt);
        data.videoId = extracted || yt;
      }

      try {
        const saved = await DB.saveSess(data);
        if (focus) { try { localStorage.setItem('df:lastFocus', focus); } catch(e) {} }
        Utils.toast?.('Saved quick session ✅');
        if (msg) {
          msg.style.display = 'block';
          msg.innerHTML = `Saved — <button type="button" class="ql-msg-link">Edit →</button>`;
          msg.querySelector('.ql-msg-link')?.addEventListener('click', () => go(`#/log/${saved.id}`));
        }
      } catch (e) {
        console.error(e);
        Utils.toast?.('Failed to save quick session', 'error');
      }
    });
  },

  _renderCompactHeatmap(rows = [], today, initialMetric = 'minutes') {
    const safeRows = Array.isArray(rows) ? rows : [];
    return `
      <div class="card" style="border:1px solid var(--line);background:rgba(0,0,0,.25);padding:14px;margin-bottom:16px;">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px;">
          <div style="font-family:var(--f-mono);font-size:11px;letter-spacing:.10em;text-transform:uppercase;color:var(--text3);">Practice Pulse · 90 Days</div>
          <div class="heatmap-toggle" data-heatmap-toggle>
            <button type="button" class="is-active" data-hm-metric="minutes">Minutes</button>
            <button type="button" data-hm-metric="sessions">Sessions</button>
          </div>
        </div>
        <div id="dashboard-heatmap" data-hm-days='${JSON.stringify(safeRows).replace(/'/g, '&#39;')}' data-hm-today="${today}" data-hm-range="90" data-hm-metric="${initialMetric}"></div>
      </div>
    `;
  },

  _initDashboardHeatmap(container) {
    const mount = container.querySelector('#dashboard-heatmap');
    if (!mount) return;

    const raw = mount.getAttribute('data-hm-days') || '[]';
    let rows = [];
    try { rows = JSON.parse(raw); } catch (e) { rows = []; }
    const byDate = new Map(rows.map((row) => [row.date, row]));

    const draw = () => {
      const metric = mount.getAttribute('data-hm-metric') || 'minutes';
      const today = new Date(`${mount.getAttribute('data-hm-today')}T12:00:00`);
      const range = parseInt(mount.getAttribute('data-hm-range') || '90', 10);
      const cells = [];
      const values = [];

      for (let i = range - 1; i >= 0; i -= 1) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        const date = d.toISOString().slice(0, 10);
        const row = byDate.get(date);
        const minutes = Number(row?.totalMinutes || 0);
        const sessionCount = Number(row?.sessionCount || 0);
        const value = metric === 'sessions' ? sessionCount : minutes;
        if (value > 0) values.push(value);
        cells.push({ date, value, minutes, sessionCount, sessionId: row?.sessionId || '' });
      }

      const max = values.length ? Math.max(...values) : 0;
      mount.innerHTML = `
        <div class="ff-heatmap ff-heatmap--compact">
          ${cells.map((cell) => {
            const level = this._heatLevel(cell.value, max);
            const title = `${cell.date} • ${cell.minutes}m • ${cell.sessionCount} session${cell.sessionCount === 1 ? '' : 's'}`;
            return `<button type="button" class="heatmap-cell level-${level}" ${cell.sessionId ? `data-session-id="${cell.sessionId}"` : 'disabled'} title="${title}" aria-label="${title}"></button>`;
          }).join('')}
        </div>
      `;

      mount.querySelectorAll('[data-session-id]').forEach((btn) => {
        btn.addEventListener('click', () => go(`#/session/${btn.getAttribute('data-session-id')}`));
      });
    };

    container.querySelectorAll('[data-hm-metric]').forEach((btn) => {
      btn.addEventListener('click', () => {
        mount.setAttribute('data-hm-metric', btn.getAttribute('data-hm-metric'));
        container.querySelectorAll('[data-hm-metric]').forEach((el) => el.classList.toggle('is-active', el === btn));
        draw();
      });
    });

    draw();
  },

  _heatLevel(value, max) {
    if (!value || !max) return 0;
    const ratio = value / max;
    if (ratio <= 0.25) return 1;
    if (ratio <= 0.5) return 2;
    if (ratio <= 0.75) return 3;
    return 4;
  },

  _renderCalendar(allDates, year, month) {
    const now = new Date();
    const y = year ?? now.getFullYear();
    const m = month ?? now.getMonth();

    const monthName = new Date(y, m, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const firstDay = new Date(y, m, 1).getDay();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const todayStr = Utils.today();

    const dateSet = new Set(allDates);

    const dayLabels = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
    let cells = '';

    // Day-of-week headers
    cells += dayLabels.map(d => `<div class="calendar__day-label">${d}</div>`).join('');

    // Empty cells before first day
    for (let i = 0; i < firstDay; i++) {
      cells += '<div></div>';
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const isToday = dateStr === todayStr;
      const hasSession = dateSet.has(dateStr);

      let cls = 'calendar__day';
      if (isToday) cls += ' calendar__day--today';
      if (hasSession) cls += ' calendar__day--active';

      const onclick = hasSession ? `onclick="DB.getSessByDate('${dateStr}').then(s=>s&&go('#/session/'+s.id))"` : '';
      cells += `<div class="${cls}" ${onclick}>${d}</div>`;
    }

    return `
      <div class="calendar" data-cal-year="${y}" data-cal-month="${m}" style="margin-bottom:24px;">
        <div class="calendar__header">
          <button class="calendar__nav" id="cal-prev">&lsaquo;</button>
          <span class="calendar__month">${monthName}</span>
          <button class="calendar__nav" id="cal-next">&rsaquo;</button>
        </div>
        <div class="calendar__grid">${cells}</div>
      </div>
    `;
  },

  _renderTopResources(resources) {
    return `
      <div>
        <div class="section-header" style="margin-bottom:10px;">
          <span class="section-header__label">Top Resources</span>
          <a href="#/resources" class="section-header__link">All &rarr;</a>
        </div>
        ${resources.map(r => `
          <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--line);">
            <span style="color:var(--text3);font-family:var(--f-mono);font-size:11px;">&#8599;</span>
            <a href="${r.url ? Utils.normalizeUrl(r.url) : '#/resources'}" target="_blank" rel="noopener" style="flex:1;font-size:14px;color:var(--text);text-decoration:none;font-weight:500;">${r.title}</a>
            <span class="df-badge df-badge--muted">${r.category || ''}</span>
          </div>
        `).join('')}
      </div>
    `;
  },

  _initStatCounters(container) {
    // Animate count-up in hero
    container.querySelectorAll('.count-target[data-target]').forEach(el => {
      const target = parseFloat(el.dataset.target);
      const isFloat = el.dataset.type === 'float';
      if (!isNaN(target)) {
        Utils.animateCount(el, target);
      }
    });
  },

  _initCalendarNav(container, allDates) {
    const cal = container.querySelector('.calendar');
    if (!cal) return;

    let year = parseInt(cal.dataset.calYear);
    let month = parseInt(cal.dataset.calMonth);

    const rebuildCal = () => {
      const parent = cal.parentNode;
      const newCal = document.createElement('div');
      newCal.innerHTML = this._renderCalendar(allDates, year, month);
      const newCalEl = newCal.firstElementChild;
      parent.replaceChild(newCalEl, cal);
      this._initCalendarNav(container, allDates);
    };

    container.querySelector('#cal-prev')?.addEventListener('click', () => {
      month--;
      if (month < 0) { month = 11; year--; }
      rebuildCal();
    });

    container.querySelector('#cal-next')?.addEventListener('click', () => {
      month++;
      if (month > 11) { month = 0; year++; }
      rebuildCal();
    });
  },
};
