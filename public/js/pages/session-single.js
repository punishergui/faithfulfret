// Daily Fret — Single Session View

window.Pages = window.Pages || {};

Pages.SessionSingle = {
  async render(id) {
    const app = document.getElementById('app');
    app.innerHTML = '<div class="page-wrap" style="padding:60px 24px;text-align:center;"><p style="color:var(--text3);font-family:var(--f-mono);">Loading...</p></div>';

    const [session, allSessions] = await Promise.all([
      DB.getSess(id),
      DB.getAllSess(),
    ]);

    if (!session) {
      app.innerHTML = `
        <div class="page-wrap" style="padding:80px 24px;text-align:center;">
          <div style="color:var(--text3);font-family:var(--f-mono);font-size:11px;letter-spacing:0.1em;margin-bottom:12px;">SESSION NOT FOUND</div>
          <a href="#/sessions" class="df-btn df-btn--outline">← Back to Sessions</a>
        </div>
      `;
      return;
    }

    // Find prev/next
    const idx = allSessions.findIndex(s => s.id === id);
    const prevSession = allSessions[idx + 1] || null;
    const nextSession = allSessions[idx - 1] || null;
    const today = Utils.today();
    const todaySession = allSessions.find(s => s.date === today);

    app.innerHTML = `
      ${this._renderHero(session)}
      ${this._renderVideo(session)}
      <div class="session-body">
        <div class="session-main">
          ${session.win ? this._renderWin(session.win) : ''}
          ${session.notes ? this._renderNotes(session.notes) : ''}
          ${session.links ? this._renderLinks(session.links) : ''}
        </div>
        <div class="session-sidebar">
          ${this._renderStats(session)}
          ${session.checklist ? this._renderChecklist(session) : ''}
          <div style="margin-top:20px;">
            <a href="#/sessions" class="df-btn df-btn--outline" style="margin-bottom:10px;display:block;text-align:center;">&#8592; All Sessions</a>
            <a href="#/log/${session.id}" class="df-btn df-btn--outline" style="display:block;text-align:center;">Edit Session</a>
          </div>
        </div>
      </div>
      ${this._renderNav(prevSession, nextSession, session, todaySession, today)}
    `;

    this._initChecklist(app, session);
  },

  _renderHero(s) {
    const longDate = Utils.formatDate(s.date, 'long').toUpperCase();
    return `
      <div class="session-hero">
        <div style="max-width:1200px;margin:0 auto;padding:48px 24px 40px;position:relative;z-index:1;">
          <div class="session-hero__meta">
            ${s.dayNumber ? `<span class="df-badge df-badge--orange">Day ${s.dayNumber}</span>` : ''}
            ${s.mood ? `<span class="df-badge df-badge--muted">${s.mood}</span>` : ''}
            ${s.videoId ? `<span class="df-badge df-badge--red">&#9654; REC</span>` : ''}
          </div>
          <div class="session-hero__date">${longDate}</div>
          ${s.focus ? `<div class="session-hero__focus">${s.focus}</div>` : ''}
          <div class="session-hero__divider"></div>
          ${this._renderHeroStatBar(s)}
        </div>
        <div class="fret-line"></div>
      </div>
    `;
  },

  _renderHeroStatBar(s) {
    const items = [];
    if (s.minutes) items.push({ key: 'Duration', val: `${s.minutes}m` });
    if (s.bpm) items.push({ key: 'Peak BPM', val: s.bpm });
    if (s.minutes) items.push({ key: 'Hours', val: (s.minutes / 60).toFixed(1) });
    if (s.dayNumber) items.push({ key: 'Day #', val: s.dayNumber });

    if (!items.length) return '';

    return `
      <div class="df-statbar" style="max-width:600px;">
        ${items.map(item => `
          <div class="df-statbar__item">
            <div class="df-statbar__key">${item.key}</div>
            <div class="df-statbar__val">${item.val}</div>
          </div>
        `).join('')}
      </div>
    `;
  },

  _renderVideo(s) {
    if (s.videoId) {
      return `
        <div class="session-video">
          <div class="session-video__wrap">
            <iframe
              src="https://www.youtube.com/embed/${s.videoId}?rel=0&modestbranding=1"
              title="Session video"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowfullscreen>
            </iframe>
          </div>
        </div>
      `;
    }
    return `
      <div style="max-width:700px;margin:24px auto;padding:0 24px;">
        <div class="session-video__placeholder">// NO VIDEO LOGGED</div>
      </div>
    `;
  },

  _renderWin(win) {
    return `
      <div class="session-win">${win}</div>
    `;
  },

  _renderNotes(notes) {
    return `
      <div class="session-notes">${notes.replace(/\n/g, '<br>')}</div>
    `;
  },

  _renderLinks(linksRaw) {
    const links = Utils.parseLinks(linksRaw);
    if (!links.length) return '';
    return `
      <div class="session-links">
        <div style="font-family:var(--f-mono);font-size:9px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:var(--text3);margin-bottom:8px;">Links</div>
        ${links.map(l => `
          <a href="${l.url}" target="_blank" rel="noopener" class="session-link">
            <span style="color:var(--text3);">&#8599;</span>
            <span class="session-link__label">${l.label}</span>
            <span class="session-link__domain">${Utils.domainOf(l.url)}</span>
          </a>
        `).join('')}
      </div>
    `;
  },

  _renderStats(s) {
    const rows = [];
    if (s.date) rows.push({ key: 'Date', val: Utils.formatDate(s.date, 'short') });
    if (s.minutes) rows.push({ key: 'Duration', val: `${s.minutes} min` });
    if (s.bpm) rows.push({ key: 'Peak BPM', val: s.bpm });
    if (s.mood) rows.push({ key: 'Feel', val: s.mood });
    if (s.dayNumber) rows.push({ key: 'Day #', val: s.dayNumber });

    if (!rows.length) return '';

    return `
      <div style="border:1px solid var(--line2);background:var(--bg1);padding:16px;margin-bottom:16px;">
        <div style="font-family:var(--f-mono);font-size:9px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:var(--text3);margin-bottom:12px;">Stats</div>
        ${rows.map(r => `
          <div class="session-stat-row">
            <span class="session-stat-row__key">${r.key}</span>
            <span class="session-stat-row__val">${r.val}</span>
          </div>
        `).join('')}
      </div>
    `;
  },

  _renderChecklist(s) {
    const items = Utils.parseChecklist(s.checklist);
    if (!items.length) return '';

    const storageKey = `dfc_${s.id}`;
    const checked = JSON.parse(localStorage.getItem(storageKey) || '{}');

    return `
      <div class="session-checklist">
        <div class="checklist-title">Practice Checklist</div>
        ${items.map((item, i) => {
          const isDone = !!checked[i];
          return `
            <div class="checklist-item ${isDone ? 'checklist-item--done' : ''}" data-idx="${i}">
              <input type="checkbox" id="chk_${i}" ${isDone ? 'checked' : ''}>
              <label class="checklist-item__label" for="chk_${i}">${item}</label>
            </div>
          `;
        }).join('')}
      </div>
    `;
  },

  _initChecklist(container, session) {
    const storageKey = `dfc_${session.id}`;
    const items = container.querySelectorAll('.checklist-item');
    items.forEach(item => {
      const checkbox = item.querySelector('input[type="checkbox"]');
      if (!checkbox) return;
      checkbox.addEventListener('change', () => {
        const idx = item.dataset.idx;
        const checked = JSON.parse(localStorage.getItem(storageKey) || '{}');
        if (checkbox.checked) {
          checked[idx] = true;
          item.classList.add('checklist-item--done');
        } else {
          delete checked[idx];
          item.classList.remove('checklist-item--done');
        }
        localStorage.setItem(storageKey, JSON.stringify(checked));
      });
    });
  },

  _renderNav(prev, next, current, todaySession, today) {
    const isToday = current.date === today;

    let centerEl;
    if (isToday) {
      centerEl = `<span style="font-family:var(--f-mono);font-size:10px;letter-spacing:0.1em;color:var(--text3);text-transform:uppercase;">Today</span>`;
    } else if (todaySession) {
      centerEl = `<a href="#/session/${todaySession.id}" class="session-nav__btn">Today</a>`;
    } else {
      centerEl = `<a href="#/log" class="session-nav__btn">+ Log Today</a>`;
    }

    return `
      <div class="session-nav">
        <div>
          ${prev ? `
            <a href="#/session/${prev.id}" class="session-nav__item">
              <span class="session-nav__dir">&#8592; Previous</span>
              <span class="session-nav__date">${Utils.formatDate(prev.date, 'short')}</span>
            </a>
          ` : `<div class="session-nav__item"><span class="session-nav__dir" style="color:var(--text3);">No previous</span></div>`}
        </div>
        <div class="session-nav__item session-nav__item--center">
          ${centerEl}
        </div>
        <div>
          ${next ? `
            <a href="#/session/${next.id}" class="session-nav__item session-nav__item--right">
              <span class="session-nav__dir">Next &#8594;</span>
              <span class="session-nav__date">${Utils.formatDate(next.date, 'short')}</span>
            </a>
          ` : `<div class="session-nav__item session-nav__item--right"><span class="session-nav__dir" style="color:var(--text3);">No next</span></div>`}
        </div>
      </div>
    `;
  },
};
