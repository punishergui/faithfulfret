// Daily Fret — Dashboard Page

window.Pages = window.Pages || {};

Pages.Dashboard = {
  async render() {
    const app = document.getElementById('app');
    app.innerHTML = '<div class="page-wrap" style="padding:60px 24px;text-align:center;"><p style="color:var(--text3);font-family:var(--f-mono);">Loading...</p></div>';

    const [stats, sessions, resources] = await Promise.all([
      DB.getStats(),
      DB.getAllSess(),
      DB.getAllResources(),
    ]);

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
            <div style="margin-top:20px;">
              <a href="#/log" class="df-btn df-btn--primary">+ Log Session</a>
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
