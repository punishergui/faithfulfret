// Daily Fret — Dashboard Page

window.Pages = window.Pages || {};

Pages.Dashboard = {
  async render() {
    const app = document.getElementById('app');
    app.innerHTML = '<div class="page-wrap" style="padding:60px 24px;text-align:center;"><p style="color:var(--text3);font-family:var(--f-mono);">Loading...</p></div>';

    let stats;
    let sessions;
    let resources;

    try {
      [stats, sessions, resources] = await Promise.all([
        DB.getStats(),
        DB.getAllSess(),
        DB.getAllResources(),
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

            ${this._renderQuickLog(today)}

            <div style="margin-top:20px;display:flex;gap:10px;flex-wrap:wrap;">
              <a href="#/log" class="df-btn df-btn--primary">+ Log Session</a>
              <a href="#/sessions" class="df-btn df-btn--outline">Browse Sessions</a>
            </div>
          </div>
          <div>
            ${this._renderCalendar(stats.allDates)}
            ${topResources.length ? this._renderTopResources(topResources) : ''}
          </div>
        </div>
      </div>
    `;

    this._initStatCounters(app, stats);
    this._initCalendarNav(app, stats.allDates);
    this._initQuickLog(app, today);

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


  // __FF_QUICK_LOG__
  _renderQuickLog(today) {
    let lastFocus = '';
    try { lastFocus = (localStorage.getItem('df:lastFocus') || '').trim(); } catch (e) {}

    const presets = ['Chords','Scales','Strumming','Picking','Worship Set','Metronome','Song Practice'];

    const options = [
      ...(lastFocus ? [`<option value="${lastFocus}">${lastFocus} (last)</option>`] : []),
      `<option value="">— Select focus (optional) —</option>`,
      ...presets.map(p => `<option value="${p}">${p}</option>`),
      `<option value="__custom__">Custom…</option>`,
    ].join('');

    return `
      <div class="card" style="margin-top:18px;padding:16px;border:1px solid var(--line);background:rgba(0,0,0,.22);">
        <div style="display:flex;align-items:flex-end;justify-content:space-between;gap:12px;flex-wrap:wrap;">
          <div>
            <div style="font-family:var(--f-mono);font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--text3);">Quick Log</div>
            <div style="font-size:16px;font-weight:700;margin-top:6px;">One-click session</div>
          </div>
          <a href="#/log" class="df-btn df-btn--outline" style="padding:8px 12px;font-size:11px;">Open full form</a>
        </div>

        <div style="margin-top:14px;display:grid;grid-template-columns:repeat(12,1fr);gap:12px;align-items:start;">
          <div style="grid-column:span 6;">
            <div class="df-field">
              <label class="df-label">Duration</label>
              <div style="display:flex;gap:8px;flex-wrap:wrap;">
                ${[5,10,15,20,30,45,60].map(m => `
                  <button type="button" class="df-btn df-btn--outline" data-ql-min="${m}" style="font-size:11px;padding:8px 12px;border-radius:999px;">${m}m</button>
                `).join('')}
              </div>
              <div style="margin-top:8px;display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
                <input id="ql-minutes" class="df-input" type="number" min="1" max="999" value="10" style="max-width:110px;">
                <span style="color:var(--text3);font-size:12px;">minutes</span>
              </div>
            </div>
          </div>

          <div style="grid-column:span 6;">
            <div class="df-field">
              <label class="df-label">Focus</label>
              <select id="ql-focus" class="df-input">${options}</select>
              <input id="ql-focus-custom" class="df-input" type="text" placeholder="Type your focus…" style="display:none;margin-top:8px;">
            </div>
          </div>

          <div style="grid-column:span 12;">
            <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-top:4px;">
              <button type="button" id="ql-save" class="df-btn df-btn--primary">Save Quick Session</button>
              <span id="ql-status" style="color:var(--text3);font-family:var(--f-mono);font-size:11px;"></span>
            </div>
          </div>
        </div>

        <div style="margin-top:10px;color:var(--text3);font-size:12px;">
          Saves a session for <span style="font-family:var(--f-mono);">${today}</span> with minimal info. You can edit it later.
        </div>
      </div>
    `;
  },

  _initQuickLog(container, today) {
    const minutesEl = container.querySelector('#ql-minutes');
    const focusEl = container.querySelector('#ql-focus');
    const focusCustomEl = container.querySelector('#ql-focus-custom');
    const saveBtn = container.querySelector('#ql-save');
    const statusEl = container.querySelector('#ql-status');
    if (!minutesEl || !saveBtn) return;

    container.querySelectorAll('[data-ql-min]').forEach(btn => {
      btn.addEventListener('click', () => {
        const m = btn.getAttribute('data-ql-min');
        minutesEl.value = m;
        Utils.toast?.(`Quick log: ${m}m`);
      });
    });

    if (focusEl && focusCustomEl) {
      focusEl.addEventListener('change', () => {
        const v = (focusEl.value || '').trim();
        if (v === '__custom__') {
          focusCustomEl.style.display = 'block';
          focusCustomEl.focus();
        } else {
          focusCustomEl.style.display = 'none';
          focusCustomEl.value = '';
        }
      });
    }

    const setStatus = (t) => { if (statusEl) statusEl.textContent = t || ''; };

    saveBtn.addEventListener('click', async () => {
      try {
        setStatus('Saving…');
        const minutes = int(minutesEl.value);
        if (!minutes || minutes < 1) {
          Utils.toast?.('Minutes required', 'error');
          setStatus('');
          return;
        }

        let focus = '';
        if (focusEl) {
          focus = (focusEl.value || '').trim();
          if (focus === '__custom__') focus = (focusCustomEl?.value || '').trim();
          if (focus.endsWith && focus.endsWith(' (last)')) focus = focus.replace(/\s*\(last\)\s*$/, '').trim();
          if (focus === '— Select focus (optional) —') focus = '';
        }

        const data = { date: today, minutes };
        if (focus) data.focus = focus;

        const saved = await DB.saveSess(data);

        if (focus) {
          try { localStorage.setItem('df:lastFocus', focus); } catch (e) {}
        }

        Utils.toast?.('Quick session saved ✅');
        setStatus('Saved!');
        go(`#/session/${saved.id}`);
      } catch (e) {
        console.error(e);
        Utils.toast?.('Quick log failed', 'error');
        setStatus('Error.');
      } finally {
        setTimeout(() => setStatus(''), 2000);
      }
    });

    function int(v) {
      try { return parseInt(String(v || '').trim(), 10) || 0; } catch (e) { return 0; }
    }
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
